# Data Provenance and Licensing Policy

## 1. Provenance of Fragrance Data

Raphragrance's dataset originates from scraped public profiles on **Fragrantica.com** (captured circa May 2026, timestamp `1780102667`).

### 1.1 Complete Audit of `data/perfumes.public.db` Schema

The public database artifact `data/perfumes.public.db` is strictly partitioned. It contains exactly two tables:

#### Table 1: `perfumes` (31 Columns)
| Column Name | SQLite Type | Description / Origin |
|:---|:---|:---|
| `id` | INT | Fragrantica Internal Numeric ID |
| `slug` | TEXT | URL slug identifier (`{Brand}/{Perfume-Name}`) |
| `name` | TEXT | Perfume commercial name |
| `brand` | TEXT | Perfume brand / house name |
| `year` | INT | Launch / release year |
| `collection` | TEXT | Brand sub-collection |
| `gender` | TEXT | Target gender (`men`, `women`, `unisex`) |
| `url` | TEXT | Canonical profile URL |
| `rating_avg` | REAL | Aggregated user rating (1.0 to 5.0) |
| `vote_count` | INT | Total ratings count |
| `longevity_avg` | REAL | User longevity rating |
| `sillage_avg` | REAL | User sillage rating |
| `price_value_avg`| REAL | User price/value rating |
| `have_count` | INT | User cabinet "have" count |
| `had_count` | INT | User cabinet "had" count |
| `want_count` | INT | User cabinet "want" count |
| `winter_votes` | INT | Seasonal wear votes (winter) |
| `spring_votes` | INT | Seasonal wear votes (spring) |
| `summer_votes` | INT | Seasonal wear votes (summer) |
| `autumn_votes` | INT | Seasonal wear votes (autumn) |
| `day_votes` | INT | Time-of-day wear votes (day) |
| `night_votes` | INT | Time-of-day wear votes (night) |
| `people_votes` | INT | Total people voting on wearability |
| `accords` | TEXT | Olfactory accord bars with strength (`accord:strength|...`) |
| `notes_top` | TEXT | Head/top notes (pipe-separated) |
| `notes_middle` | TEXT | Heart/middle notes (pipe-separated) |
| `notes_base` | TEXT | Base notes (pipe-separated) |
| `notes_flat` | TEXT | Unstructured fallback notes (pipe-separated) |
| `perfumers` | TEXT | Credited perfumer(s) |
| `description` | TEXT | Editorial description / marketing copy |
| `image_url` | TEXT | CDN asset URL |

#### Table 2: `similar` (5 Columns)
| Column Name | SQLite Type | Description |
|:---|:---|:---|
| `fragrance_id` | INTEGER | Query perfume ID |
| `similar_id` | INTEGER | Target recommended perfume ID |
| `rank` | INTEGER | Recommendation rank (1..30) |
| `score` | REAL | Computed similarity score |
| `source` | TEXT | Provenance tag: strictly `'content'` (3,881,308 rows) or `'curated'` (6 rows) |

#### Negative Confirmation: Prohibited Columns & Tables
- **NO `ai_summary`**: Scraped AI-generated summaries are completely absent.
- **NO `reminds_me_of`**: Fragrantica's user-voted similarity edges are completely absent.
- **NO `also_liked`**: Collaborative filtering edges are completely absent.
- **NO edge or community tables**: `perfumes.public.db` contains ZERO rows with `source = 'community'`.

---

## 2. What Was Learned from Community Signals for the Content Engine?

The content-only similarity engine operates entirely from marketing olfactory pyramids (notes and accords) and brand metadata. The **only** information derived from community edges (`reminds_me_of`) is:

1. **Global Hyperparameter Weights**:
   A set of 6 scalar floating-point coefficients tuned on the Training split:
   - `noteSim`: `0.35` (TF-IDF weighted cosine similarity on canonical notes)
   - `containmentQtoC`: `0.25` (asymmetric containment of query notes in candidate)
   - `containmentCtoQ`: `0.10` (asymmetric containment of candidate notes in query)
   - `accordSim`: `0.40` (mean-centered cosine correlation across accords)
   - `top1AccordMatch`: `0.05` (indicator bonus for matching primary accord)
   - `isClone`: `0.00` (disabled in aggregate engine to avoid subjective brand bias)
   - `gender_penalty`: `0.08` (soft penalty for cross-gender recommendations)

2. **No Data Leakage / Memorization**:
   - No individual edges, pairs, or graph clusters were memorized or transferred into the content engine.
   - Pairwise recommendations in `perfumes.public.db` are generated purely via algorithmic cosine and containment calculations over note and accord features.
   - Benchmark acceptance clone pairs that cannot be resolved by marketing notes alone are handled explicitly and transparently via version-controlled curated overrides (`data/similar_overrides.csv`).

---

## 3. Licensing Boundaries and Strict Safety Rules

The original raw dataset (`perfumes.jsonl`) contains scraped community metadata. To maintain ethical, legal, and operational safety:

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
   - Production Docker images must only receive `data/perfumes.public.db`.
   - Enforced by `.dockerignore` and `scripts/verify-build-safety.js`.
3. **ISOLATION OF COMMUNITY SIGNALS & DUAL ARTIFACTS**:
   - Production builds consume `data/perfumes.public.db` by default (strictly containing content rows and curated overrides, with 0 community rows and no edge tables).
   - Hybrid builds consume `data/perfumes.full.db` when `INCLUDE_COMMUNITY_EDGES=true` is explicitly set.
   - Note on data boundaries: Because the entire fragrance catalog originates from scraped public profiles, the content-only build (`perfumes.public.db`) excludes the community vote graph (`reminds_me_of`), while preserving olfactory note pyramids, accords, and brand metadata.
