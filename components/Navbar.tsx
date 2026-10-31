"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="navbar" role="banner">
        <div className="navbar__inner">
          <Link href="/" className="navbar__logo" aria-label="Raphragrance home">
            RAPH<span>.</span>RAGRANCE
          </Link>

          <div className="navbar__divider" aria-hidden />

          <nav className="navbar__nav" aria-label="Primary navigation">
            <Link href="/" className="navbar__link">Catalog</Link>
            <Link href="/browse" className="navbar__link">Browse</Link>
          </nav>

          <div className="navbar__actions">
            <kbd className="navbar__kbd" aria-label="Press slash to search">/</kbd>

            <button
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="btn btn--ghost"
              style={{ padding: "0.35rem 0.5rem", minHeight: "unset" }}
            >
              {theme === "dark" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              className="btn btn--ghost"
              style={{ padding: "0.35rem 0.5rem", minHeight: "unset", display: "flex" }}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-controls="mobile-menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                {menuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          id="mobile-menu"
          role="navigation"
          aria-label="Mobile navigation"
          style={{
            position: "fixed",
            inset: 0,
            top: 52,
            zIndex: 49,
            background: "var(--bg-base)",
            borderTop: "1px solid var(--bg-border)",
            padding: "2rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {[
            { href: "/", label: "Catalog" },
            { href: "/browse", label: "Browse" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.88rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                color: "var(--text-primary)",
                textDecoration: "none",
                padding: "0.875rem 0",
                borderBottom: "1px solid var(--bg-border)",
                display: "block",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
