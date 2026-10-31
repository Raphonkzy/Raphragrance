import Link from "next/link";
import type { Fragrance } from "@/lib/types";
import { getHue, accordColorVar } from "@/lib/format";
import ImagePanel from "./ImagePanel";

interface Props {
  fragrance: Fragrance;
  priority?: boolean;
}

export default function FragranceCard({ fragrance: f, priority = false }: Props) {
  const hue = getHue(f);
  const href = `/fragrance/${f.slug}`;
  const topAccords = f.accords.slice(0, 5);

  return (
    <Link href={href} className="card" aria-label={`${f.name} by ${f.brand}`}>
      <ImagePanel
        src={f.imageUrl}
        alt={`${f.brand} ${f.name} bottle`}
        hue={hue}
        priority={priority}
      />
      <div className="nm">{f.name}</div>
      <div className="br">{f.brand}</div>
      {topAccords.length > 0 && (
        <div className="seg" aria-hidden="true">
          {topAccords.map((a, idx) => (
            <i
              key={a.name}
              style={{
                flex: a.strength || 1,
                background: accordColorVar(idx),
              }}
              title={`${a.name}: ${a.strength}%`}
            />
          ))}
        </div>
      )}
      <div className="mt">
        <span>{f.rating !== null ? f.rating.toFixed(2) : "—"}</span>
        <span>{f.year ?? ""}</span>
      </div>
    </Link>
  );
}
