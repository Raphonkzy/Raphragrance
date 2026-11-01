# Data Provenance and Licensing Policy

## 1. Provenance of Fragrance Data

Raphragrance's dataset originates from scraped public profiles on **Fragrantica.com** (captured circa May 2026, timestamp `1780102667`).

### 1.1 Field Inventory & Origin

| Field Name | Type | Origin / Source | Description | Production Classification |
|:---|:---|:---|:---|:---|
| `id` | INTEGER | Fragrantica Internal ID | Unique perfume identifier matching `fragrantica.com/perfume/*-{id}.html` | Public / Essential |
| `slug` | TEXT | Fragrantica URL slug | URL path segment `{Brand}/{Perfume-Name}` | Public / Essential |
| `name` | TEXT | Fragrantica Page Title | Official perfume commercial name | Public / Essential |
| `brand` | TEXT | Fragrantica Metadata | Perfume house / manufacturing brand | Public / Essential |
| `year` | INTEGER | Fragrantica Metadata | Launch / release year | Public / Informational |
| `collection` | TEXT | Fragrantica Metadata | Brand sub-collection line | Public / Informational |
| `gender` | TEXT | Fragrantica Metadata | Target gender classification (`men`, `women`, `unisex`) | Public / Informational |
| `url` | TEXT | Fragrantica Link | Direct URL to original Fragrantica page | Internal Reference |
| `description` | TEXT | Fragrantica Copy | Marketing blurbs and editorial overview | Public / Informational |
| `image_url` | TEXT | Fragrantica CDN (`fimgs.net`) | Image assets (`https://fimgs.net/mdimg/perfume/375x500.{id}.jpg`) | Public Asset Link |
| `perfumers` | TEXT | Fragrantica Metadata | Nose / perfumer credits | Public / Informational |
| `accords` | TEXT | Fragrantica Accord Bar | Main olfactory accords with normalized strength (0.0 to 1.0) | Public / Informational |
| `notes_top` | TEXT | Fragrantica Pyramid | Top / head olfactory notes (pipe-separated) | Public / Informational |
| `notes_middle` | TEXT | Fragrantica Pyramid | Heart / middle olfactory notes (pipe-separated) | Public / Informational |
| `notes_base` | TEXT | Fragrantica Pyramid | Base olfactory notes (pipe-separated) | Public / Informational |
| `notes_flat` | TEXT | Fragrantica Fallback | Unstructured notes list for perfumes lacking 3-tier pyramid | Public / Informational |
| `rating_avg` | REAL | Fragrantica Community | Aggregated score (1.0 to 5.0) | Public / Informational |
| `vote_count` | INTEGER | Fragrantica Community | Total user ratings submitted | Public / Informational |
| `longevity_avg` | REAL | Fragrantica Community | Aggregated user performance metric | Public / Informational |
| `sillage_avg` | REAL | Fragrantica Community | Aggregated user projection metric | Public / Informational |
| `price_value_avg`| REAL | Fragrantica Community | Aggregated user value assessment | Public / Informational |
| `seasons` | TEXT | Fragrantica Community | Seasonal votes (winter, spring, summer, autumn) | Public / Informational |
| `daypart` | TEXT | Fragrantica Community | Day vs Night wearability votes | Public / Informational |
| `ai_summary` | TEXT | Fragrantica AI Summary | Auto-generated summary text (potential leakage vector) | **Restricted / Internal Audit Only** |
| `similar.also_liked`| JSON | Fragrantica Community | Collaborative filtering graph ("people who like this also like") | **Community Source Only** |
| `similar.reminds_me_of`| JSON | Fragrantica Community | User-voted olfactory twin relations (`up_votes`, `down_votes`) | **Restricted / Build Precompute Only** |

---

## 2. Licensing Boundaries and Strict Safety Rules

The source file `perfumes.jsonl` contains raw community and proprietary scraped metadata. To maintain ethical, legal, and operational safety:

1. **NO RAW DUMPS IN REPO**:
   - `perfumes.jsonl`, raw SQL dumps, and intermediate evaluation splits must **NEVER** be committed into Git repositories.
   - Enforced by `.gitignore`:
     ```gitignore
     data/*
     !data/.gitkeep
     *.jsonl
     *.csv
     ```
2. **NO RAW DUMPS OR SCRAPED EDGES IN DOCKER / PRODUCTION IMAGES**:
   - Production Docker images must only receive the clean, final SQLite database (`perfumes.db`) or precomputed lookups.
   - Enforced by `.dockerignore`:
     ```dockerignore
     *.jsonl
     *.csv
     data/*
     !data/.gitkeep
     ```
   - An automated build-safety check (`scripts/verify-build-safety.js`) runs on `npm run build` to halt the build if any `*.jsonl` or raw edge dump files are detected in the repository workspace.
3. **ISOLATION OF COMMUNITY SIGNALS**:
   - Community similarity signals (`reminds_me_of`) are precomputed into a dedicated table (`similar`) with a build flag `INCLUDE_COMMUNITY_EDGES` (defaulting to off in pure content deployments).
   - The raw directed edge graph is never exposed via public APIs.
