import CatalogView from "@/components/CatalogView";
import Footer from "@/components/Footer";
import { getFragrances } from "@/lib/data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Raphragrance",
  description: "Fragrance encyclopedia. 131,930 perfumes with accord analysis, note pyramids, season radar, and performance gauges.",
};

interface PageProps {
  searchParams: Promise<{ fixture?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const useGolden =
    process.env.NODE_ENV !== "production" && params.fixture === "golden";

  const fragrances = getFragrances(useGolden);

  return (
    <>
      <CatalogView initialFragrances={fragrances} />
      <Footer />
    </>
  );
}
