export interface FragranceAccord {
  name: string;
  strength: number; // 0-100
}

export interface FragranceNotes {
  top: string[];
  heart: string[];
  base: string[];
  flat: string[];
}

export interface FragranceSeasons {
  winter: number;
  spring: number;
  summer: number;
  autumn: number;
}

export interface FragranceTimeOfDay {
  day: number;
  night: number;
}

export interface Fragrance {
  id: number;
  slug: string;
  name: string;
  brand: string;
  year: number | null;
  gender: "male" | "female" | "unisex";
  imageUrl: string;
  rating: number | null;
  voteCount: number;
  longevity: number | null; // 1-5 scale
  sillage: number | null;   // 1-5 scale
  accords: FragranceAccord[];
  notes: FragranceNotes;
  seasons: FragranceSeasons;
  timeOfDay: FragranceTimeOfDay;
  perfumers: string[];
  description: string;
  sourceUrl: string;
  similaritySource?: "curated" | "community" | "content";
  sharedNotes?: string[];
}

export interface FragranceListResponse {
  data: Fragrance[];
  total: number;
  next_cursor: number | null;
}

export interface FragranceSingleResponse {
  data: Fragrance;
}

export type SortOption =
  | "popularity"
  | "rating"
  | "name"
  | "brand"
  | "year"
  | "longevity"
  | "sillage";

export type SortOrder = "asc" | "desc";

export type GenderFilter = "all" | "male" | "female" | "unisex";

export interface SearchParams {
  q: string;
  gender: GenderFilter;
  sort: SortOption;
  order: SortOrder;
}
