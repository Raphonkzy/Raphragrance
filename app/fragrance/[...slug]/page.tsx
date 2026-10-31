import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import { Fragrance } from "@/types";
import {
  longevityLabel,
  longevityPct,
  sillageLabel,
  sillagePct,
  normalizeSeasons,
  normalizeDayNight,
  formatVotes,
} from "@/lib/format";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

const ALL: Fragrance[] = fixtureData as Fragrance[];

export function generateStaticParams() {
  return ALL.map((f) => ({ slug: String(f.slug || f.id).split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const slugStr = slug.join("/");
  const f = ALL.find((x) => String(x.slug) === slugStr || String(x.id) === slugStr);
  if (!f) return { title: "Not found" };
  return {
    title: `${f.name} by ${f.brand}`,
    description: f.description || `${f.name} by ${f.brand}. Notes, accords, and performance data.`,
  };
}

export default async function FragrancePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const slugStr = slug.join("/");
  const f = ALL.find((x) => String(x.slug) === slugStr || String(x.id) === slugStr);
  if (!f) notFound();

  const seasons = normalizeSeasons(f.seasons);
  const dayNight = normalizeDayNight(f.timeOfDay);
  const longPct = longevityPct(f.longevity);
  const silPct = sillagePct(f.sillage);

  const GENDER_LABEL: Record<string, string> = { male: "Men", female: "Women", unisex: "Unisex" };

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 52 }}>
        <div
          style={{
            borderBottom: "1px solid var(--bg-border)",
            background: "var(--bg-surface)",
            padding: "0.75rem 0",
          }}
        >
          <div className="container">
            <nav aria-label="Breadcrumb" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Catalog</Link>
              <span aria-hidden>/</span>
              <Link href={`/brand/${encodeURIComponent(f.brand)}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{f.brand}</Link>
              <span aria-hidden>/</span>
              <span>{f.name}</span>
            </nav>
          </div>
        </div>

        <div className="container" style={{ paddingBlock: "2.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "3rem" }} className="frag-page-grid">
            {/* Left: image + quick data */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 3,
                  padding: "1.5rem",
                  position: "relative",
                }}
              >
                <div style={{ position: "relative", width: "100%", aspectRatio: "3/4" }}>
                  <Image
                    src={f.imageUrl}
                    alt={`${f.name} by ${f.brand}`}
                    fill
                    sizes="280px"
                    style={{ objectFit: "contain" }}
                    priority
                  />
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ border: "1px solid var(--bg-border)", borderRadius: 3, overflow: "hidden" }}>
                {[
                  { label: "Rating", value: f.rating !== null ? `★ ${f.rating.toFixed(2)}` : "—" },
                  { label: "Votes", value: formatVotes(f.voteCount) },
                  { label: "Year", value: f.year ? String(f.year) : "—" },
                  { label: "Gender", value: GENDER_LABEL[f.gender] ?? f.gender },
                  { label: "Longevity", value: longevityLabel(f.longevity) },
                  { label: "Sillage", value: sillageLabel(f.sillage) },
                ].map(({ label, value }, i) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.6rem 0.875rem",
                      borderTop: i > 0 ? "1px solid var(--bg-border)" : "none",
                      background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-elevated)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Season */}
              {seasons.some((s) => s.votes > 0) && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Season</div>
                  <div className="season-grid">
                    {seasons.map((s) => (
                      <div key={s.name} className="season-tile">
                        <div className="season-tile__fill" style={{ height: `${s.pct}%` }} aria-hidden />
                        <div className="season-tile__content">
                          <div className="season-tile__name">{s.name}</div>
                          <div className="season-tile__pct">{s.pct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day / Night */}
              {dayNight.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {dayNight.map((d) => (
                    <div key={d.name} style={{ flex: d.pct, background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", borderRadius: 2, padding: "0.6rem 0.75rem" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{d.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{d.pct}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: main content */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Header */}
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.5rem" }}>
                  <Link href={`/brand/${encodeURIComponent(f.brand)}`} style={{ color: "inherit", textDecoration: "none" }}>{f.brand}</Link>
                </div>
                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.05, color: "var(--text-primary)", marginBottom: "0.875rem" }}>
                  {f.name}
                </h1>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span className="badge badge--blue">{GENDER_LABEL[f.gender]}</span>
                  {f.year && <span className="badge badge--neutral">{f.year}</span>}
                  {f.perfumers.length > 0 && (
                    <span className="badge badge--neutral">By {f.perfumers.join(", ")}</span>
                  )}
                </div>
              </div>

              {/* Description */}
              {f.description && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--bg-border)" }}>Description</div>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", lineHeight: 1.75, color: "var(--text-secondary)" }}>{f.description}</p>
                </div>
              )}

              {/* Accord analysis */}
              {f.accords.length > 0 && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--bg-border)" }}>Accord Analysis</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {f.accords.map((a) => (
                      <div key={a.name} className="accord-row">
                        <div className="accord-row__name">{a.name}</div>
                        <div className="accord-row__track">
                          <div className="accord-row__fill" style={{ width: `${a.strength}%` }} />
                        </div>
                        <div className="accord-row__pct">{a.strength}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Note pyramid */}
              {(f.notes.top.length > 0 || f.notes.heart.length > 0 || f.notes.base.length > 0 || f.notes.flat.length > 0) && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--bg-border)" }}>Fragrance Pyramid</div>
                  <div className="note-pyramid">
                    {f.notes.top.length > 0 && (
                      <div className="pyramid-zone pyramid-zone--top">
                        <div className="pyramid-zone__label">Top</div>
                        <div className="pyramid-zone__notes">{f.notes.top.map((n) => <span key={n} className="tag">{n}</span>)}</div>
                      </div>
                    )}
                    {f.notes.heart.length > 0 && (
                      <div className="pyramid-zone pyramid-zone--heart">
                        <div className="pyramid-zone__label">Heart</div>
                        <div className="pyramid-zone__notes">{f.notes.heart.map((n) => <span key={n} className="tag">{n}</span>)}</div>
                      </div>
                    )}
                    {f.notes.base.length > 0 && (
                      <div className="pyramid-zone pyramid-zone--base">
                        <div className="pyramid-zone__label">Base</div>
                        <div className="pyramid-zone__notes">{f.notes.base.map((n) => <span key={n} className="tag">{n}</span>)}</div>
                      </div>
                    )}
                    {f.notes.top.length === 0 && f.notes.heart.length === 0 && f.notes.base.length === 0 && f.notes.flat.length > 0 && (
                      <div className="pyramid-zone pyramid-zone--heart">
                        <div className="pyramid-zone__label">Notes</div>
                        <div className="pyramid-zone__notes">{f.notes.flat.map((n) => <span key={n} className="tag">{n}</span>)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Performance */}
              {(f.longevity !== null || f.sillage !== null) && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--bg-border)" }}>Performance</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {f.longevity !== null && (
                      <div className="gauge-row">
                        <div className="gauge-label">Longevity</div>
                        <div className="gauge-track"><div className="gauge-fill" style={{ width: `${longPct}%` }} /></div>
                        <div className="gauge-value">{longevityLabel(f.longevity)}</div>
                      </div>
                    )}
                    {f.sillage !== null && (
                      <div className="gauge-row">
                        <div className="gauge-label">Sillage</div>
                        <div className="gauge-track"><div className={`gauge-fill${silPct > 70 ? " gauge-fill--high" : ""}`} style={{ width: `${silPct}%` }} /></div>
                        <div className="gauge-value">{sillageLabel(f.sillage)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .frag-page-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
