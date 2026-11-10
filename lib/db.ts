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
    // Gate 3.1 (c): In production, refuse to start with community edges unless explicitly allowed
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_FULL_DB_IN_PROD !== "true") {
      throw new Error(
        "[DATA SAFETY FATAL] Refusing to start: INCLUDE_COMMUNITY_EDGES=true is set in production without ALLOW_FULL_DB_IN_PROD=true. Production deployments must not expose community edge data."
      );
    }

    const fullDbPath = path.join(process.cwd(), "data", "perfumes.full.db");
    // Gate 3.1 (b): If INCLUDE_COMMUNITY_EDGES=true but full DB is missing, throw hard error; silent fallback is prohibited
    if (!fs.existsSync(fullDbPath)) {
      throw new Error(
        "[DATA SAFETY FATAL] INCLUDE_COMMUNITY_EDGES=true was requested, but 'data/perfumes.full.db' does not exist. Silent fallback to public or development database is strictly prohibited."
      );
    }
    dbPath = fullDbPath;
  } else {
    // Gate 3.1 (a): Default build/runtime uses data/perfumes.public.db
    const publicDbPath = path.join(process.cwd(), "data", "perfumes.public.db");
    if (fs.existsSync(publicDbPath)) {
      dbPath = publicDbPath;
    } else {
      const devPath = path.join(process.cwd(), "data", "perfumes.db");
      if (fs.existsSync(devPath)) {
        dbPath = devPath;
      } else {
        return null;
      }
    }
  }

  if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
    return null;
  }

  try {
    dbInstance = new DatabaseSync(dbPath, { open: true, readOnly: true });
    return dbInstance;
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
    throw err;
  }
}
