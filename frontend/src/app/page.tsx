"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FragranceGrid from "@/components/FragranceGrid";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FragranceGrid />

        {/* About / Info section */}
        <section
          id="about"
          style={{
            paddingBlock: "6rem",
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--bg-border)",
          }}
        >
          <div className="container-lg">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "5rem",
                alignItems: "center",
              }}
              className="about-grid"
            >
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.6rem",
                    fontWeight: 500,
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: "var(--amber)",
                    marginBottom: "1.5rem",
                  }}
                >
                  About Raphragrance
                </p>
                <h2
                  className="font-serif"
                  style={{
                    fontSize: "clamp(2rem, 4vw, 3rem)",
                    fontWeight: 300,
                    lineHeight: 1.1,
                    color: "var(--text-primary)",
                    marginBottom: "1.5rem",
                  }}
                >
                  Your personal
                  <br />
                  <em style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>fragrance guide.</em>
                </h2>
                <div
                  style={{
                    width: "2.5rem",
                    height: "1px",
                    background: "var(--amber)",
                    marginBottom: "1.5rem",
                  }}
                />
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9rem",
                    fontWeight: 300,
                    lineHeight: 1.9,
                    color: "var(--text-secondary)",
                    marginBottom: "1rem",
                  }}
                >
                  Raphragrance is your personal fragrance encyclopedia, a curated space
                  to explore thousands of fragrances from iconic perfume houses and niche
                  ateliers around the world.
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9rem",
                    fontWeight: 300,
                    lineHeight: 1.9,
                    color: "var(--text-secondary)",
                  }}
                >
                  Discover the complete note pyramid, main accords, longevity, sillage,
                  and ideal seasons for each scent in one refined platform.
                </p>
              </div>

              {/* Stats / Features */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {[
                  { icon: "◈", title: "131,000+", desc: "Fragrances in database" },
                  { icon: "◉", title: "Note Pyramid", desc: "Top, heart & base notes for every scent" },
                  { icon: "◍", title: "Performance Data", desc: "Longevity & sillage ratings" },
                  { icon: "◌", title: "Seasonal Guide", desc: "Best season & occasion for each fragrance" },
                ].map(({ icon, title, desc }) => (
                  <div
                    key={title}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.25rem",
                      padding: "1.25rem",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--bg-border)",
                      borderRadius: "4px",
                      transition: "border-color 0.2s ease, background 0.2s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(201,144,58,0.3)";
                      e.currentTarget.style.background = "var(--bg-overlay)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--bg-border)";
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    }}
                  >
                    <span style={{ fontSize: "1.4rem", color: "var(--amber)", flexShrink: 0 }}>{icon}</span>
                    <div>
                      <p
                        className="font-serif"
                        style={{ fontSize: "1.1rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "0.15rem" }}
                      >
                        {title}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <style>{`
            @media (max-width: 768px) {
              .about-grid {
                grid-template-columns: 1fr !important;
                gap: 2.5rem !important;
              }
            }
          `}</style>
        </section>
      </main>

      <Footer />
    </>
  );
}
