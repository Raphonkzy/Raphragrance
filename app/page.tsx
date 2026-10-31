import { getFragrances } from "../lib/data";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { CatalogView } from "../components/CatalogView";

export default function CatalogPage() {
  const fragrances = getFragrances(false);
  const totalCount = 131930;

  // Lightweight projection for catalog grid & typeahead to minimize RSC transfer size
  const catalogFragrances = fragrances.map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    brand: f.brand,
    year: f.year,
    gender: f.gender,
    imageUrl: f.imageUrl,
    rating: f.rating,
    voteCount: f.voteCount,
    accords: f.accords?.slice(0, 4) || [],
  }));

  const firstImageUrl = catalogFragrances[0]?.imageUrl;

  return (
    <>
      <link rel="preconnect" href="https://fimgs.net" />
      <link rel="dns-prefetch" href="https://fimgs.net" />
      {firstImageUrl && (
        <link
          rel="preload"
          as="image"
          href={firstImageUrl}
          fetchPriority="high"
        />
      )}
      <Nav />
      <CatalogView
        initialFragrances={catalogFragrances}
        totalDatabaseCount={totalCount}
      />
      <Footer />
    </>
  );
}
