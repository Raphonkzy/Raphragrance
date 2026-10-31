import Link from "next/link";
import { getFragrances } from "../../lib/data";
import { getColorPair } from "../../lib/palette";
import { Nav } from "../../components/Nav";
import { Footer } from "../../components/Footer";

export default function AccordsPage() {
  const all = getFragrances(false);

  const accordCounts: Record<string, number> = {};
  for (const f of all) {
    for (const a of f.accords || []) {
      if (a.name) {
        accordCounts[a.name] = (accordCounts[a.name] || 0) + 1;
      }
    }
  }

  const sorted = Object.entries(accordCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Nav />
      <div className="wrap" style={{ paddingTop: "24px" }}>
        <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em" }}>
          Accords ({sorted.length})
        </h1>
        <div className="list-rows">
          {sorted.map(([accord, count]) => {
            const [fill] = getColorPair(accord);
            return (
              <Link
                key={accord}
                href={`/?accord=${encodeURIComponent(accord)}`}
                className="list-row"
              >
                <span className="list-row-title">
                  <span
                    className="list-row-swatch"
                    style={{ background: fill }}
                    aria-hidden="true"
                  />
                  {accord}
                </span>
                <span className="list-row-count">{count} fragrances</span>
              </Link>
            );
          })}
        </div>
      </div>
      <Footer />
    </>
  );
}
