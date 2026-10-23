import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConduitDatabase } from "./database";
import { apiErrorHandler, createApiRouter } from "./routes";

export function createApp(db: ConduitDatabase, jwtSecret: string): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(db, jwtSecret));
  app.use("/api", (_req, res) => {
    res.status(404).json({ errors: { path: ["not found"] } });
  });
  const webRoot = resolve(process.cwd(), "dist", "web");
  app.use(express.static(webRoot));
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    const indexPath = resolve(webRoot, "index.html");
    if (!existsSync(indexPath)) {
      res.status(404).json({ errors: { path: ["not found"] } });
      return;
    }
    res.sendFile(indexPath);
  });
  app.use(apiErrorHandler);
  return app;
}
