import { Fragrance } from "@/types";

// Derive longevity label + percentage from raw 0-4 avg
export function longevityLabel(v: number | null): string {
  if (v === null) return "Unknown";
  if (v >= 3.5) return "Eternal";
  if (v >= 2.8) return "Long Lasting";
  if (v >= 1.8) return "Moderate";
  if (v >= 0.8) return "Weak";
  return "Very Weak";
}

export function longevityPct(v: number | null): number {
  if (v === null) return 0;
  return Math.round(Math.min(100, (v / 4) * 100));
}

export function sillageLabel(v: number | null): string {
  if (v === null) return "Unknown";
  if (v >= 3.5) return "Enormous";
  if (v >= 2.5) return "Strong";
  if (v >= 1.5) return "Moderate";
  return "Intimate";
}

export function sillagePct(v: number | null): number {
  if (v === null) return 0;
  return Math.round(Math.min(100, (v / 4) * 100));
}

// Normalize season votes to 0-100 scale relative to max
export function normalizeSeasons(
  seasons: Fragrance["seasons"]
): { name: string; pct: number; votes: number }[] {
  const entries = [
    { name: "Winter", votes: seasons.winter },
    { name: "Spring", votes: seasons.spring },
    { name: "Summer", votes: seasons.summer },
    { name: "Autumn", votes: seasons.autumn },
  ];
  const max = Math.max(...entries.map((e) => e.votes), 1);
  return entries.map((e) => ({
    ...e,
    pct: Math.round((e.votes / max) * 100),
  }));
}

// Normalize day/night votes to percentages of total
export function normalizeDayNight(
  tod: Fragrance["timeOfDay"]
): { name: string; pct: number }[] {
  const total = tod.day + tod.night;
  if (total === 0) return [];
  return [
    { name: "Day", pct: Math.round((tod.day / total) * 100) },
    { name: "Night", pct: Math.round((tod.night / total) * 100) },
  ];
}

// Dominant season name
export function dominantSeason(seasons: Fragrance["seasons"]): string | null {
  const entries = Object.entries(seasons) as [string, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] === 0) return null;
  const name = sorted[0][0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Format vote count compactly
export function formatVotes(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

// Build a URL-safe slug from brand+name if slug field is missing
export function fragranceHref(f: Fragrance): string {
  return `/fragrance/${encodeURIComponent(f.slug || f.id)}`;
}

export function brandHref(brand: string): string {
  return `/brand/${encodeURIComponent(brand)}`;
}
