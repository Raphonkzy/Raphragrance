import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Notes",
  description: "Browse perfume notes in the Raphragrance encyclopedia.",
};

export default function NotesPage() {
  const fragrances = fixtureData as Fragrance[];
  const noteCounts = new Map<string, number>();
  for (const f of fragrances) {
    const seen = new Set([
      ...f.notes.top,
      ...f.notes.heart,
      ...f.notes.base,
      ...f.notes.flat,
    ]);
    for (const n of seen) {
      noteCounts.set(n, (noteCounts.get(n) || 0) + 1);
    }
  }
  const notes = Array.from(noteCounts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  return (
    <>
      <Navbar />
      <main style={{ padding: "20px" }}>
        <Link href="/" className="back" style={{ marginBottom: 16 }}>
          ← Catalog
        </Link>
        <h2 style={{ marginBottom: 16 }}>Notes ({notes.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Note</th>
              <th className="n">Fragrances</th>
            </tr>
          </thead>
          <tbody>
            {notes.map(([note, count]) => (
              <tr key={note}>
                <td>
                  <Link
                    href={`/?q=${encodeURIComponent(note)}`}
                    style={{ color: "var(--tx)", textDecoration: "none" }}
                  >
                    {note}
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
