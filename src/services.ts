import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { ConduitDatabase, type ArticleRow, type CommentRow, type UserRow } from "./database";
import { ApiError } from "./errors";

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = scryptSync(password, salt, PASSWORD_HASH_BYTES);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), PASSWORD_HASH_BYTES);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function nullable(value: string | null): string | null {
  return value === "" ? null : value;
}

export class ConduitService {
  constructor(
    private readonly db: ConduitDatabase,
    private readonly jwtSecret: string
  ) {}

  tokenFor(userId: number): string {
    return jwt.sign({ sub: String(userId) }, this.jwtSecret, { expiresIn: "30d" });
  }

  register(input: { username: string; email: string; password: string }): UserRow {
    if (this.db.findUserByUsername(input.username)) throw new ApiError(409, "username", "has already been taken");
    if (this.db.findUserByEmail(input.email)) throw new ApiError(409, "email", "has already been taken");
    try {
      return this.db.createUser(input.username, input.email.toLowerCase(), hashPassword(input.password));
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.username")) {
        throw new ApiError(409, "username", "has already been taken");
      }
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
        throw new ApiError(409, "email", "has already been taken");
      }
      throw error;
    }
  }

  login(email: string, password: string): UserRow {
    const user = this.db.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new ApiError(401, "credentials", "invalid");
    }
    return user;
  }

  currentUser(userId: number): UserRow {
    const user = this.db.findUserById(userId);
    if (!user) throw new ApiError(401, "token", "is invalid");
    return user;
  }

  updateUser(userId: number, input: {
    username?: string | undefined;
    email?: string | undefined;
    password?: string | undefined;
    bio?: string | null | undefined;
    image?: string | null | undefined;
  }): UserRow {
    const current = this.currentUser(userId);
    if (input.username !== undefined) {
      const duplicate = this.db.findUserByUsername(input.username);
      if (duplicate && duplicate.id !== userId) throw new ApiError(409, "username", "has already been taken");
    }
    if (input.email !== undefined) {
      const duplicate = this.db.findUserByEmail(input.email);
      if (duplicate && duplicate.id !== userId) throw new ApiError(409, "email", "has already been taken");
    }
    const changes: Partial<Pick<UserRow, "username" | "email" | "password_hash" | "bio" | "image">> = {};
    if (input.username !== undefined) changes.username = input.username;
    if (input.email !== undefined) changes.email = input.email.toLowerCase();
    if (input.password !== undefined) changes.password_hash = hashPassword(input.password);
    if (input.bio !== undefined) changes.bio = nullable(input.bio);
    if (input.image !== undefined) changes.image = nullable(input.image);
    try {
      this.db.updateUser(userId, changes);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.username")) {
        throw new ApiError(409, "username", "has already been taken");
      }
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.email")) {
        throw new ApiError(409, "email", "has already been taken");
      }
      throw error;
    }
    return this.currentUser(userId);
  }

  profile(username: string, viewerId?: number): Record<string, unknown> {
    const target = this.db.findUserByUsername(username);
    if (!target) throw new ApiError(404, "profile", "not found");
    return {
      username: target.username,
      bio: target.bio,
      image: target.image,
      following: viewerId !== undefined && this.db.isFollowing(viewerId, target.id)
    };
  }

  follow(viewerId: number, username: string, shouldFollow: boolean): Record<string, unknown> {
    const target = this.db.findUserByUsername(username);
    if (!target) throw new ApiError(404, "profile", "not found");
    if (shouldFollow) this.db.follow(viewerId, target.id);
    else this.db.unfollow(viewerId, target.id);
    return this.profile(target.username, viewerId);
  }

  createArticle(authorId: number, input: {
    title: string;
    description: string;
    body: string;
    tagList: string[];
  }): Record<string, unknown> {
    const article = this.db.createArticle(authorId, {
      ...input,
      slug: this.uniqueSlug(input.title)
    });
    return this.articleResponse(article, authorId, true);
  }

  updateArticle(userId: number, slug: string, input: {
    title?: string | undefined;
    description?: string | undefined;
    body?: string | undefined;
    tagList?: string[] | undefined;
  }): Record<string, unknown> {
    const article = this.requireArticle(slug);
    this.requireArticleOwner(article, userId);
    const changes: Partial<Pick<ArticleRow, "title" | "description" | "body" | "slug">> = {};
    if (input.title !== undefined) {
      changes.title = input.title;
      if (input.title !== article.title) changes.slug = this.uniqueSlug(input.title);
    }
    if (input.description !== undefined) changes.description = input.description;
    if (input.body !== undefined) changes.body = input.body;
    const updated = this.db.updateArticle(article, changes, input.tagList);
    return this.articleResponse(updated, userId, true);
  }

  deleteArticle(userId: number, slug: string): void {
    const article = this.requireArticle(slug);
    this.requireArticleOwner(article, userId);
    this.db.deleteArticle(article.id);
  }

  getArticle(slug: string, viewerId?: number): Record<string, unknown> {
    return this.articleResponse(this.requireArticle(slug), viewerId, true);
  }

  listArticles(filters: { tag?: string; author?: string; favorited?: string }, viewerId: number | undefined, limit: number, offset: number) {
    const { rows, total } = this.db.listArticles(filters, viewerId, limit, offset);
    return {
      articles: rows.map((article) => this.articleResponse(article, viewerId, false)),
      articlesCount: total
    };
  }

  feed(viewerId: number, limit: number, offset: number) {
    const { rows, total } = this.db.listArticles({ followerId: viewerId }, viewerId, limit, offset);
    return {
      articles: rows.map((article) => this.articleResponse(article, viewerId, false)),
      articlesCount: total
    };
  }

  favorite(userId: number, slug: string, shouldFavorite: boolean): Record<string, unknown> {
    const article = this.requireArticle(slug);
    if (shouldFavorite) this.db.favorite(userId, article.id);
    else this.db.unfavorite(userId, article.id);
    return this.articleResponse(article, userId, true);
  }

  addComment(userId: number, slug: string, body: string): Record<string, unknown> {
    const article = this.requireArticle(slug);
    return this.commentResponse(this.db.createComment(article.id, userId, body), userId);
  }

  listComments(slug: string, viewerId?: number) {
    const article = this.requireArticle(slug);
    return { comments: this.db.listComments(article.id).map((comment) => this.commentResponse(comment, viewerId)) };
  }

  deleteComment(userId: number, slug: string, commentId: number): void {
    const article = this.requireArticle(slug);
    const comment = this.db.findComment(commentId);
    if (!comment || comment.article_id !== article.id) throw new ApiError(404, "comment", "not found");
    if (comment.author_id !== userId) throw new ApiError(403, "comment", "forbidden");
    this.db.deleteComment(commentId);
  }

  tags(): { tags: string[] } {
    return { tags: this.db.listTags() };
  }

  private requireArticle(slug: string): ArticleRow {
    const article = this.db.findArticleBySlug(slug);
    if (!article) throw new ApiError(404, "article", "not found");
    return article;
  }

  private requireArticleOwner(article: ArticleRow, userId: number): void {
    if (article.author_id !== userId) throw new ApiError(403, "article", "forbidden");
  }

  private uniqueSlug(title: string): string {
    const base = title.toLowerCase().normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "article";
    let slug = base;
    let suffix = 2;
    while (this.db.slugExists(slug)) slug = `${base}-${suffix++}`;
    return slug;
  }

  private articleResponse(article: ArticleRow, viewerId: number | undefined, includeBody: boolean): Record<string, unknown> {
    const author = this.db.findUserById(article.author_id);
    if (!author) throw new Error(`Article ${article.id} has no author`);
    const data: Record<string, unknown> = {
      slug: article.slug,
      title: article.title,
      description: article.description,
      tagList: this.db.getTags(article.id),
      createdAt: article.created_at,
      updatedAt: article.updated_at,
      favorited: viewerId !== undefined && this.db.isFavorited(viewerId, article.id),
      favoritesCount: this.db.favoriteCount(article.id),
      author: {
        username: author.username,
        bio: author.bio,
        image: author.image,
        following: viewerId !== undefined && this.db.isFollowing(viewerId, author.id)
      }
    };
    if (includeBody) data.body = article.body;
    return data;
  }

  private commentResponse(comment: CommentRow, viewerId?: number): Record<string, unknown> {
    const author = this.db.findUserById(comment.author_id);
    if (!author) throw new Error(`Comment ${comment.id} has no author`);
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      author: {
        username: author.username,
        bio: author.bio,
        image: author.image,
        following: viewerId !== undefined && this.db.isFollowing(viewerId, author.id)
      }
    };
  }
}

export function publicUser(user: UserRow, token: string): Record<string, unknown> {
  return {
    email: user.email,
    token,
    username: user.username,
    bio: user.bio,
    image: user.image
  };
}
