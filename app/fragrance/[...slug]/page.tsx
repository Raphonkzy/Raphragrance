import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getFragranceBySlug, getFragrances, getSimilarFragrances } from "../../../lib/data";
import { getColorPair } from "../../../lib/palette";
import { formatVotes, lonL, silL, normalizeSeasons } from "../../../lib/format";
import { Nav } from "../../../components/Nav";
import { Footer } from "../../../components/Footer";
import { BottleSvg, FragranceTile } from "../../../components/FragranceTile";

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<{ fixture?: string }>;
}

export function generateStaticParams() {
  const all = getFragrances(false);
  return all.map((f) => ({
    slug: f.slug.split("/"),
  }));
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const rawSlug = slug.join("/");
  const fragrance = getFragranceBySlug(rawSlug, sp.fixture === "golden");
  if (!fragrance) return { title: "Fragrance Not Found — Raphragrance" };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://raphragrance.com";
  const canonicalUrl = `${baseUrl}/fragrance/${fragrance.slug}`;
  const title = `${fragrance.name} by ${fragrance.brand} — Raphragrance`;
  const description = fragrance.description
    ? fragrance.description.slice(0, 160)
    : `${fragrance.name} is a ${fragrance.gender || "unisex"} fragrance launched by ${fragrance.brand} in ${fragrance.year || "unknown"}. Explore notes, accords, ratings, and similar fragrances.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      images: fragrance.imageUrl ? [{ url: fragrance.imageUrl, alt: `${fragrance.brand} ${fragrance.name}` }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: fragrance.imageUrl ? [fragrance.imageUrl] : [],
    },
  };
}

export default async function FragranceDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const useGolden = sp.fixture === "golden";

  const rawSlug = slug.join("/");
  const fragrance = getFragranceBySlug(rawSlug, useGolden);

  if (!fragrance) {
    notFound();
  }

  const topAccord = fragrance.accords && fragrance.accords.length > 0 ? fragrance.accords[0].name : null;
  const [fill, ink] = getColorPair(topAccord);

  const cleaned = fragrance.name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const initials = words.length === 0 ? "" : words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();

  const style = {
    "--c": fill,
    "--i": ink,
  } as CSSProperties;

  const genderLabel =
    fragrance.gender === "male"
      ? "Men"
      : fragrance.gender === "female"
      ? "Women"
      : "Unisex";

  const similar = getSimilarFragrances(fragrance, 10);

  const [wScore, spScore, suScore, faScore] = normalizeSeasons(fragrance.seasons);

  const seasonsList = [
    { label: "Winter", score: wScore },
    { label: "Spring", score: spScore },
    { label: "Summer", score: suScore },
    { label: "Fall", score: faScore },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: fragrance.name,
    brand: {
      "@type": "Brand",
      name: fragrance.brand,
    },
    description: fragrance.description || `${fragrance.name} by ${fragrance.brand}`,
    image: fragrance.imageUrl || undefined,
    ...(fragrance.rating && fragrance.voteCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: fragrance.rating.toFixed(2),
            ratingCount: fragrance.voteCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };

  return (
    <>
      <link rel="preconnect" href="https://fimgs.net" />
      <link rel="dns-prefetch" href="https://fimgs.net" />
      {fragrance.imageUrl && (
        <link
          rel="preload"
          as="image"
          href={fragrance.imageUrl}
          fetchPriority="high"
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />

      <main id="main-content">
        {/* Hero */}
        <section className="hero" style={style}>
        <div>
          <Link href="/" className="back" prefetch={false}>
            ← All fragrances
          </Link>
          <div className="br">
            <Link href={`/brand/${encodeURIComponent(fragrance.brand)}`} prefetch={false}>
              {fragrance.brand}
            </Link>
          </div>
          <h1>{fragrance.name}</h1>
          <div className="sub">
            {genderLabel} · {fragrance.year ?? "Unknown"}
          </div>
        </div>

        <div className="im">
          {fragrance.imageUrl ? (
            <img
              src={fragrance.imageUrl}
              alt={`${fragrance.brand} ${fragrance.name} bottle`}
              width={280}
              height={373}
              referrerPolicy="no-referrer"
              fetchPriority="high"
              loading="eager"
              decoding="sync"
            />
          ) : null}
          <div
            className="im-fallback"
            style={{
              display: fragrance.imageUrl ? "none" : "flex",
              background: fill,
              color: ink,
            }}
            aria-hidden="true"
          >
            <span className="im-initials">{initials}</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="wrap">
        {/* Stats */}
        <div className="stats" role="region" aria-label="Fragrance stats">
          <div className="stat">
            <div className="l">Rating</div>
            <div className="n">{fragrance.rating ? fragrance.rating.toFixed(2) : "—"}</div>
            <div className="s">{formatVotes(fragrance.voteCount)} votes</div>
          </div>
          <div className="stat">
            <div className="l">Longevity</div>
            <div className="n">{fragrance.longevity ? fragrance.longevity.toFixed(1) : "—"}</div>
            <div className="s">{lonL(fragrance.longevity)}</div>
          </div>
          <div className="stat">
            <div className="l">Sillage</div>
            <div className="n">{fragrance.sillage ? fragrance.sillage.toFixed(1) : "—"}</div>
            <div className="s">{silL(fragrance.sillage)}</div>
          </div>
          <div className="stat">
            <div className="l">Released</div>
            <div className="n">{fragrance.year ?? "—"}</div>
            <div className="s">{genderLabel}</div>
          </div>
        </div>

        {/* Two Columns: Main Accords (Left) and Notes (Right) */}
        <div className="two">
          {/* Main Accords */}
          <section className="sec" aria-labelledby="main-accords-title">
            <h2 id="main-accords-title">Main accords</h2>
            {fragrance.accords && fragrance.accords.length > 0 ? (
              fragrance.accords.map((a) => {
                const [accFill] = getColorPair(a.name);
                return (
                  <div key={a.name} className="ar">
                    <div
                      className="sw"
                      style={{ "--c": accFill } as CSSProperties}
                      aria-hidden="true"
                    />
                    <div className="an">{a.name}</div>
                    <div className="ap">{a.strength}%</div>
                    <div className="tr">
                      <s style={{ width: `${a.strength}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: "var(--mu)", fontStyle: "italic" }}>
                No accords recorded.
              </div>
            )}
          </section>

          {/* Notes Pyramid */}
          <section className="sec" aria-labelledby="note-pyramid-title">
            <h2 id="note-pyramid-title">Note pyramid</h2>
            {fragrance.notes &&
            (fragrance.notes.top.length > 0 ||
              fragrance.notes.heart.length > 0 ||
              fragrance.notes.base.length > 0) ? (
              <>
                {fragrance.notes.top.length > 0 && (
                  <div className="band t" style={style}>
                    <span className="bl">Top</span>
                    <span className="bn">
                      {fragrance.notes.top.map((note, i) => (
                        <span key={note}>
                          {i > 0 && <em> / </em>}
                          {note}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {fragrance.notes.heart.length > 0 && (
                  <div className="band h" style={style}>
                    <span className="bl">Heart</span>
                    <span className="bn">
                      {fragrance.notes.heart.map((note, i) => (
                        <span key={note}>
                          {i > 0 && <em> / </em>}
                          {note}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {fragrance.notes.base.length > 0 && (
                  <div className="band b" style={style}>
                    <span className="bl">Base</span>
                    <span className="bn">
                      {fragrance.notes.base.map((note, i) => (
                        <span key={note}>
                          {i > 0 && <em> / </em>}
                          {note}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </>
            ) : fragrance.notes?.flat && fragrance.notes.flat.length > 0 ? (
              <div className="band b" style={style}>
                <span className="bl">Notes</span>
                <span className="bn">
                  {fragrance.notes.flat.map((note, i) => (
                    <span key={note}>
                      {i > 0 && <em> / </em>}
                      {note}
                    </span>
                  ))}
                </span>
              </div>
            ) : (
              <div style={{ color: "var(--mu)", fontStyle: "italic" }}>
                No pyramid notes recorded.
              </div>
            )}
          </section>
        </div>

        {/* Season */}
        <section className="sec" aria-labelledby="season-title">
          <h2 id="season-title">Season</h2>
          <div className="seas">
            {seasonsList.map((seas) => {
              const heightPct = Math.min(100, Math.max(0, (seas.score / 4) * 100));
              return (
                <div key={seas.label}>
                  <div className="l">{seas.label}</div>
                  <div className="bx">
                    <i style={{ height: `${heightPct}%`, "--c": fill } as CSSProperties} />
                  </div>
                  <div className="v">{seas.score.toFixed(1)}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Similar */}
        {similar.length > 0 && (
          <section className="sec" aria-labelledby="similar-title">
            <div className="sec-header">
              <h2 id="similar-title">Similar</h2>
            </div>
            <div className="sim">
              {similar.map((f) => {
                let metaLine = "Similar olfactory profile";
                if (f.similaritySource === "curated") {
                  metaLine = "Curated pick";
                } else if (f.similaritySource === "community") {
                  metaLine = "Community pick";
                } else if (f.similaritySource === "content") {
                  if (f.sharedNotes && f.sharedNotes.length > 0) {
                    metaLine = `Shares: ${f.sharedNotes.slice(0, 3).join(", ")}`;
                  }
                }

                return (
                  <div key={f.id} className="sim-cell">
                    <FragranceTile fragrance={f} />
                    <div className="tile-sim-meta" title={metaLine}>
                      {metaLine}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
      </main>

      <Footer />
    </>
  );
}
