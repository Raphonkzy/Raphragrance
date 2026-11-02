import Link from "next/link";
import type { Metadata } from "next";
import { getAccordsSummary } from "../../lib/data";
import { getColorPair } from "../../lib/palette";
import { Nav } from "../../components/Nav";
import { Footer } from "../../components/Footer";

export const metadata: Metadata = {
  title: "All Accords — Raphragrance Archive",
  description: "Browse olfactory accords and tonal harmonies across fragrances in Raphragrance.",
  alternates: {
    canonical: "https://raphragrance.com/accords",
  },
};

export default function AccordsPage() {
  const sorted = getAccordsSummary();

  return (
    <>
      <Nav />
      <main id="main-content">
        <div className="wrap" style={{ paddingTop: "24px" }}>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", fontWeight: 700, letterSpacing: "-0.04em" }}>
            Accords ({sorted.length})
          </h1>
          <div className="list-rows">
            {sorted.map(({ name: accord, count }) => {
              const [fill] = getColorPair(accord);
              return (
                <Link
                  key={accord}
                  href={`/?accord=${encodeURIComponent(accord)}`}
                  className="list-row"
                >
                  <span className="list-row-title">
                    <span
                      className="list-row-swatch"
                      style={{ background: fill }}
                      aria-hidden="true"
                    />
                    {accord}
                  </span>
                  <span className="list-row-count">{count} fragrances</span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
