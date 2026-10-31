import type { Fragrance } from "./types";

/** Deterministic hue 0–360 from fragrance id */
export function hueFromId(id: number): number {
  return (id * 137) % 360;
}

export function getHue(f: Fragrance): number {
  return f.hue !== undefined ? f.hue : hueFromId(f.id);
}

/** longevity label — thresholds from preview */
export function lonL(v: number | null): string {
  if (v === null) return "Unknown";
  if (v >= 4) return "Eternal";
  if (v >= 3) return "Long Lasting";
  if (v >= 2) return "Moderate";
  return "Weak";
}

/** sillage label — thresholds from preview */
export function silL(v: number | null): string {
  if (v === null) return "Unknown";
  if (v >= 3.5) return "Enormous";
  if (v >= 2.5) return "Strong";
  if (v >= 1.8) return "Moderate";
  return "Intimate";
}

/** Top N accord names joined by " · " */
export function accStr(accords: Fragrance["accords"], n: number): string {
  return accords.slice(0, n).map((a) => a.name).join(" · ");
}

/** Format vote count: 28,431 */
export function formatVotes(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Normalize season vote counts to 0–4 scale.
 * The highest season = 4.0, matching the preview's normalization.
 */
export function normalizeSeasons(
  s: Fragrance["seasons"]
): { name: string; value: number }[] {
  const entries = [
    { name: "Winter", raw: s.winter },
    { name: "Spring", raw: s.spring },
    { name: "Summer", raw: s.summer },
    { name: "Fall", raw: s.autumn },
  ];
  const max = Math.max(...entries.map((e) => e.raw), 1);
  return entries.map((e) => ({
    name: e.name,
    value: parseFloat(((e.raw / max) * 4).toFixed(1)),
  }));
}

/** Gender display label */
export function genderLabel(g: string): string {
  if (g === "male") return "Men";
  if (g === "female") return "Women";
  return "Unisex";
}
