"use client";

import { useState } from "react";

interface ImagePanelProps {
  src: string;
  alt: string;
  hue: number;
  priority?: boolean;
  fill?: boolean;
}

export default function ImagePanel({
  src,
  alt,
  hue,
  priority = false,
  fill = false,
}: ImagePanelProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="d3-ph"
      style={{ "--ph-hue": hue } as React.CSSProperties}
    >
      {/* Bottle SVG — always in background; hidden by image when image loads */}
      <svg
        viewBox="0 0 60 90"
        aria-hidden="true"
        className="bottle"
        style={{ display: "block" }}
      >
        <rect x="22" y="4" width="16" height="10" />
        <rect x="26" y="14" width="8" height="8" />
        <rect x="10" y="22" width="40" height="62" />
      </svg>
      {/* Image on top — hides the bottle when it loads */}
      {!imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
