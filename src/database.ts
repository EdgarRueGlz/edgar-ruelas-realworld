import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  bio: string | null;
  image: string | null;
}

export interface ArticleRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  author_id: number;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: number;
  body: string;
  article_id: number;
  author_id: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleFilters {
  tag?: string;
  author?: string;
  favorited?: string;
  followerId?: number;
}

export class ConduitDatabase {
  private readonly db: Database.Database;

  constructor(path: string) {
    if (path !== ":memory:") {
      const resolved = resolve(path);
      mkdirSync(dirname(resolved), { recursive: true });
      this.db = new Database(resolved);
    } else {
      this.db = new Database(path);
    }
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        bio TEXT,
        image TEXT
      );
      CREATE TABLE IF NOT EXISTS follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (follower_id, followed_id),
        CHECK (follower_id != followed_id)
      );
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS article_tags (
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (article_id, tag)
      );
      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, article_id)
      );
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  findUserById(id: number): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  }

  findUserByEmail(email: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as UserRow | undefined;
  }

  findUserByUsername(username: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as UserRow | undefined;
  }

  createUser(username: string, email: string, passwordHash: string): UserRow {
    const result = this.db.prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
    ).run(username, email, passwordHash);
    return this.findUserById(Number(result.lastInsertRowid))!;
  }

  updateUser(userId: number, changes: Partial<Pick<UserRow, "username" | "email" | "password_hash" | "bio" | "image">>): void {
    const columns: string[] = [];
    const values: Array<string | null | number> = [];
    for (const [key, value] of Object.entries(changes)) {
      const column = key === "password_hash" ? "password_hash" : key;
      columns.push(`${column} = ?`);
      values.push(value);
    }
    if (columns.length > 0) {
      this.db.prepare(`UPDATE users SET ${columns.join(", ")} WHERE id = ?`).run(...values, userId);
    }
  }

  isFollowing(followerId: number, followedId: number): boolean {
    return Boolean(this.db.prepare(
      "SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?"
    ).get(followerId, followedId));
  }

  follow(followerId: number, followedId: number): void {
    if (followerId !== followedId) {
      this.db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(followerId, followedId);
    }
  }

  unfollow(followerId: number, followedId: number): void {
    this.db.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").run(followerId, followedId);
  }

  createArticle(
    authorId: number,
    values: { slug: string; title: string; description: string; body: string; tagList: string[] }
  ): ArticleRow {
    const now = new Date().toISOString();
    const create = this.db.transaction(() => {
      const result = this.db.prepare(
        "INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(values.slug, values.title, values.description, values.body, authorId, now, now);
      const articleId = Number(result.lastInsertRowid);
      this.setTags(articleId, values.tagList);
      return this.findArticleById(articleId)!;
    });
    return create();
  }

  findArticleBySlug(slug: string): ArticleRow | undefined {
    return this.db.prepare("SELECT * FROM articles WHERE slug = ?").get(slug) as ArticleRow | undefined;
  }

  findArticleById(id: number): ArticleRow | undefined {
    return this.db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
  }

  findArticleBySlugWithAuthor(slug: string): (ArticleRow & { author_username: string }) | undefined {
    return this.db.prepare(`
      SELECT articles.*, users.username AS author_username
      FROM articles JOIN users ON users.id = articles.author_id WHERE articles.slug = ?
    `).get(slug) as (ArticleRow & { author_username: string }) | undefined;
  }

  slugExists(slug: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM articles WHERE slug = ?").get(slug));
  }

  updateArticle(
    article: ArticleRow,
    changes: Partial<Pick<ArticleRow, "title" | "description" | "body" | "slug">>,
    tags?: string[]
  ): ArticleRow {
    const previousUpdate = Date.parse(article.updated_at);
    const updatedAt = new Date(Math.max(Date.now(), previousUpdate + 1)).toISOString();
    const update = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE articles SET title = ?, description = ?, body = ?, slug = ?, updated_at = ? WHERE id = ?
      `).run(
        changes.title ?? article.title,
        changes.description ?? article.description,
        changes.body ?? article.body,
        changes.slug ?? article.slug,
        updatedAt,
        article.id
      );
      if (tags !== undefined) this.setTags(article.id, tags);
      return this.findArticleById(article.id)!;
    });
    return update();
  }

  deleteArticle(id: number): void {
    this.db.prepare("DELETE FROM articles WHERE id = ?").run(id);
  }

  listArticles(filters: ArticleFilters, viewerId: number | undefined, limit: number, offset: number): {
    rows: ArticleRow[];
    total: number;
  } {
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (filters.tag !== undefined) {
      conditions.push("EXISTS (SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag = ?)");
      params.push(filters.tag);
    }
    if (filters.author !== undefined) {
      conditions.push("u.username = ? COLLATE NOCASE");
      params.push(filters.author);
    }
    if (filters.favorited !== undefined) {
      conditions.push(`EXISTS (
        SELECT 1 FROM favorites f JOIN users fu ON fu.id = f.user_id
        WHERE f.article_id = a.id AND fu.username = ? COLLATE NOCASE
      )`);
      params.push(filters.favorited);
    }
    if (filters.followerId !== undefined) {
      conditions.push("EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = a.author_id)");
      params.push(filters.followerId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const total = (this.db.prepare(`
      SELECT COUNT(*) AS count FROM articles a JOIN users u ON u.id = a.author_id ${where}
    `).get(...params) as { count: number }).count;
    const rows = this.db.prepare(`
      SELECT a.* FROM articles a JOIN users u ON u.id = a.author_id
      ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as ArticleRow[];
    return { rows, total };
  }

  getTags(articleId: number): string[] {
    return (this.db.prepare("SELECT tag FROM article_tags WHERE article_id = ? ORDER BY rowid").all(articleId) as Array<{ tag: string }>).map(({ tag }) => tag);
  }

  listTags(): string[] {
    return (this.db.prepare("SELECT DISTINCT tag FROM article_tags ORDER BY tag").all() as Array<{ tag: string }>).map(({ tag }) => tag);
  }

  private setTags(articleId: number, tags: string[]): void {
    this.db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(articleId);
    const insert = this.db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES (?, ?)");
    for (const tag of tags) insert.run(articleId, tag);
  }

  isFavorited(userId: number, articleId: number): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND article_id = ?").get(userId, articleId));
  }

  favorite(userId: number, articleId: number): void {
    this.db.prepare("INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (?, ?)").run(userId, articleId);
  }

  unfavorite(userId: number, articleId: number): void {
    this.db.prepare("DELETE FROM favorites WHERE user_id = ? AND article_id = ?").run(userId, articleId);
  }

  favoriteCount(articleId: number): number {
    return (this.db.prepare("SELECT COUNT(*) AS count FROM favorites WHERE article_id = ?").get(articleId) as { count: number }).count;
  }

  createComment(articleId: number, authorId: number, body: string): CommentRow {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO comments (body, article_id, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    `).run(body, articleId, authorId, now, now);
    return this.findComment(Number(result.lastInsertRowid)!);
  }

  findComment(id: number): CommentRow {
    return this.db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as CommentRow;
  }

  listComments(articleId: number): CommentRow[] {
    return this.db.prepare("SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC, id ASC").all(articleId) as CommentRow[];
  }

  deleteComment(id: number): void {
    this.db.prepare("DELETE FROM comments WHERE id = ?").run(id);
  }
}
