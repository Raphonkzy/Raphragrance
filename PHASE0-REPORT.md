# Phase 0: Analysis and Plan

> Working directory: `D:\Raffa\Mengoding\Raphragrance-rebuilt`
> Reference (read-only): `D:\Raffa\Mengoding\Raphragrance`

---

## 1. Old App Baseline (measured, not claimed)

### Page weight (live site: fragrance.raphonkzy.web.id)

| Asset | Size (uncompressed) | Notes |
|---|---|---|
| HTML (home) | 26.2 KB | Full SSR-as-static page |
| JavaScript total | 627 KB | 7 chunks; largest is 224 KB |
| CSS | 21 KB | One chunk |
| **Estimated gzip JS** | ~150-170 KB | Depends on server compression |

The 150 KB gzip JS budget is right at the stated limit. The old app barely passes.

### API latency (measured from local machine to live server, includes network RTT)

| Endpoint | avg | min | max | Response size |
|---|---|---|---|---|
| `GET /api/fragrances?limit=20&page=1` | 579 ms | 327 ms | 996 ms | 43.7 KB |
| `GET /api/fragrances?search=rose` | 687 ms | 288 ms | 1218 ms | 44.8 KB |
| `GET /api/fragrances/similar?name=Light+Blue` | 197 ms | 151 ms | 254 ms | 13.6 KB |
| `GET /api/fragrances/485` | 125 ms | 118 ms | 136 ms | 1.8 KB |
| Home page HTML (TTFB) | 654 ms | - | - | 26.2 KB |

**Note:** These numbers include cross-continent network RTT. Server-side query time is the local SQLite benchmark below.

### SQLite query benchmarks (local, p50/p95)

| Query | p50 | p95 | Notes |
|---|---|---|---|
| LIKE: name+brand (`rose`) | 0.4 ms | 4.1 ms | Indexed name/brand |
| LIKE: brand (`chanel`) | 0.4 ms | 3.5 ms | Fine |
| Gender filter | 0.1 ms | 0.7 ms | Indexed |
| Popular page 1 | 0.2 ms | - | Indexed vote_count |
| Keyset pagination | 0.1 ms | 0.4 ms | Faster than OFFSET |
| OFFSET 10,000 | 1.2 ms | - | Still acceptable |
| OFFSET 100,000 | 6.2 ms | - | Acceptable edge case |
| Season+accord (`summer citrus`) | **289 ms** | **309 ms** | **CRITICAL BUG** |
| Season+accord after indexed season cols | **0.1 ms** | **0.8 ms** | With fix: +4 indexes |
| `GET /fragrances/:id` | 0.1 ms | - | Primary key lookup |
| Similar (3 accord LIKE) | 0.0 ms | 0.1 ms | Fine |

**Key finding:** The old app's season+accord compound query (e.g., "summer citrus") is 289 ms p50 because it runs a full table scan ratio check against 4 season columns without indexes. Adding 4 simple `CREATE INDEX` statements on the season vote columns drops this to sub-1 ms. FTS5 is not needed and actually slower for accord queries (56-134 ms vs 0.4 ms LIKE).

---

## 2. Data Profile (verified)

### Confirmed facts

| Fact | Value |
|---|---|
| Row count | **131,930** (confirmed) |
| DB size | 156.5 MB (SQLite) |
| CSV size | 121.4 MB |
| Columns | 31 (id, slug, name, brand, year, collection, gender, url, rating_avg, vote_count, longevity_avg, sillage_avg, price_value_avg, have_count, had_count, want_count, winter_votes, spring_votes, summer_votes, autumn_votes, day_votes, night_votes, people_votes, accords, notes_top, notes_middle, notes_base, notes_flat, perfumers, description, image_url) |

### Null/empty analysis

| Column | Empty count | % |
|---|---|---|
| name | 0 | 0% |
| brand | 0 | 0% |
| description | 0 | 0% |
| gender | 0 | 0% |
| image_url | 0 | 0% (all fimgs.net) |
| year | 24,133 | 18.3% |
| accords | 2,769 | 2.1% |
| notes_top | 38,976 | 29.5% |
| notes_middle | 39,070 | 29.6% |
| notes_base | 39,010 | 29.6% |
| perfumers | 82,717 | 62.7% |

### Gender distribution

| Gender | Count |
|---|---|
| unisex | 67,358 |
| female | 44,379 |
| male | 20,193 |

### Vote distribution

| Threshold | Count with votes above |
|---|---|
| > 0 | 114,662 (87%) |
| > 10 | 67,817 (51%) |
| > 100 | 25,006 (19%) |
| > 1,000 | 4,100 (3.1%) |

### Dirty data

- **Year**: 18.3% null. Some years are clearly wrong (year=20, year=1533, year=1070). Clamp to 1700-2027 during ETL.
- **Duplicate slugs**: Present (e.g., `Commodity/Paper` appears 5 times). These are real products sharing a URL slug, not data errors. Use `id` as primary key.
- **Accord format**: `name:strength|name:strength|...` where strength is 0-100. **92 distinct accord names** across the full dataset.
- **Note format**: `Note1|Note2|...` pipe-delimited. **2,521 distinct note names**.
- **Images**: 100% hotlink to `https://fimgs.net/mdimg/perfume/375x500.{id}.jpg`. No local copies.
- **Accords/notes endpoint**: Old app returns a hardcoded list of 24 notes and 19 accords. Actual data has 2,521 notes and 92 accords.

### Top brands

The Dua Brand (2,009), Avon (1,366), Zara (1,223), Victoria's Secret (1,184), Guerlain (577), Chanel, Dior, etc. Top brands by count include fast-fashion and mass market, not just luxury.

---

## 3. Old App: Architecture Problems

| Problem | Severity | Fix in rebuild |
|---|---|---|
| Season+accord search: 289 ms p50 | Critical | Add 4 season vote indexes |
| OFFSET pagination (conceptual concern, but 6 ms at 100k is fine for this dataset) | Low | Keyset pagination anyway for stability |
| No total count from API | Medium | Add `total` field to list response |
| Notes/accords endpoints hardcoded | Medium | Query from DB, build lookup tables |
| No per-fragrance URL | High | `/fragrance/[slug]` page in rebuild |
| Cart dead code | Low | Drop entirely |
| Footer links all `href="#"` | Medium | Wire real routes |
| Similar: no scoring, only first 3 accords | Medium | Weighted overlap scoring |
| FTS5 for text search | Not needed | LIKE on name+brand is p50 < 5ms |
| Dual DB complexity (Postgres + SQLite branches) | Medium | SQLite only (one engine, same perf) |
| Static export + Flask SPA fallback | Eliminates per-fragrance SSR/SEO | New: Next.js server mode with route handlers |
| Fake price field (`price_value_avg * 42`) | High | Drop entirely |
| Emoji icons (season/day-night) | Low | Replace with proper SVG |

---

## 4. Provenance and Licensing (flagged, not solved)

The dataset appears to be scraped from **Fragrantica** (source URLs are `fragrantica.com`). Two issues arise:

1. **Dataset**: Fragrantica's ToS prohibits scraping. The data is not licensed for redistribution. **Mitigation proposals:**
   - Keep the app non-commercial, clearly labeled as a personal reference tool.
   - Do not expose the raw CSV or database publicly. Keep it gitignored and volume-mounted.
   - If commercialized, the only clean path is a direct data licensing agreement with Fragrantica, or using only the public API they provide.

2. **Images**: All 131,930 images hotlink to `https://fimgs.net/mdimg/perfume/375x500.{id}.jpg` (Fragrantica's CDN). This is hotlinking from a third-party CDN without permission.
   - **Risk**: fimgs.net can add hotlink protection at any time, breaking all images instantly.
   - **Mitigation option A**: Add a `referrer-policy: no-referrer` header on image requests. May bypass basic hotlink checks.
   - **Mitigation option B**: Background job to download and self-host images (legal risk same as dataset).
   - **Mitigation option C**: Graceful fallback to a styled placeholder. This is what the rebuild should do regardless.
   - **Recommendation**: Implement a graceful fallback as a hard requirement. For production use, seek permission or a licensed data source.

---

## 5. Tech Stack Proposal

### Decision: Next.js 16 (App Router) + SQLite + Node route handlers. Single container.

#### Why Next.js 16 (App Router, server mode -- not static export)

The old app used `output: "export"` (static export) and Flask to serve it. This was the right call for simplicity but kills SEO (no per-fragrance SSR, no dynamic `<head>` per page) and prevents server-side route handlers.

Next.js 16.x has stable App Router with route handlers (`app/api/**`). We drop Flask entirely. The Next.js server runs the API and serves pages. One process, one port, one language (TypeScript).

**Breaking changes in Next 16 vs training data:** The bundled docs (`node_modules/next/dist/docs/`) confirm App Router is the canonical path. `output: "export"` still exists but is explicitly incompatible with Server Components that use dynamic features. We need server mode for route handlers.

#### Why SQLite (not Postgres)

Benchmarks show SQLite at p50 < 5ms for all queries after adding 4 missing season indexes. The "slow" season+accord query drops to 0.1 ms with those indexes. This is **read-only traffic on a static dataset**. SQLite's read concurrency is fine for this workload; WAL mode allows many concurrent readers.

Postgres adds: a second process, a volume, operational complexity, and no measurable query speed advantage for this dataset size. SQLite in WAL mode, with `better-sqlite3` (synchronous, no callback overhead), is the right choice.

**Deployment:** SQLite DB mounted as a read-only volume. ETL runs offline, produces the DB, copies it in. Works in Docker and k8s.

#### Why `better-sqlite3`

- Synchronous API (no async overhead in route handlers)
- 2-3x faster than `node-sqlite3` for read-heavy workloads
- Works with Node.js 20+ (the Docker base image)
- No C extension build issues in Alpine with proper setup

#### Why Tailwind CSS v4

The old app already uses Tailwind v4 (`@tailwindcss/postcss`). Tailwind v4 uses CSS-native cascade layers and native custom properties. No config file needed for basic usage. Design tokens live in CSS variables (same pattern as the old app, but we'll define our own color system).

#### Why no additional runtime dependencies

The old app had: `swr`, `next`, `react`, `react-dom`. We keep that set. We add: `better-sqlite3` (query layer). No UI component library (we're building from scratch per the brief). No state management library (React context + URL state is sufficient).

### Stack summary

| Layer | Choice | Justification |
|---|---|---|
| Framework | Next.js 16, App Router, server mode | SSR, route handlers, per-fragrance pages, SEO |
| Language | TypeScript 5 | Type safety across API contract |
| Database | SQLite via `better-sqlite3` | Read-only, p50 < 5ms, no second process |
| Styling | Tailwind v4 + CSS custom properties | Design tokens in CSS, utilities for layout |
| Data fetching | Native `fetch` + React Suspense (server), SWR (client search) | No extra dependencies |
| Search | LIKE + indexed season columns | Proven fast enough; no FTS5 needed |
| Deployment | Single Docker container (Node 22 Alpine) | Same model as old app, simpler |

---

## 6. Target Data Model

The flat table stays flat for queries. We parse structured data at query time (same as old app) but expose a clean typed API contract. No ETL normalization needed because:
- 92 accords and 2,521 notes are manageable as parsed pipe strings
- Normalization would require a JOIN on every query, adding complexity with no performance gain

**ETL changes:** Add 4 season vote indexes. Sanitize `year` (clamp 1700-2027, null the rest). No other schema changes.

### API contract (new)

All routes under `/api/`:

```
GET /api/fragrances
  ?q=          full-text (name, brand, accord names)
  ?gender=     male|female|unisex
  ?sort=       popularity|rating|name|brand|year|longevity|sillage
  ?order=      asc|desc
  ?limit=      1-100 (default 24)
  ?after=      cursor (last id for keyset pagination)
  Response: { data: Fragrance[], total: number, next_cursor: number|null }

GET /api/fragrances/[id]
  Response: { data: Fragrance }

GET /api/fragrances/[id]/similar
  ?limit=      1-20 (default 8)
  Response: { data: Fragrance[] }

GET /api/brands/[slug]
  Response: { data: { name, fragrance_count, avg_rating, top_fragrances: Fragrance[] } }

GET /api/notes
  ?q=          search
  Response: { data: { name: string, count: number }[] }

GET /api/accords
  ?q=          search
  Response: { data: { name: string, count: number }[] }

GET /api/browse/note/[note]
  ?limit=, ?after=
  Response: { data: Fragrance[], total, next_cursor }

GET /api/browse/accord/[accord]
  ?limit=, ?after=
  Response: { data: Fragrance[], total, next_cursor }
```

### Fragrance type (new, clean)

```typescript
interface Fragrance {
  id: number
  slug: string
  name: string
  brand: string
  year: number | null
  gender: 'male' | 'female' | 'unisex'
  imageUrl: string
  rating: number | null        // 0-5
  voteCount: number
  longevity: number | null     // 0-4 raw avg
  sillage: number | null       // 0-4 raw avg
  accords: { name: string; strength: number }[]    // strength 0-100
  notes: {
    top: string[]
    heart: string[]
    base: string[]
    flat: string[]
  }
  seasons: { winter: number; spring: number; summer: number; autumn: number }
  timeOfDay: { day: number; night: number }
  perfumers: string[]
  description: string
  sourceUrl: string
}
```

### Similarity algorithm (new)

Score = weighted Jaccard on accords + Jaccard on notes, normalized:

```
accord_score = |A ∩ B| weighted by strength / |A ∪ B|
note_score   = |A ∩ B| / |A ∪ B| (flat union of all note positions)
similarity   = 0.7 * accord_score + 0.3 * note_score
```

Executed as: fetch reference fragrance's accord names + all note names, then scan candidates with `accords LIKE` for top matches, score in application layer, return top N. This adds ~5ms of application-side scoring on a pre-filtered set. No full table scan.

### Search strategy

1. Tokenize query string
2. Classify tokens: season keywords, time keywords, gender keywords, free text
3. Free text: `(name || ' ' || brand) LIKE '%token%'` (p50 < 5ms, multiple tokens ANDed)
4. Season keyword: filter where `{season}_votes > total_votes * 0.20` using the new indexed season columns (p50 < 1ms)
5. Time keyword: filter where `{time}_votes > total_votes * 0.35` (same pattern)
6. Gender: direct indexed lookup
7. Sort: keyset cursor on (`vote_count`, `id`) for pagination stability

---

## 7. Performance Plan

### Targets

| Metric | Target | Old app baseline |
|---|---|---|
| Home LCP (mobile throttled) | <= 2.0s | Not measured (static export, no SSR head) |
| Home CLS | < 0.05 | Not measured |
| Home INP | < 200ms | Not measured |
| Initial JS (gzip) | <= 150 KB | ~150-170 KB (at budget) |
| Search API p95 (server-side) | < 50ms | 309ms (season+accord), < 5ms (text) |
| Type-ahead end-to-end | < 150ms | Untested |
| Per-fragrance page TTFB | < 200ms | No per-fragrance page |

### Key techniques

- **Keyset pagination**: cursor on `(vote_count DESC, id DESC)`. Eliminates `OFFSET` scan for deep pages.
- **Season indexes**: 4 `CREATE INDEX` statements. Drops worst-case from 309ms to < 1ms.
- **Image loading**: `loading="eager"` + `fetchpriority="high"` on hero/first-card images. `loading="lazy"` on below-fold cards. Fixed `width`/`height` to prevent CLS.
- **Font loading**: Self-host or use `font-display: swap` with preconnect. Do not use render-blocking Google Fonts `<link>` in `<head>`.
- **API response compression**: Next.js gzip/br by default on route handlers.
- **SWR for client search**: `keepPreviousData`, debounce 300ms, cancel stale with AbortController.
- **Virtualized or windowed list**: Use CSS `content-visibility: auto` + `contain-intrinsic-size` for the grid (no library needed for this layout pattern). The old app already does this.
- **`better-sqlite3` connection**: One singleton, WAL mode, opened once at module load.

---

## 8. Proposed Folder Tree

```
Raphragrance-rebuilt/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout, theme provider, fonts
│   ├── page.tsx                  # Home page
│   ├── globals.css               # Design tokens, base reset
│   ├── fragrance/
│   │   └── [slug]/
│   │       └── page.tsx          # Per-fragrance SSR page
│   ├── brand/
│   │   └── [slug]/
│   │       └── page.tsx          # Brand page
│   ├── browse/
│   │   ├── page.tsx              # Browse by note/accord
│   │   ├── note/[note]/page.tsx
│   │   └── accord/[accord]/page.tsx
│   └── api/
│       ├── fragrances/
│       │   ├── route.ts          # GET /api/fragrances
│       │   └── [id]/
│       │       ├── route.ts      # GET /api/fragrances/[id]
│       │       └── similar/
│       │           └── route.ts  # GET /api/fragrances/[id]/similar
│       ├── brands/
│       │   └── [slug]/route.ts
│       ├── notes/route.ts
│       └── accords/route.ts
│
├── components/
│   ├── ui/                       # Primitives: Button, Badge, Tag, Input, Skeleton
│   ├── FragranceCard.tsx
│   ├── FragranceGrid.tsx
│   ├── FragranceDetail.tsx       # Full detail view (page, not modal)
│   ├── NotePyramid.tsx
│   ├── AccordChart.tsx           # Bar chart with real percentages
│   ├── SeasonChart.tsx
│   ├── DayNightChart.tsx
│   ├── PerformanceBar.tsx
│   ├── SearchBar.tsx
│   ├── FilterPanel.tsx
│   ├── SimilarFragrances.tsx
│   ├── Navbar.tsx
│   └── Footer.tsx
│
├── lib/
│   ├── db.ts                     # better-sqlite3 singleton, WAL mode
│   ├── queries/
│   │   ├── fragrances.ts         # All fragrance queries + formatters
│   │   ├── brands.ts
│   │   ├── notes.ts
│   │   └── accords.ts
│   └── utils/
│       ├── search.ts             # Token classifier, query builder
│       ├── similarity.ts         # Weighted Jaccard scorer
│       └── format.ts             # Type formatters, label deriver
│
├── types/
│   └── index.ts                  # Fragrance, Brand, Note, Accord types
│
├── fixtures/                     # ~300 sample rows for Phase 1 UI dev
│   └── fragrances.json
│
├── scripts/
│   └── etl.ts                    # CSV → SQLite ETL with validation
│
├── data/                         # gitignored, volume-mounted
│   └── .gitkeep
│
├── public/
│   └── fonts/                    # Self-hosted font files (Phase 3)
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── next.config.ts
├── tailwind.config.ts            # Minimal -- tokens live in CSS
├── tsconfig.json
├── package.json
└── README.md
```

---

## 9. One honest concern

The `output: "export"` → Flask serving pattern the old app used is gone. The new app runs `next start` (a Node.js server). This means:
- The Docker image uses Node, not Python. Simpler and smaller.
- The DB is accessed directly from Next.js route handlers via `better-sqlite3`.
- No Flask, no Gunicorn, no Python. One fewer language in production.

This is a strictly better architecture but it is a real change from what you described as the reference. I wanted to flag it explicitly rather than silently swap it out.

---

## Summary table: old vs new

| Dimension | Old | New |
|---|---|---|
| Framework | Next.js 16 static export + Flask/Gunicorn | Next.js 16 server mode, App Router |
| Language | Python (backend) + TypeScript (frontend) | TypeScript only |
| DB engine | SQLite (default) or Postgres (optional) | SQLite only, WAL mode |
| DB access | `sqlite3` Python module | `better-sqlite3` (synchronous, fast) |
| Search | LIKE (fast) + season ratio (309ms) | LIKE + indexed season cols (< 1ms) |
| Pagination | OFFSET | Keyset cursor |
| Per-fragrance page | None (modal only) | `/fragrance/[slug]` SSR |
| SEO | None (static SPA) | Per-page `<head>` metadata, sitemap |
| Similarity | Top-3 accord LIKE, vote-count sort | Weighted Jaccard, scored |
| Notes/accords | Hardcoded 24/19 | Queried from DB (2,521/92) |
| Image fallback | SVG placeholder | Styled placeholder with bottle SVG |
| Cart | Dead code | Removed entirely |
| Container | Python 3.12-slim | Node 22-alpine |
| Image size | ~400 MB (Python + Node build deps) | ~200 MB (Node only) |
