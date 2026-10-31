import Link from "next/link";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <div className="not-found-wrap" role="region" aria-label="Not found">
        <h1>Not found.</h1>
        <p style={{ color: "var(--mu)", fontSize: "18px" }}>
          The requested page or fragrance record does not exist in the archive.
        </p>
        <Link href="/" className="chip on" style={{ marginTop: "16px" }}>
          Back to catalog
        </Link>
      </div>
      <Footer />
    </>
  );
}
