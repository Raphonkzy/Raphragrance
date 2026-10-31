import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getFragrancesByBrand } from "../../../lib/data";
import { getColorPair } from "../../../lib/palette";
import { Nav } from "../../../components/Nav";
import { Footer } from "../../../components/Footer";
import { FragranceTile } from "../../../components/FragranceTile";

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ fixture?: string }>;
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { fixture } = await searchParams;
  const useGolden = fixture === "golden";

  const brandName = decodeURIComponent(slug.join("/"));
  const brandFragrances = getFragrancesByBrand(brandName);

  if (brandFragrances.length === 0) {
    notFound();
  }

  // Count top accords to find brand's most common top accord
  const accordCounts: Record<string, number> = {};
  for (const f of brandFragrances) {
    const topAcc = f.accords?.[0]?.name;
    if (topAcc) {
      accordCounts[topAcc] = (accordCounts[topAcc] || 0) + 1;
    }
  }

  const sortedAccords = Object.entries(accordCounts).sort((a, b) => b[1] - a[1]);
  const mostCommonAccord = sortedAccords[0]?.[0] || null;
  const [fill, ink] = getColorPair(mostCommonAccord);

  const heroStyle = {
    "--c": fill,
    "--i": ink,
  } as CSSProperties;

  const validRatings = brandFragrances.filter((f) => f.rating !== null);
  const avgRating =
    validRatings.length > 0
      ? (
          validRatings.reduce((sum, f) => sum + (f.rating || 0), 0) /
          validRatings.length
        ).toFixed(2)
      : "—";

  const years = brandFragrances.map((f) => f.year).filter((y): y is number => y !== null && y > 0);
  const earliestYear = years.length > 0 ? Math.min(...years) : "—";

  return (
    <>
      <Nav />

      {/* Brand Hero */}
      <section className="hero" style={heroStyle}>
        <div>
          <Link href="/brands" className="back">
            ← All brands
          </Link>
          <div className="br">Brand</div>
          <h1>{brandFragrances[0].brand}</h1>
          <div className="sub">
            {brandFragrances.length} fragrances in archive
          </div>
        </div>
      </section>

      <div className="wrap">
        {/* Brand Stats */}
        <div className="stats" role="region" aria-label="Brand stats">
          <div className="stat">
            <div className="l">Fragrances</div>
            <div className="n">{brandFragrances.length}</div>
            <div className="s">archived</div>
          </div>
          <div className="stat">
            <div className="l">Average rating</div>
            <div className="n">{avgRating}</div>
            <div className="s">across collection</div>
          </div>
          <div className="stat">
            <div className="l">Earliest release</div>
            <div className="n">{earliestYear}</div>
            <div className="s">first documented</div>
          </div>
          <div className="stat">
            <div className="l">Primary accord</div>
            <div className="n" style={{ fontSize: "36px" }}>{mostCommonAccord ?? "—"}</div>
            <div className="s">signature profile</div>
          </div>
        </div>

        <section className="sec" aria-labelledby="brand-catalog-title">
          <h2 id="brand-catalog-title">Fragrances by {brandFragrances[0].brand}</h2>
          <div className="grid" style={{ padding: "20px 0 60px" }}>
            {brandFragrances.map((f, idx) => (
              <FragranceTile key={f.id} fragrance={f} priority={idx < 4} />
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
