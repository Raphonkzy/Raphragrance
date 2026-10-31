"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { Fragrance } from "@/types";
import { fragranceHref } from "@/lib/format";

interface Props {
  fragrance: Fragrance;
  onClick: (f: Fragrance) => void;
  priority?: boolean;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Men",
  female: "Women",
  unisex: "Unisex",
};

function FragranceCard({ fragrance: f, onClick, priority = false }: Props) {
  const [imgErr, setImgErr] = useState(false);

  const totalStrength = f.accords.reduce((s, a) => s + a.strength, 0) || 1;

  return (
    <article
      className="frag-card"
      onClick={() => onClick(f)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick(f)}
      tabIndex={0}
      role="button"
      aria-label={`${f.name} by ${f.brand}`}
    >
      {/* Image */}
      <div className="frag-card__image" style={{ aspectRatio: "3/4" }}>
        {!imgErr ? (
          <Image
            src={f.imageUrl}
            alt={`${f.name} by ${f.brand}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            style={{ objectFit: "contain" }}
            loading={priority ? "eager" : "lazy"}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="40"
              height="60"
              viewBox="0 0 64 96"
              fill="none"
              aria-hidden
              style={{ opacity: 0.15 }}
            >
              <rect x="20" y="0" width="24" height="12" rx="2" fill="var(--accent)" />
              <rect x="8" y="12" width="48" height="84" rx="3" fill="var(--text-secondary)" />
              <rect x="18" y="28" width="28" height="1" fill="var(--bg-border)" opacity="0.6" />
            </svg>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="frag-card__body">
        <div className="frag-card__brand">{f.brand}</div>
        <div className="frag-card__name">{f.name}</div>
        <div className="frag-card__meta">
          <span className="frag-card__rating">
            {f.rating !== null ? (
              <>
                <span style={{ color: "var(--accent)", marginRight: 2 }}>★</span>
                {f.rating.toFixed(2)}
              </>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>—</span>
            )}
          </span>
          <span className="frag-card__gender">
            {GENDER_LABEL[f.gender] ?? f.gender}
            {f.year ? ` · ${f.year}` : ""}
          </span>
        </div>

        {/* Proportional accord strip */}
        {f.accords.length > 0 && (
          <div className="frag-card__accords" aria-hidden>
            {f.accords.slice(0, 5).map((a) => (
              <div
                key={a.name}
                className="frag-card__accord-seg"
                style={{
                  flex: a.strength / totalStrength,
                  opacity: 0.35 + (a.strength / 100) * 0.65,
                }}
                title={`${a.name} ${a.strength}%`}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(FragranceCard);
