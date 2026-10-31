import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main style={{ padding: "32px 20px", minHeight: "calc(100vh - 120px)" }}>
        <h2>404</h2>
        <p
          style={{
            fontFamily: "var(--fm, monospace)",
            fontSize: 13,
            color: "var(--tx2)",
            margin: "12px 0 24px",
          }}
        >
          The requested record was not found in the index.
        </p>
        <Link href="/" className="back" style={{ margin: 0 }}>
          ← Back to catalog
        </Link>
      </main>
      <Footer />
    </>
  );
}
