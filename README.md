# Raphragrance — Olfactory Intelligence Archive

> An independent luxury fragrance encyclopedia and high-performance olfactory discovery archive cataloging **131,930+ fragrances** from heritage perfume houses to avant-garde artisanal ateliers.

Built with Next.js 16 App Router, TypeScript, and native SQLite (`node:sqlite`), Raphragrance delivers instantaneous search, note pyramid breakdowns, accord color swatches, and algorithmic similarity recommendations across one of the largest perfume databases in the world.

---

## Key Highlights

- **131,930+ Fragrance Profiles**: Exhaustive catalog of perfumes featuring launch years, perfumer credits, scent notes (top, heart, base), accords, bottle imagery, and community longevity/sillage metrics.
- **Dual-Database Provenance Guardrails**: Clean separation between content-only public artifacts (`data/perfumes.public.db` with 0 community rows) and internal hybrid research databases (`data/perfumes.full.db`), with fail-closed production protections.
- **Curated Similarity Overrides**: Version-controlled override system (`data/similar_overrides.csv`) with bidirectional mirroring, note citations, and strict schema validation.
- **Diverse Discovery Algorithm**: Recommendation engine enforcing a strict brand cap ($\le 2$ fragrances per brand) to avoid mono-brand echo chambers and promote genuine olfactory discovery.
- **Zero-CLS Image Architecture**: Hotlinked bottle imagery from `fimgs.net` with `referrerPolicy="no-referrer"` and instant fallback to accord-colored dynamic typography tiles with zero Cumulative Layout Shift (CLS = 0.000).
- **Editorial Luxury Aesthetic**: Custom Swatch design system featuring contrast-validated accord palettes (WCAG 2.1 AA certified across light and dark themes) and commercial Gilroy typography.
- **Production-Grade Container & Cloud Infrastructure**: Multi-stage standalone Docker container running under restricted Pod Security Standards (non-root UID 1001, read-only root filesystem, dropped capabilities) with full Kubernetes manifests.

---

## Architectural Overview

```
                                ┌───────────────────────────────┐
                                │     Next.js 16 App Router     │
                                │   (Standalone Server Output)   │
                                └──────────────┬────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
             ┌─────────▼─────────┐                           ┌─────────▼─────────┐
             │    Public Mode    │                           │    Hybrid Mode    │
             │ (Production Safe) │                           │  (Internal Only)  │
             └─────────┬─────────┘                           └─────────┬─────────┘
                       │                                               │
           ┌───────────▼───────────┐                       ┌───────────▼───────────┐
           │ data/perfumes.public.db │                     │  data/perfumes.full.db│
           │  • 131,930 perfumes   │                       │  • 131,930 perfumes   │
           │  • 0 community edges  │                       │  • Full graph edges   │
           │  • Content similarity │                       │  • Hybrid scoring     │
           │  • Curated overrides  │                       │  • Curated overrides  │
           └───────────────────────┘                       └───────────────────────┘
```

### Recommendation Cascade
When generating similar fragrance recommendations for an anchor fragrance, the engine follows a strict multi-tier hierarchy:
1. **Tier 1 — Curated Overrides (`data/similar_overrides.csv`)**: Verified owner recommendations (e.g., Afnan Supremacy Not Only Intense $\leftrightarrow$ Creed Aventus) are injected at rank 1 with an active provenance tag.
2. **Tier 2 — Hybrid Community Graph (Optional)**: If `INCLUDE_COMMUNITY_EDGES=true` (and authorized via `ALLOW_FULL_DB_IN_PROD=true` in production), high-confidence community similarity edges are loaded.
3. **Tier 3 — Content-Based Similarity**: Olfactory overlap across note pyramids, shared accords, and seasonal/gender alignment.
4. **Brand Cap Filtering**: No single brand may occupy more than 2 slots in the top-10 similar list, ensuring diversity across all recommendation surfaces.

---

## Data Safety & Dual-Database Provenance

Raphragrance implements strict fail-closed boundaries documented in [`docs/DATA_PROVENANCE.md`](docs/DATA_PROVENANCE.md):

| Attribute | Public Production (`perfumes.public.db`) | Hybrid Research (`perfumes.full.db`) |
| :--- | :--- | :--- |
| **Fragrance Rows** | 131,930 | 131,930 |
| **Community Rows** | **0** (strictly prohibited) | 3,121,659 |
| **Edge Tables** | **None** (`similar` table content-only) | `edges`, `similar` |
| **Curated Overrides** | 6 directed rows (3 bidirectional pairs) | 6 directed rows (3 bidirectional pairs) |
| **Default in Docker** | Yes (embedded in runner stage) | No (excluded from production builds) |
| **Fail-Closed Gate** | Starts cleanly with zero external deps | Throws hard exit if deployed in prod without `ALLOW_FULL_DB_IN_PROD=true` |

---

## Directory Structure

```
├── .github/
│   └── workflows/ci.yml           # GitHub Actions CI (Lint, Typecheck, Test, Build, E2E)
├── app/
│   ├── accords/page.tsx           # Accord index directory
│   ├── api/
│   │   ├── fragrances/            # Catalog search, filter, and pagination API
│   │   │   └── [id]/similar/      # Similar fragrance endpoint
│   │   ├── health/                # JSON health probe
│   │   └── sitemap-index/         # Sitemaps XML index
│   ├── brand/[...slug]/page.tsx   # Brand detail page
│   ├── brands/page.tsx            # Brand index directory
│   ├── fragrance/[...slug]/       # Fragrance detail page (Hero, Notes, Accords, Similar)
│   ├── healthz/route.ts           # Kubernetes liveness/readiness probe
│   ├── notes/page.tsx             # Note index directory
│   ├── robots.ts                  # Search engine crawl directives
│   ├── sitemap.ts                 # Chunked sitemap generator (45,000 URLs / sitemap)
│   ├── globals.css                # Luxury Swatch design tokens & WCAG AA contrast rules
│   └── layout.tsx                 # Root layout with skip link and Gilroy typography
├── assets/fonts/                  # Licensed Gilroy webfonts (.woff2)
├── components/                    # UI Components (Nav, Footer, FragranceTile, CatalogView, etc.)
├── data/
│   ├── anchors.json               # Canonical 19 evaluation benchmark anchors
│   ├── similar_overrides.csv      # Version-controlled curated overrides
│   └── perfumes.public.db         # Verified public SQLite database (131,930 rows)
├── docs/
│   ├── CURATED.md                 # Curated overrides specification & change process
│   └── DATA_PROVENANCE.md         # Database provenance boundaries & safety architecture
├── k8s/                           # Production Kubernetes manifests (Restricted Pod Security)
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── hpa.yaml
│   ├── ingress.yaml
│   └── service.yaml
├── lib/
│   ├── curated.ts                 # Curated overrides parser & validator
│   ├── data.ts                    # High-performance SQLite query layer & brand capping
│   ├── db.ts                      # Fail-closed SQLite database connection manager
│   ├── palette.ts                 # 24 accord color swatches & WCAG contrast calculations
│   └── types.ts                   # Core TypeScript domain definitions
├── reports/
│   ├── perf-results.json          # Canonical performance, latency, and 5-run mobile Lighthouse report
│   ├── similarity-results.json    # Canonical similarity benchmark results & acceptance cases
│   └── similar-review.html        # Interactive similarity review dashboard
├── scripts/
│   ├── benchmark_gate5_latency.js # Concurrency-20 HTTP latency benchmark
│   ├── check-fonts.js             # Gilroy font compliance gate
│   ├── reproduce_all_metrics.js   # 19-anchor similarity pipeline evaluator
│   ├── run_http_crawl.js          # 2,240-URL QA crawler
│   ├── run_lighthouse_5runs.js    # Mobile Lighthouse 5-run median runner
│   ├── run_slug_integrity.js      # 131,930 slug verification script
│   ├── verify-build-safety.js     # Build-time database isolation verifier
│   └── verify-palette.js          # WCAG 2.1 AA palette contrast checker
├── tests/
│   ├── curated_loader.test.js     # Unit tests for curated overrides validation
│   ├── data_safety.test.js        # Unit tests for fail-closed DB & brand capping
│   └── e2e/
│       ├── functional_qa.spec.ts  # Playwright E2E functional suite
│       └── images_fallback.spec.ts# Playwright zero-CLS image fallback suite
├── Dockerfile                     # Multi-stage standalone production container
├── docker-compose.yml             # Local production compose manifest
├── eslint.config.mjs              # ESLint 9 flat configuration
├── next.config.ts                 # CSP, security headers, standalone build config
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 22.0.0 or higher
- npm 10.0.0 or higher

### 1. Installation
```bash
git clone https://github.com/owner/raphragrance-rebuilt.git
cd raphragrance-rebuilt
npm ci
```

### 2. Environment Setup
Copy the reference environment file:
```bash
cp .env.example .env.local
```

### 3. Verify Font Assets
Ensure licensed Gilroy `.woff2` files are placed in `assets/fonts/`:
- `Gilroy-Regular.woff2`
- `Gilroy-Medium.woff2`
- `Gilroy-Bold.woff2`

*(If running in CI without commercial font assets, set `ALLOW_FALLBACK_FONT=true` to permit system font fallbacks).*

### 4. Build and Run
```bash
# Run safety verification and build standalone production bundle
npm run build

# Start production server
npm run start
```
Access the application at `http://localhost:3000`.

---

## Testing & Quality Assurance

Raphragrance enforces strict, zero-compromise automated verification gates:

```bash
# 1. Typecheck and Lint
npx tsc --noEmit
npm run lint

# 2. Curated Overrides & Data Safety Unit Tests
node --test tests/curated_loader.test.js
node --test tests/data_safety.test.js

# 3. Slug Integrity across 131,930 Fragrances
node scripts/run_slug_integrity.js

# 4. HTTP Crawl across 2,240 Stratified Targets
node scripts/run_http_crawl.js

# 5. Playwright End-to-End & Zero-CLS Tests
npx playwright test

# 6. Mobile Lighthouse 5-Run Median Audit
node scripts/run_lighthouse_5runs.js
```

---

## Deployment & Containerization

### Docker Build & Run
The multi-stage `Dockerfile` leverages Next.js standalone output and bundles `data/perfumes.public.db`:
```bash
docker build -t raphragrance:v1.0.0-rc2 .
docker run -p 3000:3000 raphragrance:v1.0.0-rc2
```

### Kubernetes (Production)
Deploy using the manifests in `k8s/`:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

The Kubernetes deployment runs under the **Restricted** Pod Security Standard with:
- Non-root user `1001:1001` (`nextjs`)
- Read-only root filesystem (`readOnlyRootFilesystem: true`)
- All Linux capabilities dropped (`drop: ["ALL"]`)
- `seccompProfile: RuntimeDefault`
- Liveness, readiness, and startup probes targeting `/healthz`

---

## License & Ownership

Copyright © 2026 **Raffa**. All rights reserved.  
Private proprietary software. Commercial reproduction or unauthorized distribution without express written consent is strictly prohibited.
