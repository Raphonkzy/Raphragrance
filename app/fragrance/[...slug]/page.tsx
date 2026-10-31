import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ImagePanel from "@/components/ImagePanel";
import { getFragranceBySlug } from "@/lib/data";
import {
  lonL,
  silL,
  formatVotes,
  genderLabel,
  normalizeSeasons,
  getHue,
} from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ fixture?: string }>;
}

export async function generateStaticParams() {
  // Only pre-render golden fixture slugs at build time
  const { default: golden } = await import("@/fixtures/golden.json");
  return golden.map((f: { slug: string }) => ({
    slug: f.slug.split("/"),
  }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const useGolden =
    process.env.NODE_ENV !== "production" && sp.fixture === "golden";
  const slugStr = slug.join("/");
  const f = getFragranceBySlug(slugStr, useGolden);
  if (!f) return { title: "Not found" };
  return {
    title: `${f.name} by ${f.brand}`,
    description: `${f.name} by ${f.brand}, ${f.year ?? ""}. Accords, note pyramid, longevity and sillage data.`,
  };
}

export default async function FragrancePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const useGolden =
    process.env.NODE_ENV !== "production" && sp.fixture === "golden";
  const slugStr = slug.join("/");
  const f = getFragranceBySlug(slugStr, useGolden);

  if (!f) notFound();

  const hue = getHue(f);
  const seasons = normalizeSeasons(f.seasons);
  const gLabel = genderLabel(f.gender);

  return (
    <>
      <Navbar />
      <div className="d3-det">
        {/* Left: sticky image panel */}
        <div className="d3-det-image">
          <ImagePanel
            src={f.imageUrl}
            alt={`${f.brand} ${f.name} bottle`}
            hue={hue}
            priority={true}
            fill
          />
        </div>

        {/* Right: scrollable info */}
        <div className="d3-det-info">
          <Link href="/" className="d3-back">
            ← All fragrances
          </Link>

          <div className="d3-eyebrow">{f.brand}</div>
          <h1 className="d3-det-name">{f.name}</h1>
          <div className="d3-rule" aria-hidden="true" style={{ width: "2.5rem" }} />
          <p className="d3-det-meta">
            {f.year && `${f.year} · `}
            {gLabel}
            {f.rating !== null &&
              ` · rated ${f.rating.toFixed(2)} by ${formatVotes(f.voteCount)} people`}
          </p>

          {/* Note pyramid */}
          {(f.notes.top.length > 0 || f.notes.heart.length > 0 || f.notes.base.length > 0) && (
            <>
              <h2 className="d3-section-heading">Note pyramid</h2>
              <div className="d3-pyr">
                <svg
                  viewBox="0 0 240 240"
                  width="240"
                  height="240"
                  aria-hidden="true"
                  focusable="false"
                >
                  {/* Top — 30% violet mix */}
                  <polygon
                    points="120,0 160,80 80,80"
                    fill="color-mix(in srgb, var(--ac) 30%, var(--bg))"
                    stroke="var(--bg)"
                    strokeWidth="3"
                  />
                  {/* Heart — 55% violet mix */}
                  <polygon
                    points="80,80 160,80 200,160 40,160"
                    fill="color-mix(in srgb, var(--ac) 55%, var(--bg))"
                    stroke="var(--bg)"
                    strokeWidth="3"
                  />
                  {/* Base — full violet */}
                  <polygon
                    points="40,160 200,160 240,240 0,240"
                    fill="var(--ac)"
                    stroke="var(--bg)"
                    strokeWidth="3"
                  />
                </svg>
                <div className="d3-pyr-notes" aria-label="Fragrance notes">
                  <div>
                    <small>Top</small>
                    <span>{f.notes.top.join(", ") || "—"}</span>
                  </div>
                  <div>
                    <small>Heart</small>
                    <span>{f.notes.heart.join(", ") || "—"}</span>
                  </div>
                  <div>
                    <small>Base</small>
                    <span>{f.notes.base.join(", ") || "—"}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Flat notes fallback */}
          {f.notes.top.length === 0 &&
            f.notes.heart.length === 0 &&
            f.notes.base.length === 0 &&
            f.notes.flat.length > 0 && (
              <>
                <h2 className="d3-section-heading">Notes</h2>
                <p style={{ color: "var(--tx2)", fontSize: 14 }}>
                  {f.notes.flat.join(", ")}
                </p>
              </>
            )}

          {/* Main accords */}
          {f.accords.length > 0 && (
            <>
              <h2 className="d3-section-heading">Main accords</h2>
              {f.accords.map((a) => (
                <div
                  key={a.name}
                  className="d3-bar"
                  role="img"
                  aria-label={`${a.name}: ${a.strength}%`}
                >
                  <span>{a.name}</span>
                  <div
                    className="d3-bar-track"
                    aria-hidden="true"
                  >
                    <div
                      className="d3-bar-fill"
                      style={{ "--bar-w": `${a.strength}%` } as React.CSSProperties}
                    />
                  </div>
                  <em className="d3-bar-pct">{a.strength}%</em>
                </div>
              ))}
            </>
          )}

          {/* Season */}
          {seasons.some((s) => s.value > 0) && (
            <>
              <h2 className="d3-section-heading">Season</h2>
              <div className="d3-tiles">
                {seasons.map((s) => {
                  const p = (s.value / 4) * 100;
                  return (
                    <div
                      key={s.name}
                      className="d3-tile"
                      style={{ "--tile-p": `${p.toFixed(1)}%` } as React.CSSProperties}
                      aria-label={`${s.name}: ${s.value.toFixed(1)}`}
                    >
                      <small>{s.name}</small>
                      <b>{s.value.toFixed(1)}</b>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Performance */}
          {(f.longevity !== null || f.sillage !== null) && (
            <>
              <h2 className="d3-section-heading">Performance</h2>
              <p className="d3-perf">
                {f.longevity !== null &&
                  `Longevity ${f.longevity.toFixed(1)}, ${lonL(f.longevity).toLowerCase()}. `}
                {f.sillage !== null &&
                  `Sillage ${f.sillage.toFixed(1)}, ${silL(f.sillage).toLowerCase()}.`}
              </p>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
