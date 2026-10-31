import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--bg-border)",
        background: "var(--bg-surface)",
        marginTop: "4rem",
      }}
      role="contentinfo"
    >
      <div className="container" style={{ paddingBlock: "2.5rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "2rem",
            alignItems: "start",
          }}
          className="footer-grid"
        >
          {/* Brand */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                marginBottom: "0.5rem",
              }}
            >
              RAPH<span style={{ color: "var(--accent)" }}>.</span>RAGRANCE
            </div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                lineHeight: 1.6,
                maxWidth: 360,
              }}
            >
              Fragrance encyclopedia. 131,930 perfumes. Note pyramids, accord analysis,
              longevity and sillage ratings, seasonal data. Reference only.
            </p>
          </div>

          {/* Nav */}
          <nav aria-label="Footer navigation">
            <div
              style={{
                display: "flex",
                gap: "2rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.58rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Explore
                </div>
                {[
                  { href: "/", label: "Catalog" },
                  { href: "/browse", label: "Browse by Note" },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="footer-link"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>

        {/* Bottom */}
        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--bg-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              color: "var(--text-muted)",
            }}
          >
            © {new Date().getFullYear()} Raphragrance. Reference only.
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              color: "var(--text-muted)",
            }}
          >
            Data sourced from Fragrantica. No purchases.
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
