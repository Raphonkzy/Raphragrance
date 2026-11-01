import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync | null {
  if (dbInstance) return dbInstance;

  let dbPath: string;
  if (process.env.DATABASE_PATH) {
    dbPath = process.env.DATABASE_PATH;
  } else if (process.env.INCLUDE_COMMUNITY_EDGES === "true") {
    const fullDbPath = path.join(process.cwd(), "data", "perfumes.full.db");
    const fallbackPath = path.join(process.cwd(), "data", "perfumes.db");
    dbPath = fs.existsSync(fullDbPath) ? fullDbPath : fallbackPath;
  } else {
    const publicDbPath = path.join(process.cwd(), "data", "perfumes.public.db");
    const fallbackPath = path.join(process.cwd(), "data", "perfumes.db");
    dbPath = fs.existsSync(publicDbPath) ? publicDbPath : fallbackPath;
  }

  if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
    return null;
  }

  try {
    dbInstance = new DatabaseSync(dbPath, { open: true, readOnly: true });
    return dbInstance;
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
    return null;
  }
}
