import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync | null {
  if (dbInstance) return dbInstance;

  const defaultDbPath = path.join(process.cwd(), "data", "perfumes.db");
  const dbPath = process.env.DATABASE_PATH || defaultDbPath;
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
