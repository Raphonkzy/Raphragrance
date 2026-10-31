import type { Fragrance } from "./types";

/** Deterministic hue 0–360 from fragrance id */
export function hueFromId(id: number): number {
  return (id * 137) % 360;
}

export function getHue(f: Fragrance): number {
  return f.hue !== undefined ? f.hue : hueFromId(f.id);
}

/**
 * Accord ramp CSS variable:
 * Uses --ramp-0 through --ramp-5 defined in globals.css.
 * All segments are >= 3.0:1 in both light and dark themes!
 */
export function accordColorVar(index: number): string {
  const i = Math.min(Math.max(0, index), 5);
  return `var(--ramp-${i})`;
}

/** Longevity label (matching preview and backend thresholds) */
export function lonL(v: number | null): string {
  if (v === null) return "Unknown";
  if (v >= 4) return "Eternal";
  if (v >= 3) return "Long Lasting";
  if (v >= 2) return "Moderate";
  return "Weak";
}

/** Sillage label (matching preview and backend thresholds) */
export function silL(v: number | null): string {
  if (v === null) return "Unknown";
  if (v >= 3.5) return "Enormous";
  if (v >= 2.5) return "Strong";
  if (v >= 1.8) return "Moderate";
  return "Intimate";
}

/** Format votes with comma: 28,431 */
export function formatVotes(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Normalize season votes to 0–4 scale.
 * The highest season = 4.0, matching preview's s array.
 * Clockwise order: Winter (0), Spring (1), Summer (2), Fall (3).
 */
export function normalizeSeasons(s: Fragrance["seasons"]): [number, number, number, number] {
  const vals: [number, number, number, number] = [
    s.winter || 0,
    s.spring || 0,
    s.summer || 0,
    s.autumn || 0,
  ];
  const max = Math.max(...vals);
  if (max <= 4.0) {
    return vals;
  }
  return vals.map((v) => parseFloat(((v / max) * 4).toFixed(1))) as [
    number,
    number,
    number,
    number
  ];
}

/** Gender display label */
export function genderLabel(g: string): string {
  const l = (g || "").toLowerCase();
  if (l === "male" || l === "men") return "Men";
  if (l === "female" || l === "women") return "Women";
  return "Unisex";
}
