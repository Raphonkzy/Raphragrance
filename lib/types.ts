export interface FragranceAccord {
  name: string;
  strength: number; // 0–100
}

export interface FragranceNotes {
  top: string[];
  heart: string[];
  base: string[];
  flat: string[];
}

export interface Fragrance {
  id: number;
  slug: string;
  name: string;
  brand: string;
  year: number | null;
  gender: "male" | "female" | "unisex";
  imageUrl: string | null;
  rating: number | null;
  voteCount: number;
  longevity: number | null;
  sillage: number | null;
  hue?: number; // deterministic 0–360, derived from id if absent
  accords: FragranceAccord[];
  notes: FragranceNotes;
  // raw vote counts — normalized by lib/format.ts
  seasons: { winter: number; spring: number; summer: number; autumn: number };
  timeOfDay: { day: number; night: number };
  perfumers: string[];
  description: string;
  sourceUrl: string;
  similaritySource?: "community" | "content";
}

export type CatalogFragrance = Pick<
  Fragrance,
  "id" | "slug" | "name" | "brand" | "year" | "gender" | "imageUrl" | "rating" | "voteCount" | "accords"
>;

