import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accords",
  description: "Browse perfume accords in the Raphragrance encyclopedia.",
};

export default function AccordsPage() {
  const fragrances = fixtureData as Fragrance[];
  const accordCounts = new Map<string, number>();
  for (const f of fragrances) {
    for (const a of f.accords) {
      accordCounts.set(a.name, (accordCounts.get(a.name) || 0) + 1);
    }
  }
  const accords = Array.from(accordCounts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  return (
    <>
      <Navbar />
      <main style={{ padding: "20px" }}>
        <Link href="/" className="back" style={{ marginBottom: 16 }}>
          ← Catalog
        </Link>
        <h2 style={{ marginBottom: 16 }}>Accords ({accords.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Accord</th>
              <th className="n">Fragrances</th>
            </tr>
          </thead>
          <tbody>
            {accords.map(([accord, count]) => (
              <tr key={accord}>
                <td>
                  <Link
                    href={`/?q=${encodeURIComponent(accord)}`}
                    style={{ color: "var(--tx)", textDecoration: "none" }}
                  >
                    {accord}
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
