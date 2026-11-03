import type { Metadata } from "next";
import { getFragrances } from "../lib/data";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { CatalogView } from "../components/CatalogView";

export const metadata: Metadata = {
  title: "Raphragrance — Olfactory Intelligence Archive",
  description: "Explore over 130,000 fragrances, olfactory note pyramids, accord breakdowns, and algorithmic similarity recommendations.",
  alternates: {
    canonical: "https://raphragrance.com",
  },
  openGraph: {
    title: "Raphragrance — Olfactory Intelligence Archive",
    description: "Explore over 130,000 fragrances, olfactory note pyramids, accord breakdowns, and algorithmic similarity recommendations.",
    url: "https://raphragrance.com",
    type: "website",
  },
};

interface PageProps {
  searchParams?: Promise<{
    gender?: string;
    q?: string;
    sort?: string;
    accord?: string;
  }>;
}

function normalizeGender(g?: string): string {
  if (!g) return "All";
  const low = g.toLowerCase();
  if (low === "men" || low === "male") return "Men";
  if (low === "women" || low === "female") return "Women";
  if (low === "unisex") return "Unisex";
  return "All";
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialGender = normalizeGender(resolvedParams.gender);
  const initialQuery = resolvedParams.q || "";
  const initialSort = resolvedParams.sort || "Popular";
  const initialAccords = resolvedParams.accord
    ? resolvedParams.accord.split(",").filter(Boolean)
    : [];

  let fragrances = getFragrances(false, 301);
  if (initialGender !== "All") {
    const target =
      initialGender === "Men"
        ? "male"
        : initialGender === "Women"
        ? "female"
        : "unisex";
    fragrances = fragrances.filter((f) => f.gender?.toLowerCase() === target);
  }

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
      <main id="main-content">
        <CatalogView
          initialFragrances={catalogFragrances}
          totalDatabaseCount={totalCount}
          initialQuery={initialQuery}
          initialGender={initialGender}
          initialSort={initialSort}
          initialAccords={initialAccords}
        />
      </main>
      <Footer />
    </>
  );
}
