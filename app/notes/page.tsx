import Link from "next/link";
import { getNotesSummary } from "../../lib/data";
import { Nav } from "../../components/Nav";
import { Footer } from "../../components/Footer";

export default function NotesPage() {
  const sorted = getNotesSummary(undefined, 200);

  return (
    <>
      <Nav />
      <div className="wrap" style={{ paddingTop: "24px" }}>
        <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em" }}>
          Notes ({sorted.length})
        </h1>
        <div className="list-rows">
          {sorted.map(({ name: note, count }) => (
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
