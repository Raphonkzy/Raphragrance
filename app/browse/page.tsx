import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

const SAMPLE_NOTES = [
  "Bergamot", "Rose", "Vetiver", "Sandalwood", "Oud", "Vanilla",
  "Jasmine", "Patchouli", "Musk", "Cedar", "Iris", "Lavender",
  "Amber", "Neroli", "Cardamom", "Pink Pepper", "Leather", "Tobacco",
];

const SAMPLE_ACCORDS = [
  "woody", "citrus", "floral", "aromatic", "warm spicy",
  "sweet", "fresh", "musky", "earthy", "powdery",
  "fruity", "green", "leather", "smoky", "vanilla",
];

export default function BrowsePage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 52 }}>
        <div className="container" style={{ paddingBlock: "2.5rem" }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
              fontWeight: 400,
              fontStyle: "italic",
              color: "var(--text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            Browse by Note or Accord
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "2.5rem" }}>
            Explore fragrances filtered by specific notes and accord families.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2.5rem",
            }}
            className="browse-grid"
          >
            {/* Notes */}
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--bg-border)",
                }}
              >
                Notes ({2521})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {SAMPLE_NOTES.map((note) => (
                  <Link
                    key={note}
                    href={`/browse/note/${encodeURIComponent(note)}`}
                    className="tag tag--clickable"
                  >
                    {note}
                  </Link>
                ))}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.62rem",
                    color: "var(--text-muted)",
                    padding: "0.2rem 0.4rem",
                    alignSelf: "center",
                  }}
                >
                  + 2,503 more
                </span>
              </div>
            </div>

            {/* Accords */}
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--bg-border)",
                }}
              >
                Accords ({92})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {SAMPLE_ACCORDS.map((accord) => (
                  <Link
                    key={accord}
                    href={`/browse/accord/${encodeURIComponent(accord)}`}
                    className="tag tag--accent"
                  >
                    {accord}
                  </Link>
                ))}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.62rem",
                    color: "var(--text-muted)",
                    padding: "0.2rem 0.4rem",
                    alignSelf: "center",
                  }}
                >
                  + 77 more
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 640px) {
          .browse-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
