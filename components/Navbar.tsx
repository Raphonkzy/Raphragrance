import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

interface NavbarProps {
  children?: React.ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  return (
    <header className="nav" role="banner">
      <Link href="/" className="logo" aria-label="Raphragrance home">
        Raphragrance
      </Link>
      {children || (
        <form action="/" method="GET" className="search-wrap">
          <input
            type="search"
            name="q"
            className="search"
            placeholder="Search brand, note, accord…"
            aria-label="Search brand, note, accord"
          />
        </form>
      )}
      <ThemeToggle />
    </header>
  );
}
