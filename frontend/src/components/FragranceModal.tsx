"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Fragrance, FragranceNote } from "@/types/fragrance";

interface Props {
  fragrance: Fragrance;
  onClose: () => void;
}

const LONGEVITY_MAP: Record<string, number> = {
  "Very Weak": 10, "Weak": 25, "Moderate": 50, "Long Lasting": 75, "Very Long Lasting": 90, "Eternal": 100,
};

const SILLAGE_MAP: Record<string, number> = {
  "Intimate": 15, "Moderate": 40, "Strong": 65, "Enormous": 90,
};

const SEASON_ICONS: Record<string, string> = {
  spring: "🌸", summer: "☀️", fall: "🍂", winter: "❄️",
};

const DAY_NIGHT_ICONS: Record<string, string> = {
  day: "☀️", night: "🌙",
};

function NoteTag({ note }: { note: FragranceNote | string }) {
  const name = typeof note === "string" ? note : note.name;
  const desc = typeof note === "object" ? note.description : undefined;
  return (
    <span
      title={desc}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "0.62rem",
        fontWeight: 400,
        letterSpacing: "0.04em",
        padding: "0.3rem 0.7rem",
        background: "var(--bg-overlay)",
        border: "1px solid var(--bg-border)",
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
        cursor: desc ? "help" : "default",
        borderRadius: "2px",
        transition: "border-color 0.2s, color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(201,144,58,0.3)";
        e.currentTarget.style.color = "var(--amber-light)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--bg-border)";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      {name}
    </span>
  );
}

function PerformanceBar({ label, value, color = "var(--amber)" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.62rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          minWidth: "5.5rem",
        }}
      >
        {label}
      </span>
      <div className="perf-bar-track" style={{ flex: 1 }}>
        <div className="perf-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.62rem",
          color: "var(--text-secondary)",
          minWidth: "2.5rem",
          textAlign: "right",
        }}
      >
        {value}%
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "0.58rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: "0.75rem",
      }}
    >
      {children}
    </p>
  );
}

export default function FragranceModal({ fragrance, onClose }: Props) {
  const [imgError, setImgError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const imgSrc = !imgError
    ? fragrance["Image URL Transparent"] || fragrance["Image URL"] || null
    : null;

  const longevityPct = LONGEVITY_MAP[fragrance.Longevity ?? ""] ?? 0;
  const sillagePct = SILLAGE_MAP[fragrance.Sillage ?? ""] ?? 0;

  // Only show seasons that genuinely apply to this fragrance (threshold >= 2.0 or top season with votes)
  const rawSeasons = [...(fragrance["Season Ranking"] ?? [])].sort((a, b) => b.score - a.score);
  const applicableSeasons = rawSeasons.filter((s) => s.score >= 2.0);
  const seasonsToShow =
    applicableSeasons.length > 0
      ? applicableSeasons
      : rawSeasons.slice(0, 1).filter((s) => s.score > 0);

  const dayNightList = fragrance["Day Night"] ?? [];

  return (
    <div
      id="fragrance-modal-overlay"
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        id="fragrance-modal-panel"
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${fragrance.Name} details`}
      >
        {/* Mobile drag handle */}
        <div
          style={{
            display: "none",
            width: "36px",
            height: "4px",
            background: "var(--bg-border)",
            borderRadius: "2px",
            margin: "0.75rem auto 0",
          }}
          className="mobile-handle"
        />

        {/* Close */}
        <button
          id="modal-close"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--bg-border)",
            borderRadius: "50%",
            cursor: "pointer",
            color: "var(--text-secondary)",
            zIndex: 10,
            padding: "0.5rem",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s, color 0.2s",
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            minHeight: "60vh",
          }}
          className="modal-inner-grid"
        >
          {/* Left: image */}
          <div
            style={{
              background: "var(--bg-elevated)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "3rem 2rem 2rem",
              position: "relative",
              minHeight: "360px",
              borderRight: "1px solid var(--bg-border)",
            }}
          >
            {imgSrc ? (
              <div style={{ position: "relative", width: "100%", height: "320px" }}>
                <Image
                  src={imgSrc}
                  alt={`${fragrance.Name} by ${fragrance.Brand}`}
                  fill
                  sizes="340px"
                  style={{ objectFit: "contain" }}
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div
                style={{
                  width: "100px",
                  height: "160px",
                  background: "var(--bg-overlay)",
                  borderRadius: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="40" height="60" viewBox="0 0 64 96" fill="none" style={{ opacity: 0.15 }}>
                  <rect x="20" y="0" width="24" height="12" rx="2" fill="var(--amber)" />
                  <rect x="8" y="12" width="48" height="84" rx="4" fill="var(--text-secondary)" />
                </svg>
              </div>
            )}

            {/* Season & Time of Day badges */}
            {(seasonsToShow.length > 0 || dayNightList.length > 0) && (
              <div
                style={{
                  marginTop: "1.25rem",
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {/* Seasons */}
                {seasonsToShow.map((s) => (
                  <span
                    key={s.name}
                    className="badge badge--stone"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      textTransform: "capitalize",
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.62rem",
                      border: "1px solid var(--bg-border)",
                    }}
                  >
                    <span>{SEASON_ICONS[s.name.toLowerCase()] || ""}</span>
                    <span>{s.name}</span>
                  </span>
                ))}

                {/* Day / Night */}
                {dayNightList.map((t) => (
                  <span
                    key={t.name}
                    className="badge badge--amber"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.62rem",
                    }}
                  >
                    <span>{DAY_NIGHT_ICONS[t.name.toLowerCase()] || ""}</span>
                    <span>{t.name}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Popularity */}
            {fragrance.Popularity && (
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  marginTop: "1rem",
                  letterSpacing: "0.08em",
                }}
              >
                {fragrance.Popularity}
              </p>
            )}
          </div>

          {/* Right: details */}
          <div
            style={{
              padding: "2.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "2rem",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.58rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--amber)",
                  marginBottom: "0.5rem",
                }}
              >
                {fragrance.Brand}
                {fragrance.Year && ` · ${fragrance.Year}`}
                {fragrance.Country && ` · ${fragrance.Country}`}
              </p>
              <h2
                className="font-serif"
                style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1 }}
              >
                {fragrance.Name}
              </h2>

              {/* Meta row */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginTop: "0.75rem",
                  alignItems: "center",
                }}
              >
                {fragrance.rating && (
                  <span className="badge badge--amber">
                    ★ {parseFloat(fragrance.rating.toString()).toFixed(2)}
                  </span>
                )}
                {fragrance.Gender && (
                  <span className="badge badge--stone">{fragrance.Gender}</span>
                )}
                {fragrance.OilType && (
                  <span className="badge badge--stone">{fragrance.OilType}</span>
                )}
              </div>
            </div>

            {/* Accords */}
            {(fragrance["Main Accords"] ?? []).length > 0 && (
              <div>
                <SectionTitle>Main Accords</SectionTitle>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {fragrance["Main Accords"]!.map((accord) => (
                    <span key={accord} className="tag">
                      {accord}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Note Pyramid */}
            <div>
              <SectionTitle>Fragrance Pyramid</SectionTitle>
              <div
                style={{
                  border: "1px solid var(--bg-border)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {/* Top notes */}
                <div className="pyramid-tier" style={{ background: "rgba(201,144,58,0.04)" }}>
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "var(--amber)",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  />
                  <span className="pyramid-label">Top</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {(fragrance.Notes?.Top ?? fragrance["General Notes"]?.slice(0, 3) ?? []).map(
                      (n, i) => <NoteTag key={i} note={n} />
                    )}
                  </div>
                </div>

                {/* Heart notes */}
                <div className="pyramid-tier" style={{ background: "rgba(156,149,135,0.04)" }}>
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "var(--text-secondary)",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  />
                  <span className="pyramid-label">Heart</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {(fragrance.Notes?.Heart ?? fragrance["General Notes"]?.slice(3, 6) ?? []).map(
                      (n, i) => <NoteTag key={i} note={n} />
                    )}
                  </div>
                </div>

                {/* Base notes */}
                <div className="pyramid-tier" style={{ background: "rgba(13,13,11,0.3)" }}>
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "var(--text-muted)",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  />
                  <span className="pyramid-label">Base</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {(fragrance.Notes?.Base ?? fragrance["General Notes"]?.slice(6) ?? []).map(
                      (n, i) => <NoteTag key={i} note={n} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance */}
            {(longevityPct > 0 || sillagePct > 0) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <SectionTitle>Performance</SectionTitle>
                <PerformanceBar label="Longevity" value={longevityPct} />
                <PerformanceBar label="Sillage" value={sillagePct} />
              </div>
            )}

          </div>
        </div>

        <style>{`
          @media (max-width: 640px) {
            .modal-inner-grid {
              grid-template-columns: 1fr !important;
            }
            .modal-handle {
              display: block !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
