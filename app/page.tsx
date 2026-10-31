import { Suspense } from "react";
import { getFragrances } from "../lib/data";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { CatalogView } from "../components/CatalogView";

interface PageProps {
  searchParams: Promise<{ fixture?: string; q?: string; gender?: string; sort?: string; accord?: string }>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const useGolden = sp.fixture === "golden";
  const fragrances = getFragrances(useGolden);
  const totalCount = 131930;

  return (
    <>
      <Nav />
      <Suspense fallback={<div style={{ padding: "40px 32px" }}>Loading catalog…</div>}>
        <CatalogView
          initialFragrances={fragrances}
          totalDatabaseCount={totalCount}
        />
      </Suspense>
      <Footer />
    </>
  );
}
