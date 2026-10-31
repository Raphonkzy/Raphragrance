"use client";

import {
  longevityLabel,
  longevityPct,
  sillageLabel,
  sillagePct,
  normalizeSeasons,
  normalizeDayNight,
  formatVotes,
} from "@/lib/format";
import { Fragrance } from "@/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface Props {
  fragrance: Fragrance;
  onClose: () => void;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Men",
  female: "Women",
  unisex: "Unisex",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.6rem",
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: "0.75rem",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid var(--bg-border)",
      }}
    >
      {children}
    </div>
  );
}

export default function FragranceDetail({ fragrance: f, onClose }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const seasons = normalizeSeasons(f.seasons);
  const dayNight = normalizeDayNight(f.timeOfDay);
  const longPct = longevityPct(f.longevity);
  const silPct = sillagePct(f.sillage);
  const allNotes = [...f.notes.top, ...f.notes.heart, ...f.notes.base, ...f.notes.flat];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`${f.name} details`}
    >
      <div className="modal-panel">
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "0.875rem",
            right: "0.875rem",
            zIndex: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--bg-border)",
            borderRadius: "3px",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            cursor: "pointer",
            transition: "all 0.12s",
            minHeight: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-overlay)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Mobile drag handle */}
        <div
          style={{
            width: 36, height: 4,
            background: "var(--bg-border)",
            borderRadius: 2,
            margin: "0.75rem auto 0",
          }}
          className="modal-drag-handle"
          aria-hidden
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
          }}
          className="detail-grid"
        >
          {/* Left: image + quick stats */}
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRight: "1px solid var(--bg-border)",
              padding: "2rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              alignItems: "center",
            }}
          >
            {/* Image */}
            <div style={{ position: "relative", width: "100%", height: 260 }}>
              {!imgErr ? (
                <Image
                  src={f.imageUrl}
                  alt={`${f.name} by ${f.brand}`}
                  fill
                  sizes="300px"
                  style={{ objectFit: "contain" }}
                  priority
                  onError={() => setImgErr(true)}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="60" height="90" viewBox="0 0 64 96" fill="none" aria-hidden style={{ opacity: 0.15 }}>
                    <rect x="20" y="0" width="24" height="12" rx="2" fill="var(--accent)" />
                    <rect x="8" y="12" width="48" height="84" rx="3" fill="var(--text-secondary)" />
                  </svg>
                </div>
              )}
            </div>

            {/* Quick metadata */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {f.rating !== null && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Rating</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ color: "var(--accent)" }}>★</span> {f.rating.toFixed(2)}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Votes</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {formatVotes(f.voteCount)}
                </span>
              </div>
              {f.year && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Year</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-primary)" }}>{f.year}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Gender</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--text-primary)" }}>{GENDER_LABEL[f.gender] ?? f.gender}</span>
              </div>
              {f.perfumers.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>By</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-secondary)", textAlign: "right" }}>{f.perfumers.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Season grid */}
            {seasons.some(s => s.votes > 0) && (
              <div style={{ width: "100%" }}>
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
              <div style={{ width: "100%", display: "flex", gap: "0.5rem" }}>
                {dayNight.map((d) => (
                  <div
                    key={d.name}
                    style={{
                      flex: d.pct,
                      background: "var(--bg-overlay)",
                      border: "1px solid var(--bg-border)",
                      borderRadius: 2,
                      padding: "0.5rem 0.6rem",
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{d.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{d.pct}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: detail content */}
          <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.75rem", overflowY: "auto", maxHeight: "90vh" }}>
            {/* Header */}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.4rem" }}>
                {f.brand}
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)",
                  fontWeight: 400,
                  lineHeight: 1.1,
                  color: "var(--text-primary)",
                  marginBottom: "0.75rem",
                }}
              >
                {f.name}
              </h2>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <span className="badge badge--blue">{GENDER_LABEL[f.gender] ?? f.gender}</span>
                {f.year && <span className="badge badge--neutral">{f.year}</span>}
              </div>
            </div>

            {/* Description */}
            {f.description && (
              <div>
                <SectionHeading>Description</SectionHeading>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>
                  {f.description}
                </p>
              </div>
            )}

            {/* Accords */}
            {f.accords.length > 0 && (
              <div>
                <SectionHeading>Accord Analysis</SectionHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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
            {allNotes.length > 0 && (
              <div>
                <SectionHeading>Fragrance Pyramid</SectionHeading>
                <div className="note-pyramid">
                  {f.notes.top.length > 0 && (
                    <div className="pyramid-zone pyramid-zone--top">
                      <div className="pyramid-zone__label">Top</div>
                      <div className="pyramid-zone__notes">
                        {f.notes.top.map((n) => (
                          <span key={n} className="tag">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.notes.heart.length > 0 && (
                    <div className="pyramid-zone pyramid-zone--heart">
                      <div className="pyramid-zone__label">Heart</div>
                      <div className="pyramid-zone__notes">
                        {f.notes.heart.map((n) => (
                          <span key={n} className="tag">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.notes.base.length > 0 && (
                    <div className="pyramid-zone pyramid-zone--base">
                      <div className="pyramid-zone__label">Base</div>
                      <div className="pyramid-zone__notes">
                        {f.notes.base.map((n) => (
                          <span key={n} className="tag">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.notes.top.length === 0 && f.notes.heart.length === 0 && f.notes.base.length === 0 && f.notes.flat.length > 0 && (
                    <div className="pyramid-zone pyramid-zone--heart">
                      <div className="pyramid-zone__label">Notes</div>
                      <div className="pyramid-zone__notes">
                        {f.notes.flat.map((n) => (
                          <span key={n} className="tag">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Performance */}
            {(f.longevity !== null || f.sillage !== null) && (
              <div>
                <SectionHeading>Performance</SectionHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {f.longevity !== null && (
                    <div className="gauge-row">
                      <div className="gauge-label">Longevity</div>
                      <div className="gauge-track">
                        <div className="gauge-fill" style={{ width: `${longPct}%` }} />
                      </div>
                      <div className="gauge-value">{longevityLabel(f.longevity)}</div>
                    </div>
                  )}
                  {f.sillage !== null && (
                    <div className="gauge-row">
                      <div className="gauge-label">Sillage</div>
                      <div className="gauge-track">
                        <div className={`gauge-fill${silPct > 70 ? " gauge-fill--high" : ""}`} style={{ width: `${silPct}%` }} />
                      </div>
                      <div className="gauge-value">{sillageLabel(f.sillage)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No data state */}
            {allNotes.length === 0 && f.accords.length === 0 && (
              <div style={{ padding: "2rem 0", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                No note or accord data available for this fragrance.
              </div>
            )}
          </div>
        </div>

        <style>{`
          @media (max-width: 640px) {
            .detail-grid { grid-template-columns: 1fr !important; }
            .modal-drag-handle { display: block; }
          }
          .modal-drag-handle { display: none; }
        `}</style>
      </div>
    </div>
  );
}
