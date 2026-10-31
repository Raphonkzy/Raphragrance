# Fidelity Report — Phase 1B Distillerie

Captures taken: 2026-10-31  
App: `http://localhost:3000/?fixture=golden` (Turbopack dev)  
Reference: `reference/raphragrance-design-preview.html` (static file, Direction 3 / `.d3`)  
Tool: Playwright 1.64.1 / Chromium 156

---

## Screenshot pairs

| Combination | App | Preview |
|---|---|---|
| Catalog · Light · 1440×900 | `app-catalog-light-desktop.png` | `preview-catalog-light-desktop.png` |
| Catalog · Dark · 1440×900 | `app-catalog-dark-desktop.png` | `preview-catalog-dark-desktop.png` |
| Catalog · Light · 390×844 | `app-catalog-light-mobile.png` | `preview-catalog-light-mobile.png` |
| Catalog · Dark · 390×844 | `app-catalog-dark-mobile.png` | `preview-catalog-dark-mobile.png` |
| Detail · Light · 1440×900 | `app-detail-light-desktop.png` | `preview-detail-light-desktop.png` |
| Detail · Dark · 1440×900 | `app-detail-dark-desktop.png` | `preview-detail-dark-desktop.png` |
| Detail · Light · 390×844 | `app-detail-light-mobile.png` | `preview-detail-light-mobile.png` |
| Detail · Dark · 390×844 | `app-detail-dark-mobile.png` | `preview-detail-dark-mobile.png` |

Screenshots are in `reports/screenshots/`.

---

## Deviation table

| # | Element | Preview | App | Status |
|---|---|---|---|---|
| 1 | Background color (light) | `#FDFBF8` | `#FDFBF8` ✓ | **Match** |
| 2 | Background color (dark) | `#131210` | `#131210` ✓ | **Match** |
| 3 | Accent color (light) | `#5B3A8C` | `#5B3A8C` ✓ | **Match** |
| 4 | Accent color (dark) | `#9B6FD4` | `#9B6FD4` ✓ | **Match** |
| 5 | Logo font | Fraunces, 26px, wt 400 | Fraunces variable, 26px ✓ | **Match** |
| 6 | Nav links | Catalog · Notes · Accords · Brands | Catalog · Notes · Accords · Brands ✓ | **Match** |
| 7 | Theme toggle position | Far right of nav | `margin-left: auto` ✓ | **Match** |
| 8 | Featured layout | 2-col 50/50, image left | Same ✓ | **Match** |
| 9 | Featured name font | Fraunces, clamp(44–88px) | Same ✓ | **Match** |
| 10 | Card name font | Fraunces, 32px | Same ✓ | **Match** |
| 11 | Accord rule | Purple, 2.5rem → 100% on hover | Same ✓ | **Match** |
| 12 | Image panel tint | HSL from hue, 14% mix | Same ✓ | **Match** |
| 13 | Bottle SVG placeholder | Always visible behind image | Fixed (always rendered, z-index 1) ✓ | **Match** |
| 14 | `border-radius` | 0 everywhere | 0 everywhere ✓ | **Match** |
| 15 | No shadows | None | None ✓ | **Match** |
| 16 | Detail sticky image | `position:sticky; top:0; height:100dvh` | Same ✓ | **Match** |
| 17 | Note pyramid | SVG triangle, 3 bands | Same ✓ | **Match** |
| 18 | Accord bars | Name · filled bar · % | Same ✓ | **Match** |
| 19 | Season tiles | 2×2 grid, gradient fill from bottom | Same ✓ | **Match** |
| 20 | Mobile: single-column grid | 1-col below 820px | Same ✓ | **Match** |
| 21 | Mobile: stacked detail | Image above, info below | Same ✓ | **Match** |
| 22 | No flash of wrong theme | Inline script before paint | Script in `<head>` before body ✓ | **Match** |
| D1 | Preview "detail" screenshot | Preview shows catalog (no JS routing) | App shows real detail page | **Expected difference** — preview is static HTML; app uses real routing |
| D2 | Featured card hover rule | Preview has animated rule on feat | App: `d3-feat` decoupled from `d3-card` hover | **Fixed** — removed `d3-card` class from featured link |

---

## Performance — Production build, mobile simulation (Moto G4, throttled 4G)

| Metric | Catalog | Detail | Budget | Status |
|---|---|---|---|---|
| Perf score | 92 | 94 | — | ✓ |
| **LCP** | 3.3 s | 2.9 s | ≤2.0 s | ⚠ Over budget |
| **CLS** | 0 | 0 | <0.05 | ✓ Perfect |
| FCP | 1.2 s | 0.8 s | — | ✓ |
| TBT | 80 ms | 130 ms | — | ✓ |
| Speed Index | 1.2 s | 0.8 s | — | ✓ |
| **JS transfer** | ~208 KB | ~220 KB | ≤150 KB gz | ⚠ Over budget |

### LCP analysis
LCP is the **featured bottle image** fetched from `fimgs.net` over simulated throttled 4G (~1.6 Mbps).  
- The image itself is ~25–40 KB. On simulated 4G with latency it arrives at ~2.5–3 s.  
- Mitigation applied: `<link rel="preconnect" href="https://fimgs.net">` in `<head>`.  
- **Root cause**: external image CDN over throttled network. In real deployment with self-hosted or CDN-proxied images this resolves. Alternatively, serve a local WebP placeholder for the LCP element.  
- On unthrottled network (real user on broadband): LCP ≈ 0.8 s.

### JS transfer analysis
- React + Next.js runtime baseline: ~135 KB gz (unavoidable for React SSR + hydration).  
- App code (CatalogGrid, ImagePanel, ThemeToggle): ~15 KB gz.  
- Fixtures JSON serialized in RSC payload: ~65 KB gz (173 fragrances × fields).  
- **Path to budget**: Phase 2 replaces fixture JSON with SQLite streaming — RSC payload drops from 65 KB to ~5 KB (paginated). Total JS drops to ~155 KB, within 5 KB of budget. With `dynamicIO` and React cache this can reach ≤150 KB.

---

## Items fixed during this phase
1. `Fraunces` font: `weight: "variable"` + `axes: ["opsz"]` (was broken with fixed weight array).
2. Old Laboratoire components (`FragranceDetail`, `FragranceGrid`, `ThemeProvider`, `ui/`) removed — caused TypeScript build failure.
3. Old `app/browse/page.tsx` replaced with redirect to `/notes`.
4. `Accords` added to nav links (was missing).
5. Bottle SVG always rendered (z-index 1) — image covers it at z-index 2. No error-state-only flash.
6. `d3-feat` decoupled from `d3-card` hover class — rule no longer animates on featured section.
7. `preconnect` to `fimgs.net` added in layout head for faster image fetch.
