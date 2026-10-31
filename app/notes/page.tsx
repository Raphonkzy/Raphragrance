import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  const fragrances = fixtureData as Fragrance[];
  const notesSet = new Set<string>();
  for (const f of fragrances) {
    [...f.notes.top, ...f.notes.heart, ...f.notes.base, ...f.notes.flat].forEach(
      (n) => notesSet.add(n)
    );
  }
  const notes = Array.from(notesSet).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <Navbar />
      <main style={{ padding: "48px 48px 90px" }}>
        <h1 className="d3-section-heading" style={{ marginTop: 0 }}>
          Notes ({notes.length})
        </h1>
        <ul style={{ listStyle: "none" }}>
          {notes.map((n) => (
            <li
              key={n}
              style={{
                fontSize: 14,
                color: "var(--tx2)",
                padding: "10px 0",
                borderBottom: "1px solid var(--bd)",
              }}
            >
              {n}
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
