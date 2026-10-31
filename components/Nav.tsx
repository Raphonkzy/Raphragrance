"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="nav">
        <Link href="/" className="logo">
          raphragrance
        </Link>
        <nav aria-label="Main Navigation">
          <Link href="/">Catalog</Link>
          <Link href="/brands">Brands</Link>
          <Link href="/notes">Notes</Link>
          <Link href="/accords">Accords</Link>
        </nav>
        <button
          type="button"
          className="chip menu-btn"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? "Close" : "Menu"}
        </button>
        <ThemeToggle />
      </header>

      {mobileMenuOpen && (
        <div className="mobile-nav-panel" role="dialog" aria-label="Mobile Navigation">
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            Catalog
          </Link>
          <Link href="/brands" onClick={() => setMobileMenuOpen(false)}>
            Brands
          </Link>
          <Link href="/notes" onClick={() => setMobileMenuOpen(false)}>
            Notes
          </Link>
          <Link href="/accords" onClick={() => setMobileMenuOpen(false)}>
            Accords
          </Link>
        </div>
      )}
    </>
  );
}
