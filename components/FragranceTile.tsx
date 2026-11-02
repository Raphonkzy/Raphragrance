import Link from "next/link";
import type { CSSProperties } from "react";
import type { Fragrance, CatalogFragrance } from "../lib/types";
import { getColorPair } from "../lib/palette";

export function BottleSvg() {
  return (
    <svg viewBox="0 0 60 90" aria-hidden="true">
      <rect x="22" y="4" width="16" height="10" rx="2" />
      <rect x="26" y="14" width="8" height="8" />
      <rect x="10" y="22" width="40" height="62" rx="12" />
    </svg>
  );
}

function getInitials(name: string): string {
  if (!name) return "";
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface FragranceTileProps {
  fragrance: CatalogFragrance | Fragrance;
  priority?: boolean;
}

export function FragranceTile({ fragrance, priority = false }: FragranceTileProps) {
  const topAccord = fragrance.accords && fragrance.accords.length > 0 ? fragrance.accords[0].name : null;
  const [fill, ink] = getColorPair(topAccord);
  const initials = getInitials(fragrance.name);

  const style = {
    "--c": fill,
    "--i": ink,
  } as CSSProperties;

  const top3Accords = (fragrance.accords || [])
    .slice(0, 3)
    .map((a) => a.name)
    .join(" · ");

  const ratingStr = fragrance.rating ? fragrance.rating.toFixed(2) : "—";

  return (
    <Link
      href={`/fragrance/${fragrance.slug}`}
      className="tile"
      style={style}
      aria-label={`${fragrance.name} by ${fragrance.brand}`}
      prefetch={false}
    >
      <div className="im">
        {fragrance.imageUrl ? (
          <img
            src={fragrance.imageUrl}
            alt={`${fragrance.brand} ${fragrance.name} bottle`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "low"}
            decoding={priority ? "sync" : "async"}
            referrerPolicy="no-referrer"
            width={250}
            height={333}
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

      <div className="lb">
        <div className="r1">
          <span className="br" title={fragrance.brand}>
            {fragrance.brand}
          </span>
          <span className="yr">{fragrance.year ?? ""}</span>
        </div>

        <h3 className="tn">{fragrance.name}</h3>

        <div className="r3">
          <b>{ratingStr}</b>
          <span title={top3Accords}>{top3Accords}</span>
        </div>
      </div>
    </Link>
  );
}
