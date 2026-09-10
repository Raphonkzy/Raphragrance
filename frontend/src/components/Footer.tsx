export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--bg-border)",
        color: "var(--text-secondary)",
        paddingBlock: "4rem 2.5rem",
      }}
    >
      <div className="container-xl">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "3rem",
            marginBottom: "3rem",
          }}
        >
          {/* Brand */}
          <div>
            <h3
              className="font-serif"
              style={{
                fontSize: "1.3rem",
                fontWeight: 300,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                marginBottom: "0.875rem",
              }}
            >
              Raphragrance
            </h3>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "0.78rem",
                lineHeight: 1.8,
                color: "var(--text-secondary)",
                maxWidth: "240px",
              }}
            >
              Your personal fragrance encyclopedia. Explore thousands of fragrances from world-renowned perfume houses.
            </p>
          </div>

          {/* Links */}
          {[
            { title: "Explore", links: ["Collection", "Notes Guide", "Top Rated", "New Releases"] },
            { title: "Discover", links: ["By Brand", "By Note", "By Season", "Niche Picks"] },
            { title: "About", links: ["About Project", "Data Sources", "Contact", "GitHub"] },
          ].map(({ title, links }) => (
            <div key={title}>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.58rem",
                  fontWeight: 500,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "1.25rem",
                }}
              >
                {title}
              </p>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "0.8rem",
                        color: "var(--text-secondary)",
                        textDecoration: "none",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="divider" style={{ marginBottom: "1.75rem" }} />

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
            }}
          >
            © {new Date().getFullYear()} Raphragrance. All rights reserved.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
            }}
          >
            Info only · No purchases
          </p>
        </div>
      </div>
    </footer>
  );
}
