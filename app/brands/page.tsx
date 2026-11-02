import Link from "next/link";
import type { Metadata } from "next";
import { getBrandsSummary } from "../../lib/data";
import { Nav } from "../../components/Nav";
import { Footer } from "../../components/Footer";

export const metadata: Metadata = {
  title: "All Brands — Raphragrance Archive",
  description: "Browse perfume brands and fragrance design houses in the Raphragrance archive.",
  alternates: {
    canonical: "https://raphragrance.com/brands",
  },
};

export default function BrandsPage() {
  const sorted = getBrandsSummary();

  return (
    <>
      <Nav />
      <main id="main-content">
        <div className="wrap" style={{ paddingTop: "24px" }}>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em" }}>
            Brands ({sorted.length})
          </h1>
          <div className="list-rows">
            {sorted.map(({ brand, count }) => (
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
      </main>
      <Footer />
    </>
  );
}
