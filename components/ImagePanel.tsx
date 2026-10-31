// Server Component — zero client-side React hydration overhead
import React from "react";

interface ImagePanelProps {
  src?: string | null;
  alt: string;
  hue: number;
  priority?: boolean;
}

export default function ImagePanel({
  src,
  alt,
  hue,
  priority = false,
}: ImagePanelProps) {
  const hasValidSrc = Boolean(src && src.trim().length > 0 && !src.includes("null") && !src.includes("undefined"));

  return (
    <div className="ph" style={{ "--h": hue } as React.CSSProperties}>
      {/* Bottle SVG placeholder — preview viewBox 0 0 60 90 */}
      <svg viewBox="0 0 60 90" aria-hidden="true" className="bottle">
        <rect x="22" y="4" width="16" height="10" rx="2" />
        <rect x="26" y="14" width="8" height="8" />
        <rect x="10" y="22" width="40" height="62" rx="8" />
      </svg>
      {hasValidSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          width={375}
          height={500}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
      )}
    </div>
  );
}
