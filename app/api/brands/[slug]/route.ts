import { NextResponse } from "next/server";
import { getBrandDetail } from "../../../../lib/data";

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;
    const decoded = decodeURIComponent(slug);

    const brandData = getBrandDetail(decoded);
    if (!brandData) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json({ data: brandData });
  } catch (err) {
    console.error("GET /api/brands/[slug] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
