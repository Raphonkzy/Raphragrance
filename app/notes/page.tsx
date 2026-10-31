import Link from "next/link";
import { getFragrances } from "../../lib/data";
import { Nav } from "../../components/Nav";
import { Footer } from "../../components/Footer";

export default function NotesPage() {
  const all = getFragrances(false);

  const noteCounts: Record<string, number> = {};
  for (const f of all) {
    const notes = [
      ...(f.notes.top || []),
      ...(f.notes.heart || []),
      ...(f.notes.base || []),
      ...(f.notes.flat || []),
    ];
    const unique = new Set(notes);
    for (const n of unique) {
      if (n) {
        noteCounts[n] = (noteCounts[n] || 0) + 1;
      }
    }
  }

  const sorted = Object.entries(noteCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Nav />
      <div className="wrap" style={{ paddingTop: "24px" }}>
        <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em" }}>
          Notes ({sorted.length})
        </h1>
        <div className="list-rows">
          {sorted.slice(0, 100).map(([note, count]) => (
            <Link
              key={note}
              href={`/?q=${encodeURIComponent(note)}`}
              className="list-row"
            >
              <span className="list-row-title">{note}</span>
              <span className="list-row-count">{count} fragrances</span>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
