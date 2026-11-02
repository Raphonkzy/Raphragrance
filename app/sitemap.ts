import type { MetadataRoute } from "next";
import { getDb } from "../lib/db";

const CHUNK_SIZE = 45000;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://raphragrance.com";

export async function generateSitemaps() {
  const db = getDb();
  let total = 131930;
  if (db) {
    try {
      const row = db.prepare("SELECT COUNT(*) as c FROM perfumes").get() as { c: number } | undefined;
      if (row?.c) total = row.c;
    } catch {}
  }
  const chunks = Math.ceil(total / CHUNK_SIZE);
  return Array.from({ length: chunks }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<{ id: string }> | { id: string | number };
}): Promise<MetadataRoute.Sitemap> {
  const resolved = await props.id;
  const chunkId = typeof resolved === "object" && "id" in resolved ? Number(resolved.id) : Number(resolved);
  const offset = chunkId * CHUNK_SIZE;

  const db = getDb();
  if (!db) {
    return [
      {
        url: BASE_URL,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
    ];
  }

  const rows = db
    .prepare("SELECT slug FROM perfumes ORDER BY id ASC LIMIT ? OFFSET ?")
    .all(CHUNK_SIZE, offset) as { slug: string }[];

  const urls: MetadataRoute.Sitemap = rows.map((r) => ({
    url: `${BASE_URL}/fragrance/${r.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  if (chunkId === 0) {
    urls.unshift(
      {
        url: BASE_URL,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${BASE_URL}/brands`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      },
      {
        url: `${BASE_URL}/notes`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      },
      {
        url: `${BASE_URL}/accords`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.9,
      }
    );
  }

  return urls;
}
