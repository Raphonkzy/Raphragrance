// Raphragrance fragrance type definitions

export interface FragranceNote {
  name: string;
  description?: string;
}

export interface FragranceNotes {
  Top?: FragranceNote[];
  Heart?: FragranceNote[];
  Base?: FragranceNote[];
}

export interface SeasonRanking {
  name: string;
  score: number;
}

export interface OccasionRanking {
  name: string;
  score: number;
}

export interface Fragrance {
  _id: string;
  Name: string;
  Brand: string;
  Year?: string;
  rating?: string;
  Country?: string;
  Confidence?: string;
  Popularity?: string;
  "Price Value"?: string;
  "Image URL"?: string;
  "Image URL Transparent"?: string;
  "Image Fallbacks"?: string[];
  "Purchase URL"?: string;
  Gender?: string;
  Price?: string;
  Longevity?: string;
  Sillage?: string;
  OilType?: string;
  "General Notes"?: string[];
  Notes?: FragranceNotes;
  "Main Accords"?: string[];
  "Main Accords Percentage"?: Record<string, string>;
  "Season Ranking"?: SeasonRanking[];
  "Occasion Ranking"?: OccasionRanking[];
  "Day Night"?: { name: string; score: number }[];
  similarity_score?: number;
}

export interface ApiResponse<T> {
  data: T;
  mock: boolean;
}

export interface CartItem {
  fragrance: Fragrance;
  quantity: number;
  size: "30ml" | "50ml" | "100ml";
}

export type CartAction =
  | { type: "ADD"; payload: CartItem }
  | { type: "REMOVE"; payload: string }
  | { type: "UPDATE_QTY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR" };
