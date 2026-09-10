"use client";

import Image from "next/image";
import { useState, memo } from "react";
import { Fragrance } from "@/types/fragrance";

interface Props {
  fragrance: Fragrance;
  onOpenDetail: (f: Fragrance) => void;
}

const FragranceCard = memo(function FragranceCard({ fragrance, onOpenDetail }: Props) {
  const [imgError, setImgError] = useState(false);

  const imgSrc =
    !imgError && fragrance["Image URL Transparent"]
      ? fragrance["Image URL Transparent"]
      : !imgError && fragrance["Image URL"]
      ? fragrance["Image URL"]
      : null;

  const topAccords = (fragrance["Main Accords"] ?? []).slice(0, 3);
  const rating = fragrance.rating;

  return (
    <article
      className="frag-card"
      onClick={() => onOpenDetail(fragrance)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpenDetail(fragrance)}
      aria-label={`View details for ${fragrance.Name} by ${fragrance.Brand}`}
      style={{ display: "flex", flexDirection: "column", borderRadius: "4px" }}
    >
      {/* Image */}
      <div
        className="frag-card__image-wrap"
        style={{ aspectRatio: "3/4", width: "100%" }}
      >
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={`${fragrance.Name} by ${fragrance.Brand}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
            style={{ objectFit: "contain" }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          /* Placeholder silhouette */
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-elevated)",
            }}
          >
            <svg width="52" height="78" viewBox="0 0 64 96" fill="none" style={{ opacity: 0.15 }}>
              <rect x="20" y="0" width="24" height="12" rx="2" fill="var(--amber)" />
              <rect x="8" y="12" width="48" height="84" rx="4" fill="var(--text-secondary)" />
              <rect x="16" y="28" width="32" height="1" fill="var(--bg-base)" />
              <rect x="16" y="44" width="32" height="1" fill="var(--bg-base)" />
            </svg>
          </div>
        )}

        {/* Oil type badge: top-left */}
        {fragrance.OilType && (
          <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem" }}>
            <span className="badge badge--stone">{fragrance.OilType}</span>
          </div>
        )}

        {/* Rating badge: top-right */}
        {rating && (
          <div style={{ position: "absolute", top: "0.6rem", right: "0.6rem" }}>
            <span
              className="badge badge--amber"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              ★ {parseFloat(rating.toString()).toFixed(1)}
            </span>
          </div>
        )}

        {/* Accord tags: revealed on hover */}
        <div
          className="frag-card__accords"
          style={{
            position: "absolute",
            bottom: "0.6rem",
            left: "0.6rem",
            right: "0.6rem",
            display: "flex",
            gap: "0.3rem",
            flexWrap: "wrap",
            opacity: 0,
            transform: "translateY(4px)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
          }}
        >
          {topAccords.map((accord) => (
            <span key={accord} className="tag">
              {accord}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div
        style={{
          padding: "1rem 0.875rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          flex: 1,
        }}
      >
        {/* Brand */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.58rem",
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--amber)",
          }}
        >
          {fragrance.Brand}
        </p>

        {/* Name */}
        <h3
          className="font-serif"
          style={{
            fontSize: "1rem",
            fontWeight: 400,
            color: "var(--text-primary)",
            lineHeight: 1.25,
          }}
        >
          {fragrance.Name}
        </h3>

        {/* Gender & Year */}
        {(fragrance.Gender || fragrance.Year) && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.62rem",
              color: "var(--text-muted)",
              marginTop: "auto",
              paddingTop: "0.5rem",
            }}
          >
            {[fragrance.Gender, fragrance.Year].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
});

export default FragranceCard;
