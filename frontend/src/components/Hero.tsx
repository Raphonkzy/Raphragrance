"use client";

const scrollToCollection = () => {
  document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
};

export default function Hero() {
  return (
    <section
      id="hero"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        background: "var(--bg-base)",
        overflow: "hidden",
      }}
    >
      {/* Background gradient orbs (GPU-friendly, no heavy blur filter) */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "-10%",
          width: "clamp(300px, 45vw, 700px)",
          height: "clamp(300px, 45vw, 700px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,144,58,0.12) 0%, rgba(201,144,58,0.04) 40%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: "-8%",
          width: "clamp(200px, 35vw, 500px)",
          height: "clamp(200px, 35vw, 500px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(156,149,135,0.08) 0%, rgba(156,149,135,0.02) 40%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Subtle grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Hero content */}
      <div
        className="container-xl"
        style={{
          position: "relative",
          zIndex: 2,
          paddingTop: "8rem",
          paddingBottom: "6rem",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--amber)",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "24px",
                height: "1px",
                background: "var(--amber)",
              }}
            />
            Fragrance Encyclopedia
          </p>

          {/* Main heading */}
          <h1
            className="font-serif"
            style={{
              fontSize: "clamp(3rem, 8vw, 6.5rem)",
              fontWeight: 300,
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              marginBottom: "2rem",
            }}
          >
            Explore the
            <br />
            <em
              style={{
                fontStyle: "italic",
                background: "linear-gradient(135deg, var(--amber-light), var(--amber))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              World of Scent.
            </em>
          </h1>

          {/* Divider */}
          <div
            style={{
              width: "3rem",
              height: "1px",
              background: "var(--amber)",
              marginBottom: "2rem",
              opacity: 0.6,
            }}
          />

          {/* Subheading */}
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(0.9rem, 1.5vw, 1rem)",
              fontWeight: 300,
              lineHeight: 1.85,
              color: "var(--text-secondary)",
              maxWidth: "460px",
              marginBottom: "3rem",
            }}
          >
            Discover notes, accords, and performance data for 131,000+ fragrances.
            Your personal reference for the art of perfumery.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button
              id="hero-cta-collection"
              className="btn-primary"
              onClick={scrollToCollection}
            >
              Explore Fragrances
            </button>
            <a
              id="hero-cta-about"
              href="#about"
              className="btn-outline"
            >
              Learn More
            </a>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "2.5rem",
              marginTop: "4rem",
              flexWrap: "wrap",
            }}
          >
            {[
              { num: "131K+", label: "Fragrances" },
              { num: "∞", label: "Notes & Accords" },
              { num: "Free", label: "Always" },
            ].map(({ num, label }) => (
              <div key={label}>
                <p
                  className="font-serif"
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 300,
                    color: "var(--text-primary)",
                    lineHeight: 1,
                    marginBottom: "0.25rem",
                  }}
                >
                  {num}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.65rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative right column: fragrance note words */}
        <div
          className="hidden lg:block"
          style={{
            position: "absolute",
            right: "clamp(2rem, 8vw, 8rem)",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            textAlign: "right",
            pointerEvents: "none",
          }}
        >
          {["Bergamot", "Ambroxan", "Rose", "Vetiver", "Oud", "Neroli", "Sandalwood", "Jasmine", "Musk"].map(
            (note, i) => (
              <span
                key={note}
                className="font-serif"
                style={{
                  fontSize: `${0.8 + i * 0.22}rem`,
                  fontWeight: 300,
                  letterSpacing: "0.1em",
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                  opacity: 0.04 + i * 0.012,
                }}
              >
                {note}
              </span>
            )
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "2.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.58rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Scroll
        </span>
        <div
          style={{
            width: "1px",
            height: "2.5rem",
            background: "linear-gradient(to bottom, var(--text-muted), transparent)",
            animation: "scrollPulse 2s ease-in-out infinite",
          }}
        />
        <style>{`
          @keyframes scrollPulse {
            0%, 100% { opacity: 0.3; transform: scaleY(1); }
            50% { opacity: 0.8; transform: scaleY(1.15); }
          }
        `}</style>
      </div>
    </section>
  );
}
