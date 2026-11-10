import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { rowToFragrance, getFragrances, getTotalCount } from "../../../lib/data";
import { checkRateLimit } from "../../../lib/rate_limit";
import type { Fragrance } from "../../../lib/types";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rl.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q");
  if (rawQ !== null && rawQ.length > 200) {
    return NextResponse.json(
      { error: "Query exceeds maximum length of 200 characters." },
      { status: 400 }
    );
  }
  const q = rawQ?.trim() || "";

  if (searchParams.has("limit")) {
    const rawLimit = Number(searchParams.get("limit"));
    if (isNaN(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      return NextResponse.json(
        { error: "Invalid limit parameter. Must be an integer between 1 and 100." },
        { status: 400 }
      );
    }
  }

  const gender = searchParams.get("gender") || "";
  const sort = searchParams.get("sort") || "popularity";
  const accord = searchParams.get("accord") || "";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
  const after = searchParams.get("after") ? Number(searchParams.get("after")) : null;
  const offset = searchParams.get("offset") ? Math.max(0, Number(searchParams.get("offset"))) : 0;

  const db = getDb();
  if (!db) {
    // Fallback to fixture data
    let list = getFragrances(false, 301);
    if (q) {
      const qLow = q.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(qLow) ||
          f.brand.toLowerCase().includes(qLow) ||
          f.accords.some((a) => a.name.toLowerCase().includes(qLow)) ||
          (f.notes?.top || []).some((n: string) => n.toLowerCase().includes(qLow)) ||
          (f.notes?.heart || []).some((n: string) => n.toLowerCase().includes(qLow)) ||
          (f.notes?.base || []).some((n: string) => n.toLowerCase().includes(qLow)) ||
          (f.notes?.flat || []).some((n: string) => n.toLowerCase().includes(qLow))
      );
    }
    if (gender && gender !== "All") {
      const gLow = gender.toLowerCase();
      const target =
        gLow === "men" || gLow === "male"
          ? "male"
          : gLow === "women" || gLow === "female"
          ? "female"
          : "unisex";
      list = list.filter((f) => f.gender.toLowerCase() === target);
    }
    if (accord) {
      const accLow = accord.toLowerCase();
      list = list.filter((f) =>
        f.accords.some((a) => a.name.toLowerCase() === accLow)
      );
    }

    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return NextResponse.json(
      {
        data: paginated,
        total,
        next_cursor: offset + limit < total ? offset + limit : null,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  }

  try {
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    // Search query: tokenize keywords
    let usedPrefixCount = false;
    let testCount = 0;
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      // Try fast indexed prefix lookup first
      const prefixClauses: string[] = [];
      const prefixParams: (string | number)[] = [];
      for (const token of tokens) {
        prefixClauses.push("(name LIKE ? OR brand LIKE ?)");
        prefixParams.push(`${token}%`, `${token}%`);
      }

      // Check if prefix query yields results
      const testQuery = `SELECT COUNT(*) as c FROM perfumes WHERE ${prefixClauses.join(" AND ")}`;
      const testRow = db.prepare(testQuery).get(...prefixParams) as { c?: number } | undefined;
      testCount = testRow?.c || 0;

      if (testCount >= 10) {
        whereClauses.push(...prefixClauses);
        params.push(...prefixParams);
        usedPrefixCount = true;
      } else {
        // Comprehensive query across name, brand, accords, and notes
        for (const token of tokens) {
          whereClauses.push(
            "(name LIKE ? OR brand LIKE ? OR accords LIKE ? OR notes_top LIKE ? OR notes_middle LIKE ? OR notes_base LIKE ? OR notes_flat LIKE ?)"
          );
          const likeVal = `%${token}%`;
          params.push(likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal);
        }
      }
    }

    // Gender filter
    if (gender && gender.toLowerCase() !== "all") {
      const gLow = gender.toLowerCase();
      const dbGender =
        gLow === "men" || gLow === "male"
          ? "male"
          : gLow === "women" || gLow === "female"
          ? "female"
          : "unisex";
      whereClauses.push("gender = ? COLLATE NOCASE");
      params.push(dbGender);
    }

    // Accord filter
    if (accord) {
      whereClauses.push("accords LIKE ?");
      params.push(`%${accord}%`);
    }

    // Keyset pagination cursor
    if (after !== null) {
      whereClauses.push("id < ?");
      params.push(after);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Count total matching
    let total = 0;
    if (whereClauses.length === 0) {
      total = getTotalCount();
    } else if (usedPrefixCount && !gender && !accord && after === null) {
      total = testCount;
    } else {
      const countQuery = `SELECT COUNT(*) as total FROM perfumes ${whereSql}`;
      const countRow = db.prepare(countQuery).get(...params) as { total?: number } | undefined;
      total = countRow?.total || 0;
    }

    // Sorting
    let orderBy = "vote_count DESC";
    if (sort === "rating") {
      orderBy = "rating_avg DESC, vote_count DESC";
    } else if (sort === "year_newest" || sort === "year") {
      orderBy = "year DESC, vote_count DESC";
    } else if (sort === "year_oldest") {
      orderBy = "year ASC, vote_count DESC";
    } else if (sort === "name") {
      orderBy = "name COLLATE NOCASE ASC";
    } else if (sort === "brand") {
      orderBy = "brand COLLATE NOCASE ASC";
    }

    // Data query
    const dataQuery = `SELECT * FROM perfumes ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const rows = db.prepare(dataQuery).all(...params, limit, offset);
    const data: Fragrance[] = rows.map(rowToFragrance);

    const lastItem = data[data.length - 1];
    const nextCursor = data.length === limit && lastItem ? lastItem.id : null;

    return NextResponse.json(
      {
        data,
        total,
        next_cursor: nextCursor,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("API /api/fragrances error:", error);
    return NextResponse.json({ error: "Failed to fetch fragrances" }, { status: 500 });
  }
}
