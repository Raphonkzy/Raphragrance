import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Featured from "@/components/Featured";
import CatalogGrid from "@/components/CatalogGrid";
import Footer from "@/components/Footer";
import { getFeatured, getFragrances } from "@/lib/data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Raphragrance",
  description: "131,930 fragrances. Note pyramids, accord analysis, longevity, sillage, and seasonal data.",
};

interface PageProps {
  searchParams: Promise<{ fixture?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const useGolden =
    process.env.NODE_ENV !== "production" && params.fixture === "golden";

  const fragrances = getFragrances(useGolden);
  const featured = getFeatured(useGolden);

  // Catalog grid excludes the featured fragrance
  const gridFragrances = fragrances.filter((f) => f.id !== featured.id);

  return (
    <>
      <Navbar />
      <Featured fragrance={featured} />
      <Suspense fallback={null}>
        <CatalogGrid fragrances={gridFragrances} />
      </Suspense>
      <Footer />
    </>
  );
}
