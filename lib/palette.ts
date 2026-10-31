/**
 * Swatch Color Palette
 *
 * Every accord owns one color pair [fill, ink-on-fill].
 * Matches case-insensitively after trimming.
 * Unmatched accords fall back to DEF.
 */

export const PAL: Record<string, [string, string]> = {
  // Greens
  aromatic: ["#3F6F4A", "#F4F7F2"],
  "fresh spicy": ["#1F5D50", "#F2EFE6"],
  green: ["#769E26", "#121A04"],

  // Browns / Resins
  woody: ["#7B4B2A", "#F7EFE6"],
  leather: ["#4A2E22", "#F3E8DF"],
  oud: ["#412635", "#F7EDF3"],
  patchouli: ["#5F572E", "#F9F6EA"],

  // Reds / Oranges
  fruity: ["#E4572E", "#140A05"],
  "warm spicy": ["#A8401F", "#FBF0E8"],

  // Yellows / Golds
  citrus: ["#F0C419", "#1E1800"],
  amber: ["#E0A030", "#1C1406"],
  vanilla: ["#EFE0BC", "#2A2012"],

  // Pinks / Floral
  floral: ["#E58FA8", "#2A0F18"],
  "white floral": ["#F0DDE4", "#2B1A21"],
  sweet: ["#D9577A", "#1A0710"],
  rose: ["#961A3C", "#FCF0F3"],

  // Purples
  powdery: ["#D5C8E0", "#221A2C"],
  lavender: ["#6E5B8E", "#F7F4FC"],

  // Blue-Greys / Aquatics
  aldehydic: ["#CFDBE0", "#14232B"],
  marine: ["#1D5F7C", "#EDF6F9"],
  fresh: ["#62C0D0", "#081F26"],

  // Neutrals
  musky: ["#B8A9A0", "#1F1915"],
  smoky: ["#4A4A52", "#F0F0F2"],
};

// Aliases for rare / merged accords
export const ACCORD_ALIASES: Record<string, string> = {
  coffee: "leather",
};

export const DEF: [string, string] = ["#7E8284", "#0E0E0E"];

/**
 * Returns [fill, ink] for a given accord name.
 * Fallback to DEF if name is missing or not in palette.
 */
export function getColorPair(name?: string | null): [string, string] {
  if (!name) return DEF;
  const key = name.trim().toLowerCase();
  const resolved = ACCORD_ALIASES[key] || key;
  return PAL[resolved] || DEF;
}
