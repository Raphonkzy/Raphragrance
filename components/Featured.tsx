// Server component — Featured is the LCP element; no hydration delay
import Link from "next/link";
import type { Fragrance } from "@/lib/types";
import { accStr, formatVotes, getHue } from "@/lib/format";
import ImagePanel from "./ImagePanel";

interface Props {
  fragrance: Fragrance;
}

export default function Featured({ fragrance: f }: Props) {
  const hue = getHue(f);

  return (
    <Link
      href={`/fragrance/${f.slug}`}
      className="d3-feat"
      aria-label={`Featured: ${f.name} by ${f.brand}`}
    >
      {/* Left: image panel fills column height — LCP image, eager + high priority */}
      <ImagePanel
        src={f.imageUrl}
        alt={`${f.brand} ${f.name} bottle`}
        hue={hue}
        priority={true}
        fill
      />
      {/* Right: text */}
      <div className="d3-feat-text">
        <div className="d3-eyebrow">{f.brand} · most voted</div>
        <h2 className="d3-feat-name">{f.name}</h2>
        <div className="d3-rule" aria-hidden="true" />
        {f.accords.length > 0 && (
          <p className="d3-feat-accords">{accStr(f.accords, 4)}</p>
        )}
        <p className="d3-feat-rating">
          {f.rating !== null ? f.rating.toFixed(2) : "—"} / 5 from{" "}
          {formatVotes(f.voteCount)} votes
        </p>
      </div>
    </Link>
  );
}
