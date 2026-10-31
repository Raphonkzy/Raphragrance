import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="d3-empty" style={{ padding: "56px 48px" }}>
        <p style={{ color: "var(--tx)", marginBottom: 16 }}>Page not found.</p>
        <Link href="/" className="d3-back">
          ← Back to catalog
        </Link>
      </main>
      <Footer />
    </>
  );
}
