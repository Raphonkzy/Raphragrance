import { NextResponse } from "next/server";
import { getDb } from "../../lib/db";
import { getTotalCount } from "../../lib/data";

export async function GET() {
  try {
    const db = getDb();
    const dbConnected = db !== null;
    const count = dbConnected ? getTotalCount() : 0;

    const healthy = dbConnected && count > 0;

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "unhealthy",
        uptime_seconds: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          engine: "node:sqlite",
          connected: dbConnected,
          perfumes_count: count,
        },
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
