import "dotenv/config";
import { resolve } from "node:path";
import { createApp } from "./app";
import { ConduitDatabase } from "./database";

const port = Number(process.env.PORT ?? 8000);
const jwtSecret = process.env.JWT_SECRET;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 characters");
}

const databasePath = process.env.DATABASE_PATH ?? "./data/conduit.sqlite";
const database = new ConduitDatabase(databasePath === ":memory:" ? databasePath : resolve(databasePath));
const app = createApp(database, jwtSecret);
const server = app.listen(port, () => {
  console.log(`Conduit API listening on http://localhost:${port}/api`);
});

function shutdown(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
