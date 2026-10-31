import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Accords" };

export default function AccordsPage() {
  const fragrances = fixtureData as Fragrance[];
  const accordSet = new Set<string>();
  for (const f of fragrances) {
    f.accords.forEach((a) => accordSet.add(a.name));
  }
  const accords = Array.from(accordSet).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <Navbar />
      <main style={{ padding: "48px 48px 90px" }}>
        <h1 className="d3-section-heading" style={{ marginTop: 0 }}>
          Accords ({accords.length})
        </h1>
        <ul style={{ listStyle: "none" }}>
          {accords.map((accord) => (
            <li key={accord} style={{ borderBottom: "1px solid var(--bd)" }}>
              <Link
                href={`/accords/${encodeURIComponent(accord)}`}
                style={{
                  display: "block",
                  fontSize: 14,
                  color: "var(--tx2)",
                  padding: "10px 0",
                }}
              >
                {accord}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
