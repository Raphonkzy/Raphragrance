import { NextResponse } from "next/server";
import { getAccordsSummary } from "../../../lib/data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;

    const data = getAccordsSummary(q);
    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error("GET /api/accords error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
