import { NextResponse } from "next/server";
import { getNotesSummary } from "../../../lib/data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));

    const data = getNotesSummary(q, limit);
    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error("GET /api/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
