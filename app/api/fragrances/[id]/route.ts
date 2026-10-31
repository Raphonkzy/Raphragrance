import { NextResponse } from "next/server";
import { getFragranceById, getFragranceBySlug } from "../../../../lib/data";

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

    return NextResponse.json({ data: fragrance });
  } catch (err) {
    console.error("GET /api/fragrances/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
