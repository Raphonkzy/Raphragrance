import Link from "next/link";
import { getFragrances } from "../../lib/data";
import { Nav } from "../../components/Nav";
import { Footer } from "../../components/Footer";

export default function BrandsPage() {
  const all = getFragrances(false);

  const brandCounts: Record<string, number> = {};
  for (const f of all) {
    if (f.brand) {
      brandCounts[f.brand] = (brandCounts[f.brand] || 0) + 1;
    }
  }

  const sorted = Object.entries(brandCounts).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <>
      <Nav />
      <div className="wrap" style={{ paddingTop: "24px" }}>
        <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em" }}>
          Brands ({sorted.length})
        </h1>
        <div className="list-rows">
          {sorted.map(([brand, count]) => (
            <Link
              key={brand}
              href={`/brand/${encodeURIComponent(brand)}`}
              className="list-row"
            >
              <span className="list-row-title">{brand}</span>
              <span className="list-row-count">{count} fragrances</span>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
