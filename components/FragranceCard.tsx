// Server component
import Link from "next/link";
import type { Fragrance } from "@/lib/types";
import { accStr, getHue } from "@/lib/format";
import ImagePanel from "./ImagePanel";

interface Props {
  fragrance: Fragrance;
  priority?: boolean;
}

export default function FragranceCard({ fragrance: f, priority = false }: Props) {
  const hue = getHue(f);
  const href = `/fragrance/${f.slug}`;

  return (
    <Link href={href} className="d3-card" aria-label={`${f.name} by ${f.brand}`}>
      <ImagePanel
        src={f.imageUrl}
        alt={`${f.brand} ${f.name} bottle`}
        hue={hue}
        priority={priority}
      />
      <div className="d3-eyebrow d3-card-eyebrow">{f.brand}</div>
      <div className="d3-card-name">{f.name}</div>
      <div className="d3-rule" aria-hidden="true" />
      {f.accords.length > 0 && (
        <p className="d3-card-accords">{accStr(f.accords, 3)}</p>
      )}
    </Link>
  );
}
