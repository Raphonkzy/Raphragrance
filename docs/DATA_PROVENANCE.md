# Data Provenance and Architecture Decisions

This document outlines the origins, data handling boundaries, statistical derivations, and operational risks associated with data in Raphragrance.

---

## 1. Provenance and Catalog Origin

The entire fragrance catalog in Raphragrance—including fragrance names, brand designations, launch years, olfactory accord hierarchies, pyramid notes (top, middle, base, flat), editorial marketing copy, user rating averages, and bottle image links—originates from scraped public profiles on **Fragrantica.com** (captured circa May 2026).

### 1.1 Repository Data Shipping Policy
- **The Git repository ships no raw data.**
- Neither raw JSONL dumps (`perfumes.jsonl`), raw scraping logs, intermediate evaluation splits (`eval_split.json`), nor database binaries (`perfumes.db`, `perfumes.public.db`, `perfumes.full.db`) are tracked or stored in Git history.
- The only data files tracked in Git are:
  - `data/.gitkeep` (directory structure preservation)
  - `data/anchors.json` (19 verified evaluation anchor IDs and slugs)
  - `data/similar_overrides.csv` (version-controlled owner curated overrides)

This policy is enforced by `.gitignore`:
```gitignore
# Data (large files, local only)
data/*
!data/.gitkeep
!data/similar_overrides.csv
!data/anchors.json
*.jsonl
*.csv
!data/similar_overrides.csv
scripts/eval_split.json
```

---

## 2. Public vs. Hybrid Database Boundaries

To decouple the application from scraped collaborative-filtering user graphs, the platform builds two distinct SQLite database artifacts:

### 2.1 Public Database (`data/perfumes.public.db`)
- **Default production artifact**: This is the only database copied into the production container image.
- **Zero community graph rows**: The `similar` table contains strictly `source = 'content'` (algorithmic TF-IDF note & accord matching) and `source = 'curated'` (owner-provided clone/counterpart pairs).
- **Zero edge tables**: Contains no `reminds_me_of`, `also_liked`, or user voting graph tables.
- **Verification**: Verified at build time by `scripts/verify-build-safety.js` in CI and Docker builds.

### 2.2 Full Database (`data/perfumes.full.db`)
- **Experimental hybrid artifact**: Combines content calculations with 79,048 directed community edges (`source = 'community'`) for internal benchmarking and optional development exploration.
- **Fail-closed guardrails**:
  - Unset `INCLUDE_COMMUNITY_EDGES` -> defaults strictly to `data/perfumes.public.db`.
  - `INCLUDE_COMMUNITY_EDGES=true` but `data/perfumes.full.db` is missing -> immediate hard startup error (no silent fallback).
  - `INCLUDE_COMMUNITY_EDGES=true` in production (`NODE_ENV=production`) -> refuses to start unless an explicit second environment flag `ALLOW_FULL_DB_IN_PROD=true` is set.
  - Hybrid recommendations strictly enforce a brand diversity cap of at most 2 fragrances per brand.

---

## 3. What Was Derived from Community Data

Community data (`reminds_me_of` voting edges from Fragrantica) was used strictly for offline optimization and offline evaluation. Specifically:

1. **Six Global Hyperparameter Weights**:
   The content-only similarity engine uses 6 global scalar weights learned via training-set optimization:
   - `noteSim`: `0.35` (TF-IDF cosine similarity on canonical notes)
   - `containmentQtoC`: `0.25` (asymmetric containment of query notes in candidate)
   - `containmentCtoQ`: `0.10` (asymmetric containment of candidate notes in query)
   - `accordSim`: `0.40` (mean-centered cosine correlation across accords)
   - `top1AccordMatch`: `0.05` (bonus for matching primary accord)
   - `gender_penalty`: `0.08` (penalty for opposite-gender recommendations)
   *(Note: The brand-based `isClone` weight was ablated and set to `0.00` to prevent brand bias).*

2. **Evaluation Ground Truth**:
   Community neighbor edges were used as the ground truth benchmark for Hit@10, TopGT Recall@10, and nDCG@10 metrics across validation and test splits (`data/eval_split.json`).

No individual user graphs or relational edges are embedded into the content algorithm. Content similarity calculates pairwise distance purely from the fragrance's note lists, accord bars, and gender attributes.

---

## 4. Hotlinking Decision and CDN Strategy

Fragrance bottle photos are hotlinked directly from `https://fimgs.net` (Fragrantica's image CDN).
- **No image scraping or hosting**: Images are not downloaded, stored, transformed, or re-hosted on Raphragrance infrastructure.
- **Technical implementation**:
  - Image requests include `referrerPolicy="no-referrer"` to prevent sending the application's origin header to third-party servers.
  - Images declare fixed width and height dimensions (`width={250}` and `height={333}` for tiles; `width={280}` and `height={373}` for hero displays) with `aspect-ratio: 1/1` containers to eliminate Cumulative Layout Shift (CLS).
  - All images use `loading="lazy"` except the detail page hero image (`loading="eager"`).
  - An inline client fallback instantly replaces failed or blocked image loads (`onError`) with a tile styled in the fragrance's primary accord color displaying the fragrance initials.

---

## 5. Risks and Owner Decisions

*Notice: This section outlines operational, legal, and architectural trade-offs for technical governance. It does not constitute formal legal advice.*

### 5.1 Scraped Catalog Data
- **Context**: The catalog contains ~131,930 perfume profiles with note pyramids, accord definitions, and descriptions scraped from Fragrantica.
- **Risks**: Fragrantica's Terms of Service restrict automated data collection and commercial republishing. While factual information (such as perfume names, brand names, release years, and standard raw fragrance ingredients) generally lacks copyright protection in many jurisdictions, compilation rights (database directives) and proprietary marketing copy may carry legal risk.
- **Owner Decision Needed**:
  - **Option A (Current)**: Keep public distribution restricted to factual fragrance profiles and precomputed content-only similarities (`perfumes.public.db`), retaining community edges strictly for offline research.
  - **Option B**: Replace scraped editorial marketing descriptions with public-domain manufacturer press releases or synthetic sensory summaries.

### 5.2 Hotlinked Images
- **Context**: Bottle imagery is loaded in client browsers directly from `fimgs.net`.
- **Risks**:
  - The third-party CDN operator can block requests based on IP, user-agent, or referrers at any time.
  - Image URLs can break, change paths, or rot without notice.
  - Hotlinking shifts bandwidth load to third-party infrastructure, which can prompt copyright or anti-hotlinking countermeasures.
- **Owner Decision Needed**:
  - **Option A (Current)**: Maintain zero-rehost hotlinking with `no-referrer` and client-side accord-colored fallback tiles.
  - **Option B**: Transition to independent self-hosted object storage (e.g., Cloudflare R2 / S3) populated with licensed brand bottle renders or user-submitted photography.
  - **Option C**: Replace bottle imagery entirely with the dynamic SVG bottle silhouette styled in the fragrance's primary accord color.

### 5.3 Community Edge Exposure
- **Context**: `INCLUDE_COMMUNITY_EDGES` toggles whether community recommendation edges appear in the UI.
- **Policy**: Kept **OFF by default** in production (`ALLOW_FULL_DB_IN_PROD=true` required).
