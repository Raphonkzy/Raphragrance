import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Brands" };

export default function BrandsPage() {
  const fragrances = fixtureData as Fragrance[];
  const brands = Array.from(new Set(fragrances.map((f) => f.brand))).sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <>
      <Navbar />
      <main style={{ padding: "48px 48px 90px" }}>
        <h1 className="d3-section-heading" style={{ marginTop: 0 }}>
          Brands ({brands.length})
        </h1>
        <ul style={{ listStyle: "none" }}>
          {brands.map((brand) => (
            <li key={brand} style={{ borderBottom: "1px solid var(--bd)" }}>
              <Link
                href={`/brand/${encodeURIComponent(brand)}`}
                style={{
                  display: "block",
                  fontSize: 14,
                  color: "var(--tx2)",
                  padding: "10px 0",
                }}
              >
                {brand}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
