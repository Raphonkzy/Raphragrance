import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Brands",
  description: "Browse perfume brands in the Raphragrance encyclopedia.",
};

export default function BrandsPage() {
  const fragrances = fixtureData as Fragrance[];
  const brandCounts = new Map<string, number>();
  for (const f of fragrances) {
    brandCounts.set(f.brand, (brandCounts.get(f.brand) || 0) + 1);
  }
  const brands = Array.from(brandCounts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  return (
    <>
      <Navbar />
      <main style={{ padding: "20px" }}>
        <Link href="/" className="back" style={{ marginBottom: 16 }}>
          ← Catalog
        </Link>
        <h2 style={{ marginBottom: 16 }}>Brands ({brands.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th className="n">Fragrances</th>
            </tr>
          </thead>
          <tbody>
            {brands.map(([brand, count]) => (
              <tr key={brand}>
                <td>
                  <Link
                    href={`/brand/${brand}`}
                    style={{ color: "var(--tx)", textDecoration: "none" }}
                  >
                    {brand}
                  </Link>
                </td>
                <td className="n">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
      <Footer />
    </>
  );
}
