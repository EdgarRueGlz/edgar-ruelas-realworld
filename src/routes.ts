import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z, type ZodType } from "zod";
import type { ConduitDatabase } from "./database";
import { ApiError } from "./errors";
import { ConduitService, publicUser } from "./services";

const nonempty = z.string({ required_error: "can't be blank" }).min(1, "can't be blank");
const email = nonempty.email("is invalid");
const nullableText = z.string().nullable().optional();

const registrationSchema = z.object({
  user: z.object({
    username: nonempty,
    email,
    password: nonempty
  })
});
const loginSchema = z.object({
  user: z.object({
    email,
    password: nonempty
  })
});
const updateUserSchema = z.object({
  user: z.object({
    username: nonempty.optional(),
    email: email.optional(),
    password: z.string().min(8, "is too short (minimum is 8 characters)").max(128, "is too long").optional(),
    bio: nullableText,
    image: nullableText
  })
});
const createArticleSchema = z.object({
  article: z.object({
    title: nonempty,
    description: nonempty,
    body: nonempty,
    tagList: z.array(z.string()).default([])
  })
});
const updateArticleSchema = z.object({
  article: z.object({
    title: nonempty.optional(),
    description: nonempty.optional(),
    body: nonempty.optional(),
    tagList: z.array(z.string()).optional()
  })
});
const commentSchema = z.object({ comment: z.object({ body: nonempty }) });

function parseBody<TSchema extends ZodType>(schema: TSchema, body: unknown): z.infer<TSchema> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const pathField = issue.path.at(-1);
    const key = typeof pathField === "string" ? pathField : "body";
    (errors[key] ??= []).push(issue.message);
  }
  throw new ApiError(422, "validation", JSON.stringify(errors));
}

function parseLimitOffset(query: Request["query"]): { limit: number; offset: number } {
  const parse = (value: unknown, fallback: number, key: string): number => {
    if (value === undefined) return fallback;
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = Number(raw);
    if (typeof raw !== "string" || !/^\d+$/.test(raw) || !Number.isSafeInteger(parsed)) {
      throw new ApiError(422, key, "is invalid");
    }
    return parsed;
  };
  return {
    limit: parse(query.limit, 20, "limit"),
    offset: parse(query.offset, 0, "offset")
  };
}

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") throw new ApiError(404, name, "not found");
  return value;
}

function tokenFromRequest(req: Request, secret: string): number | undefined {
  const header = req.get("Authorization");
  if (!header) return undefined;
  const match = /^Token\s+(\S+)$/.exec(header);
  if (!match) throw new ApiError(401, "token", "is invalid");
  try {
    const payload = jwt.verify(match[1]!, secret);
    if (typeof payload === "string" || typeof payload.sub !== "string") throw new Error("Invalid token subject");
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid token subject");
    return userId;
  } catch {
    throw new ApiError(401, "token", "is invalid");
  }
}

function authenticated(req: Request, _res: Response, next: NextFunction): void {
  if (req.userId === undefined) {
    next(new ApiError(401, "token", "is missing"));
    return;
  }
  next();
}

export function createApiRouter(db: ConduitDatabase, jwtSecret: string): Router {
  const service = new ConduitService(db, jwtSecret);
  const router = Router();

  router.use((req, _res, next) => {
    try {
      req.userId = tokenFromRequest(req, jwtSecret);
      next();
    } catch (error) {
      next(error);
    }
  });

  router.post("/users", (req, res, next) => {
    try {
      const { user: input } = parseBody(registrationSchema, req.body);
      const user = service.register(input);
      res.status(201).json({ user: publicUser(user, service.tokenFor(user.id)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/users/login", (req, res, next) => {
    try {
      const { user: input } = parseBody(loginSchema, req.body);
      const user = service.login(input.email, input.password);
      res.json({ user: publicUser(user, service.tokenFor(user.id)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/user", authenticated, (req, res, next) => {
    try {
      const user = service.currentUser(req.userId!);
      res.json({ user: publicUser(user, service.tokenFor(user.id)) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/user", authenticated, (req, res, next) => {
    try {
      const { user: input } = parseBody(updateUserSchema, req.body);
      const user = service.updateUser(req.userId!, input);
      res.json({ user: publicUser(user, service.tokenFor(user.id)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/profiles/:username", (req, res, next) => {
    try {
      res.json({ profile: service.profile(pathParam(req, "username"), req.userId) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/profiles/:username/follow", authenticated, (req, res, next) => {
    try {
      res.json({ profile: service.follow(req.userId!, pathParam(req, "username"), true) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/profiles/:username/follow", authenticated, (req, res, next) => {
    try {
      res.json({ profile: service.follow(req.userId!, pathParam(req, "username"), false) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/articles/feed", authenticated, (req, res, next) => {
    try {
      const { limit, offset } = parseLimitOffset(req.query);
      res.json(service.feed(req.userId!, limit, offset));
    } catch (error) {
      next(error);
    }
  });

  router.get("/articles", (req, res, next) => {
    try {
      const { limit, offset } = parseLimitOffset(req.query);
      const filters = {
        ...(typeof req.query.tag === "string" ? { tag: req.query.tag } : {}),
        ...(typeof req.query.author === "string" ? { author: req.query.author } : {}),
        ...(typeof req.query.favorited === "string" ? { favorited: req.query.favorited } : {})
      };
      res.json(service.listArticles(filters, req.userId, limit, offset));
    } catch (error) {
      next(error);
    }
  });

  router.post("/articles", authenticated, (req, res, next) => {
    try {
      const { article: input } = parseBody(createArticleSchema, req.body);
      res.status(201).json({ article: service.createArticle(req.userId!, input) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/articles/:slug/comments", (req, res, next) => {
    try {
      res.json(service.listComments(pathParam(req, "slug"), req.userId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/articles/:slug/comments", authenticated, (req, res, next) => {
    try {
      const { comment } = parseBody(commentSchema, req.body);
      res.status(201).json({ comment: service.addComment(req.userId!, pathParam(req, "slug"), comment.body) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/articles/:slug/comments/:id", authenticated, (req, res, next) => {
    try {
      const id = Number(pathParam(req, "id"));
      if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, "comment", "not found");
      service.deleteComment(req.userId!, pathParam(req, "slug"), id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/articles/:slug/favorite", authenticated, (req, res, next) => {
    try {
      res.json({ article: service.favorite(req.userId!, pathParam(req, "slug"), true) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/articles/:slug/favorite", authenticated, (req, res, next) => {
    try {
      res.json({ article: service.favorite(req.userId!, pathParam(req, "slug"), false) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/articles/:slug", (req, res, next) => {
    try {
      res.json({ article: service.getArticle(pathParam(req, "slug"), req.userId) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/articles/:slug", authenticated, (req, res, next) => {
    try {
      const { article: input } = parseBody(updateArticleSchema, req.body);
      res.json({ article: service.updateArticle(req.userId!, pathParam(req, "slug"), input) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/articles/:slug", authenticated, (req, res, next) => {
    try {
      service.deleteArticle(req.userId!, pathParam(req, "slug"));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/tags", (_req, res) => {
    res.json(service.tags());
  });

  return router;
}

export function apiErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ApiError) {
    if (error.key === "validation") {
      res.status(error.status).json({ errors: JSON.parse(error.message) });
      return;
    }
    res.status(error.status).json({ errors: { [error.key]: [error.message] } });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(422).json({ errors: { body: ["is invalid"] } });
    return;
  }
  console.error("Unhandled API error", error);
  res.status(500).json({ errors: { body: ["internal server error"] } });
}

declare global {
  namespace Express {
    interface Request {
      userId: number | undefined;
    }
  }
}
