import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
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

  const similar = getSimilarFragrances(fragrance, 3);

  const [wScore, spScore, suScore, faScore] = normalizeSeasons(fragrance.seasons);

  const seasonsList = [
    { label: "Winter", score: wScore },
    { label: "Spring", score: spScore },
    { label: "Summer", score: suScore },
    { label: "Fall", score: faScore },
  ];

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
      <Nav />

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
            <>
              <img
                src={fragrance.imageUrl}
                alt={`${fragrance.brand} ${fragrance.name} bottle`}
                width={280}
                height={373}
                fetchPriority="high"
                loading="eager"
                decoding="sync"
              />
              <BottleSvg />
            </>
          ) : (
            <BottleSvg />
          )}
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
            <h2 id="similar-title">Similar</h2>
            <div className="sim">
              {similar.map((f) => (
                <FragranceTile key={f.id} fragrance={f} />
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </>
  );
}
