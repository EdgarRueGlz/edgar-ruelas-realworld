import express, { type Express } from "express";
import type { ConduitDatabase } from "./database";
import { apiErrorHandler, createApiRouter } from "./routes";

export function createApp(db: ConduitDatabase, jwtSecret: string): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(db, jwtSecret));
  app.use((_req, res) => {
    res.status(404).json({ errors: { path: ["not found"] } });
  });
  app.use(apiErrorHandler);
  return app;
}
