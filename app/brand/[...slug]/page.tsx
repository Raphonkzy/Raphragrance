import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FragranceCard from "@/components/FragranceCard";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = decodeURIComponent(slug.join("/"));
  return { title: brand };
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const brand = decodeURIComponent(slug.join("/"));
  const fragrances = (fixtureData as Fragrance[]).filter(
    (f) => f.brand.toLowerCase() === brand.toLowerCase()
  );

  if (fragrances.length === 0) notFound();

  const rated = fragrances.filter((f) => f.rating !== null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((sum, f) => sum + (f.rating || 0), 0) / rated.length).toFixed(2)
      : null;

  return (
    <>
      <Navbar />
      <div style={{ padding: "20px 20px 0" }}>
        <h2>{brand}</h2>
        <p
          style={{
            fontFamily: "var(--fm, monospace)",
            fontSize: 13,
            color: "var(--tx2)",
            marginTop: 4,
            marginBottom: 20,
          }}
        >
          {fragrances.length} {fragrances.length === 1 ? "fragrance" : "fragrances"}
          {avgRating && ` · average rating ${avgRating} / 5`}
        </p>
      </div>

      <main id="catalog">
        <div className="grid">
          {fragrances.map((f, idx) => (
            <FragranceCard key={f.id} fragrance={f} priority={idx < 6} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
