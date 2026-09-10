"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const isScrolled = window.scrollY > 40;
          setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const navLinks = [
    { label: "Collection", href: "#collection" },
    { label: "About", href: "#about" },
  ];

  return (
    <>
      <header
        id="navbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          transition: "background 0.3s ease, box-shadow 0.3s ease, backdrop-filter 0.3s ease",
          background: scrolled ? "var(--navbar-bg)" : "transparent",
          boxShadow: scrolled ? "0 1px 0 var(--bg-border)" : "none",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        }}
      >
        <div
          className="container-xl"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          {/* Wordmark */}
          <a
            href="/"
            className="navbar-logo"
          >
            Raphragrance
          </a>

          {/* Right side: nav links + controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            {/* Nav Links: desktop */}
            <nav className="navbar-nav-desktop">
              {navLinks.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.68rem",
                    fontWeight: 500,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "color 0.2s ease",
                    minHeight: "auto",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Theme Toggle Button */}
            {mounted && (
              <button
                id="theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: "20px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: "0.35rem 0.65rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "background 0.2s, border-color 0.2s, color 0.2s",
                  minHeight: "auto",
                  height: "34px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.color = "var(--amber)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--bg-border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                {theme === "dark" ? (
                  /* Sun icon */
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  /* Moon icon */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.62rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                  className="hidden sm:inline"
                >
                  {theme === "dark" ? "Light" : "Dark"}
                </span>
              </button>
            )}

            {/* Hamburger: mobile */}
            <button
              id="hamburger-button"
              className={`hamburger navbar-hamburger ${menuOpen ? "open" : ""}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              style={{ minHeight: "auto" }}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Fullscreen Overlay */}
      {menuOpen && (
        <div className="mobile-menu md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            style={{
              position: "absolute",
              top: "1.25rem",
              right: "1.25rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "0.5rem",
              minHeight: "auto",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <p
            className="font-serif"
            style={{
              position: "absolute",
              top: "1.5rem",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.75rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            Raphragrance
          </p>

          {navLinks.map(({ label, href }, i) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(2rem, 8vw, 3rem)",
                fontWeight: 300,
                color: "var(--text-primary)",
                textDecoration: "none",
                letterSpacing: "0.05em",
                transition: `color 0.2s ease, transform 0.2s ease ${i * 0.05}s`,
                textAlign: "center",
                minHeight: "auto",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--amber)";
                e.currentTarget.style.transform = "translateX(8px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              {label}
            </a>
          ))}

          {/* Theme toggle in mobile menu */}
          {mounted && (
            <button
              onClick={() => { toggleTheme(); setMenuOpen(false); }}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--bg-border)",
                borderRadius: "20px",
                cursor: "pointer",
                color: "var(--text-secondary)",
                padding: "0.6rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "var(--font-sans)",
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                minHeight: "auto",
                marginTop: "1rem",
              }}
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
              Switch to {theme === "dark" ? "Light" : "Dark"} Mode
            </button>
          )}

          <div
            style={{
              position: "absolute",
              bottom: "3rem",
              left: "50%",
              transform: "translateX(-50%)",
              width: "2rem",
              height: "1px",
              background: "var(--amber)",
              opacity: 0.4,
            }}
          />
        </div>
      )}
    </>
  );
}
