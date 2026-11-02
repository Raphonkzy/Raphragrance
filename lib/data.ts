import type { Fragrance, FragranceAccord, FragranceNotes } from "./types.ts";
import { getDb } from "./db.ts";
import { scaleSillage } from "./format.ts";
import goldenData from "../fixtures/golden.json" with { type: "json" };
import fixtureData from "../fixtures/fragrances.json" with { type: "json" };

const golden = goldenData as unknown as Fragrance[];
const catalog = (fixtureData as unknown as Fragrance[]).map((f) => ({
  ...f,
  sillage: scaleSillage(f.sillage),
}));

function parseAccords(str: string | null): FragranceAccord[] {
  if (!str) return [];
  return str
    .split("|")
    .filter(Boolean)
    .map((part) => {
      const [name, val] = part.split(":");
      return { name: (name || "").trim(), strength: Number(val) || 0 };
    });
}

function parseNotes(
  top: string | null,
  mid: string | null,
  base: string | null,
  flat: string | null
): FragranceNotes {
  const split = (s: string | null) =>
    s ? s.split("|").map((n) => n.trim()).filter(Boolean) : [];
  return {
    top: split(top),
    heart: split(mid),
    base: split(base),
    flat: split(flat),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToFragrance(r: any): Fragrance {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    year: r.year,
    gender: r.gender,
    imageUrl: r.image_url,
    rating: r.rating_avg,
    voteCount: r.vote_count,
    longevity: r.longevity_avg,
    sillage: scaleSillage(r.sillage_avg),
    accords: parseAccords(r.accords),
    notes: parseNotes(r.notes_top, r.notes_middle, r.notes_base, r.notes_flat),
    seasons: {
      winter: r.winter_votes || 0,
      spring: r.spring_votes || 0,
      summer: r.summer_votes || 0,
      autumn: r.autumn_votes || 0,
    },
    timeOfDay: {
      day: r.day_votes || 0,
      night: r.night_votes || 0,
    },
    perfumers: r.perfumers
      ? r.perfumers.split("|").map((p: string) => p.trim()).filter(Boolean)
      : [],
    description: r.description || "",
    sourceUrl: r.url || "",
  };
}

/**
 * Load fragrances for catalog / list views.
 */
export function getFragrances(useGolden = false, limit = 301): Fragrance[] {
  if (useGolden) {
    return golden;
  }

  const db = getDb();
  if (db) {
    try {
      const stmt = db.prepare(
        "SELECT * FROM perfumes ORDER BY vote_count DESC, id DESC LIMIT ?"
      );
      const rows = stmt.all(limit);
      if (rows && rows.length > 0) {
        return rows.map(rowToFragrance);
      }
    } catch (e) {
      console.error("DB getFragrances error:", e);
    }
  }

  return catalog.slice(0, limit);
}

let cachedTotal: number | null = null;

/**
 * Get total count of fragrances in the database.
 */
export function getTotalCount(): number {
  if (cachedTotal !== null) return cachedTotal;
  const db = getDb();
  if (db) {
    try {
      const row = db.prepare("SELECT COUNT(*) as c FROM perfumes").get() as { c?: number } | undefined;
      if (row && typeof row.c === "number") {
        cachedTotal = row.c;
        return cachedTotal;
      }
    } catch {}
  }
  return 131930;
}

/**
 * Lookup fragrance by slug or numeric ID.
 */
export function getFragranceBySlug(
  slug: string,
  useGolden = false
): Fragrance | undefined {
  if (useGolden) {
    const decoded = decodeURIComponent(slug);
    return golden.find(
      (f) => String(f.slug) === slug || String(f.slug) === decoded || String(f.id) === slug
    );
  }

  const db = getDb();
  if (db) {
    try {
      const decoded = decodeURIComponent(slug);
      let row = db.prepare("SELECT * FROM perfumes WHERE slug = ?").get(slug);
      if (!row && decoded !== slug) {
        row = db.prepare("SELECT * FROM perfumes WHERE slug = ?").get(decoded);
      }
      if (!row) {
        row = db.prepare("SELECT * FROM perfumes WHERE slug = ? COLLATE NOCASE").get(decoded);
      }
      if (!row && /^\d+$/.test(slug)) {
        row = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(Number(slug));
      }
      if (row) {
        return rowToFragrance(row);
      }
    } catch (e) {
      console.error("DB getFragranceBySlug error:", e);
    }
  }

  const decoded = decodeURIComponent(slug);
  return catalog.find(
    (f) => String(f.slug) === slug || String(f.slug) === decoded || String(f.id) === slug
  );
}

/**
 * Lookup fragrance by numeric ID.
 */
export function getFragranceById(id: number, useGolden = false): Fragrance | undefined {
  if (useGolden) {
    return golden.find((f) => f.id === id);
  }
  const db = getDb();
  if (db) {
    try {
      const row = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(id);
      if (row) return rowToFragrance(row);
    } catch {}
  }
  return catalog.find((f) => f.id === id);
}



function computeSharedNotes(target: Fragrance, candidate: Fragrance): string[] {
  const targetNotes = new Set<string>();
  const addTarget = (notes?: string[]) => {
    if (notes) {
      for (const n of notes) {
        const clean = n.trim().toLowerCase();
        if (clean) targetNotes.add(clean);
      }
    }
  };
  addTarget(target.notes?.top);
  addTarget(target.notes?.heart);
  addTarget(target.notes?.base);
  addTarget(target.notes?.flat);

  const shared: string[] = [];
  const seenShared = new Set<string>();

  const checkCand = (notes?: string[]) => {
    if (notes) {
      for (const n of notes) {
        const clean = n.trim().toLowerCase();
        if (clean && targetNotes.has(clean) && !seenShared.has(clean)) {
          seenShared.add(clean);
          shared.push(n.trim());
          if (shared.length >= 3) return;
        }
      }
    }
  };

  checkCand(candidate.notes?.top);
  if (shared.length < 3) checkCand(candidate.notes?.heart);
  if (shared.length < 3) checkCand(candidate.notes?.base);
  if (shared.length < 3) checkCand(candidate.notes?.flat);

  return shared;
}

/**
 * Retrieve similar fragrances from the precomputed `similar` table in SQLite.
 * Order of precedence:
 * 1. Curated overrides (from data/similar_overrides.csv merged as source = 'curated')
 * 2. Community edges (if INCLUDE_COMMUNITY_EDGES == "true" and full DB loaded)
 * 3. Content-based olfactory DNA matches (padded to limit)
 * Blazing fast (< 1ms response time) using indexed B-Tree lookup on `(fragrance_id, source, rank)`.
 */
export function getSimilarFragrances(
  target: Fragrance,
  limit = 10
): (Fragrance & { similaritySource?: "curated" | "community" | "content"; sharedNotes?: string[] })[] {
  const db = getDb();
  if (!db) {
    const topAcc = target.accords?.[0]?.name;
    return catalog
      .filter((f) => f.id !== target.id && (!topAcc || f.accords?.[0]?.name === topAcc))
      .slice(0, limit);
  }

  const includeCommunity = process.env.INCLUDE_COMMUNITY_EDGES === "true";

  try {
    const results: (Fragrance & { similaritySource?: "curated" | "community" | "content"; sharedNotes?: string[] })[] = [];
    const seenIds = new Set<number>();
    seenIds.add(target.id);
    const brandCounts = new Map<string, number>();

    // Helper to evaluate and add recommendation respecting brand diversity cap <= 2
    const tryAddRecommendation = (
      row: any, // eslint-disable-line @typescript-eslint/no-explicit-any
      source: "curated" | "community" | "content"
    ): boolean => {
      if (seenIds.has(row.id)) return false;
      const bCount = brandCounts.get(row.brand) || 0;
      if (bCount >= 2) return false;

      const f = rowToFragrance(row);
      const sharedNotes = computeSharedNotes(target, f);
      results.push({ ...f, similaritySource: source, sharedNotes });
      seenIds.add(f.id);
      brandCounts.set(f.brand, bCount + 1);
      return true;
    };

    // 1. Fetch curated overrides first (both builds)
    const curatedRows = db.prepare(`
      SELECT s.similar_id, s.score, s.source, p.*
      FROM similar s
      JOIN perfumes p ON p.id = s.similar_id
      WHERE s.fragrance_id = ? AND s.source = 'curated'
      ORDER BY s.rank ASC
      LIMIT 10
    `).all(target.id);

    for (const r of curatedRows) {
      tryAddRecommendation(r, "curated");
      if (results.length >= limit) break;
    }

    // 2. If hybrid mode is active, fetch community edges (strictly respects brand cap of 2)
    if (includeCommunity && results.length < limit) {
      const commRows = db.prepare(`
        SELECT s.similar_id, s.score, s.source, p.*
        FROM similar s
        JOIN perfumes p ON p.id = s.similar_id
        WHERE s.fragrance_id = ? AND s.source = 'community'
        ORDER BY s.rank ASC
        LIMIT 30
      `).all(target.id);

      for (const r of commRows) {
        tryAddRecommendation(r, "community");
        if (results.length >= limit) break;
      }
    }

    // 3. Pad remaining recommendations with content matches
    if (results.length < limit) {
      const contentRows = db.prepare(`
        SELECT s.similar_id, s.score, s.source, p.*
        FROM similar s
        JOIN perfumes p ON p.id = s.similar_id
        WHERE s.fragrance_id = ? AND s.source = 'content'
        ORDER BY s.rank ASC
        LIMIT 40
      `).all(target.id);

      for (const r of contentRows) {
        tryAddRecommendation(r, "content");
        if (results.length >= limit) break;
      }
    }

    if (results.length > 0) {
      return results;
    }
  } catch (e) {
    console.error("DB getSimilarFragrances error:", e);
  }

  // Fallback: pick highest voted in catalog with matching top accord
  const topAcc = target.accords?.[0]?.name;
  return catalog
    .filter((f) => f.id !== target.id && (!topAcc || f.accords?.[0]?.name === topAcc))
    .slice(0, limit);
}

/**
 * Get distinct brands with counts.
 */
export function getBrandsSummary(q?: string): { brand: string; count: number }[] {
  const db = getDb();
  if (db) {
    try {
      let query = `
        SELECT brand, COUNT(*) as count 
        FROM perfumes 
        WHERE brand IS NOT NULL AND brand != ''
      `;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any[] = [];
      if (q && q.trim()) {
        query += ` AND brand LIKE ?`;
        params.push(`%${q.trim()}%`);
      }
      query += ` GROUP BY brand ORDER BY brand COLLATE NOCASE ASC`;
      const rows = db.prepare(query).all(...params);
      return rows.map((r: { brand: string; count: number }) => ({ brand: r.brand, count: r.count }));
    } catch (e) {
      console.error("DB getBrandsSummary error:", e);
    }
  }

  const counts: Record<string, number> = {};
  for (const f of catalog) {
    if (f.brand) {
      if (!q || f.brand.toLowerCase().includes(q.toLowerCase())) {
        counts[f.brand] = (counts[f.brand] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([brand, count]) => ({ brand, count }));
}

/**
 * Get detailed brand metadata and top fragrances.
 */
export function getBrandDetail(brandName: string): {
  name: string;
  fragrance_count: number;
  avg_rating: number | null;
  top_fragrances: Fragrance[];
} | null {
  const decoded = decodeURIComponent(brandName);
  const db = getDb();
  if (db) {
    try {
      const meta = db.prepare(`
        SELECT COUNT(*) as fragrance_count, AVG(rating_avg) as avg_rating 
        FROM perfumes 
        WHERE brand = ? COLLATE NOCASE
      `).get(decoded);

      if (!meta || meta.fragrance_count === 0) return null;

      const topRows = db.prepare(`
        SELECT * FROM perfumes 
        WHERE brand = ? COLLATE NOCASE 
        ORDER BY vote_count DESC, id DESC 
        LIMIT 10
      `).all(decoded);

      return {
        name: decoded,
        fragrance_count: meta.fragrance_count,
        avg_rating: meta.avg_rating ? Math.round(meta.avg_rating * 100) / 100 : null,
        top_fragrances: topRows.map(rowToFragrance),
      };
    } catch (e) {
      console.error("DB getBrandDetail error:", e);
    }
  }

  const matches = catalog.filter((f) => f.brand.toLowerCase() === decoded.toLowerCase());
  if (matches.length === 0) return null;
  const avgRating = matches.reduce((acc, f) => acc + (f.rating || 0), 0) / matches.length;
  return {
    name: matches[0].brand,
    fragrance_count: matches.length,
    avg_rating: Math.round(avgRating * 100) / 100,
    top_fragrances: matches.slice(0, 10),
  };
}

let cachedAccords: { name: string; count: number }[] | null = null;

/**
 * Get distinct accords with counts across the database.
 */
export function getAccordsSummary(q?: string): { name: string; count: number }[] {
  if (!cachedAccords) {
    const db = getDb();
    if (db) {
      try {
        const rows = db.prepare("SELECT accords FROM perfumes WHERE accords IS NOT NULL AND accords != ''").all();
        const counts: Record<string, number> = {};
        for (const r of rows) {
          const parts = (r.accords as string).split("|");
          for (const part of parts) {
            if (!part) continue;
            const name = part.split(":")[0]?.trim().toLowerCase();
            if (name) {
              counts[name] = (counts[name] || 0) + 1;
            }
          }
        }
        cachedAccords = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
      } catch (e) {
        console.error("DB getAccordsSummary error:", e);
      }
    }

    if (!cachedAccords) {
      const counts: Record<string, number> = {};
      for (const f of catalog) {
        for (const a of f.accords || []) {
          if (a.name) {
            const key = a.name.toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      }
      cachedAccords = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
    }
  }

  if (q && q.trim()) {
    const qLow = q.trim().toLowerCase();
    return cachedAccords.filter((a) => a.name.includes(qLow));
  }
  return cachedAccords;
}

let cachedNotes: { name: string; count: number }[] | null = null;

/**
 * Get distinct notes with counts across the database.
 */
export function getNotesSummary(q?: string, limit = 100): { name: string; count: number }[] {
  if (!cachedNotes) {
    const db = getDb();
    if (db) {
      try {
        const rows = db.prepare("SELECT notes_top, notes_middle, notes_base, notes_flat FROM perfumes").all();
        const counts: Record<string, number> = {};
        for (const r of rows) {
          const allNotes = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat]
            .filter(Boolean)
            .join("|")
            .split("|");
          const uniqueInRow = new Set<string>();
          for (const n of allNotes) {
            const trimmed = n.trim();
            if (trimmed) uniqueInRow.add(trimmed);
          }
          for (const n of uniqueInRow) {
            counts[n] = (counts[n] || 0) + 1;
          }
        }
        cachedNotes = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
      } catch (e) {
        console.error("DB getNotesSummary error:", e);
      }
    }

    if (!cachedNotes) {
      const counts: Record<string, number> = {};
      for (const f of catalog) {
        const notes = [
          ...(f.notes.top || []),
          ...(f.notes.heart || []),
          ...(f.notes.base || []),
          ...(f.notes.flat || []),
        ];
        const unique = new Set(notes);
        for (const n of unique) {
          if (n) counts[n] = (counts[n] || 0) + 1;
        }
      }
      cachedNotes = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
    }
  }

  let result = cachedNotes;
  if (q && q.trim()) {
    const qLow = q.trim().toLowerCase();
    result = result.filter((n) => n.name.toLowerCase().includes(qLow));
  }
  return result.slice(0, limit);
}

/**
 * Get fragrances by specific brand.
 */
export function getFragrancesByBrand(brand: string, limit = 100): Fragrance[] {
  const db = getDb();
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT * FROM perfumes 
        WHERE brand = ? COLLATE NOCASE 
        ORDER BY vote_count DESC, id DESC 
        LIMIT ?
      `).all(brand, limit);
      return rows.map(rowToFragrance);
    } catch (e) {
      console.error("DB getFragrancesByBrand error:", e);
    }
  }

  const decoded = decodeURIComponent(brand).toLowerCase();
  return catalog.filter((f) => f.brand.toLowerCase() === decoded).slice(0, limit);
}

export function getFeatured(useGolden = false): Fragrance {
  const list = getFragrances(useGolden, 10);
  return list.reduce((best, f) => (f.voteCount > best.voteCount ? f : best), list[0]);
}
