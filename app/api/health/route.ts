import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getTotalCount } from "../../../lib/data";

export async function GET() {
  const db = getDb();
  const dbConnected = db !== null;
  const count = getTotalCount();

  return NextResponse.json({
    status: dbConnected ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    database: {
      engine: "node:sqlite",
      connected: dbConnected,
      perfumes_count: count,
    },
  });
}
