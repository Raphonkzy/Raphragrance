import { NextResponse } from "next/server";
import { getFragranceById, getFragranceBySlug, getSimilarFragrances } from "../../../../../lib/data";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const decoded = decodeURIComponent(id);

    let fragrance;
    if (/^\d+$/.test(decoded)) {
      fragrance = getFragranceById(Number(decoded));
    }
    if (!fragrance) {
      fragrance = getFragranceBySlug(decoded);
    }

    if (!fragrance) {
      return NextResponse.json({ error: "Fragrance not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 8));

    const similar = getSimilarFragrances(fragrance, limit);

    return NextResponse.json(
      { data: similar },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    console.error("GET /api/fragrances/[id]/similar error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
