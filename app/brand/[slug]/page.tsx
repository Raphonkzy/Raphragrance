import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FragranceCard from "@/components/FragranceCard";
import fixtureData from "@/fixtures/fragrances.json";
import type { Fragrance } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = decodeURIComponent(slug);
  return { title: brand };
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  const brand = decodeURIComponent(slug);
  const fragrances = (fixtureData as Fragrance[]).filter((f) => f.brand === brand);

  if (fragrances.length === 0) notFound();

  return (
    <>
      <Navbar />
      <main style={{ padding: "48px 48px 90px" }}>
        <h1
          style={{
            fontFamily: "var(--font-fraunces), 'Fraunces', Georgia, serif",
            fontSize: "clamp(32px, 4vw, 56px)",
            fontWeight: 400,
            lineHeight: 1.1,
            marginBottom: 48,
            color: "var(--tx)",
          }}
        >
          {brand}
        </h1>
        <div className="d3-cards">
          {fragrances.map((f) => (
            <FragranceCard key={f.id} fragrance={f} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
