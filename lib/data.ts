import type { Fragrance } from "./types";
import goldenData from "../fixtures/golden.json";
import fixtureData from "../fixtures/fragrances.json";

const golden = goldenData as Fragrance[];
const catalog = fixtureData as Fragrance[];

/**
 * Load fragrances for a page.
 * In development: returns golden fixture when ?fixture=golden is in the URL.
 * In production: always returns the catalog fixture (real DB in Phase 2).
 * The fixture param is stripped server-side — never reaches the client.
 */
export function getFragrances(useGolden = false): Fragrance[] {
  if (useGolden && process.env.NODE_ENV !== "production") {
    return golden;
  }
  return catalog;
}

export function getFragranceBySlug(
  slug: string,
  useGolden = false
): Fragrance | undefined {
  const list = getFragrances(useGolden);
  return list.find(
    (f) => String(f.slug) === slug || String(f.id) === slug
  );
}

export function getFeatured(useGolden = false): Fragrance {
  const list = getFragrances(useGolden);
  return list.reduce((best, f) => (f.voteCount > best.voteCount ? f : best), list[0]);
}
