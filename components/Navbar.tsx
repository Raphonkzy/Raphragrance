// Server component — no "use client"
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
  return (
    <header className="d3-nav" role="banner">
      <Link href="/" className="d3-logo" aria-label="Raphragrance home">
        Raphragrance
      </Link>
      <nav aria-label="Primary navigation">
        <ul className="d3-nav-links">
          <li><Link href="/">Catalog</Link></li>
          <li><Link href="/notes">Notes</Link></li>
          <li><Link href="/accords">Accords</Link></li>
          <li><Link href="/brands">Brands</Link></li>
        </ul>
      </nav>
      <ThemeToggle />
    </header>
  );
}
