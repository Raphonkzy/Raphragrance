import Navbar from "@/components/Navbar";
import FragranceGrid from "@/components/FragranceGrid";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 52 }}>
        {/* Above-fold identifier */}
        <div
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--bg-border)",
          }}
        >
          <div className="container" style={{ paddingBlock: "2rem 1.5rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "2rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    fontWeight: 500,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.6rem",
                  }}
                >
                  Fragrance Reference Database · v2026
                </div>
                <h1
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(2rem, 5vw, 3.5rem)",
                    fontWeight: 400,
                    fontStyle: "italic",
                    lineHeight: 1.05,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Raphragrance
                </h1>
              </div>

              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.65,
                  maxWidth: 340,
                }}
              >
                Structured data on 131,930 perfumes. Note pyramids, accord
                analysis with strengths, longevity and sillage ratings,
                seasonal suitability. Search by name, brand, note, or accord.
              </p>
            </div>
          </div>
        </div>

        <FragranceGrid />
      </main>
      <Footer />
    </>
  );
}
