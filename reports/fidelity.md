# Raphragrance — Direction 2 (Laboratoire) Fidelity & Verification Report

## Executive Summary
Raphragrance has been rebuilt from scratch implementing **Direction 2 ("Laboratoire")**, pixel-faithful to `reference/raphragrance-design-preview.html` (`.d2`). Tailwind has been removed in its entirety (`@tailwindcss/postcss`, `tailwindcss`, `postcss.config.mjs`, and `tailwind.config.ts` deleted), replaced with pure CSS custom properties.

---

## 1. Contrast Compliance (User Adjustment 1)

### Contrast Audit Results
- **Dark Theme (`--bg: #0F0F0D`, Luminance 0.0053)**
  - Formula: `L = 44 + 8 * i` (`hsl(215 65% L%)`), clamped at 78%:
    - Segment 0 (`L = 44%`): **3.28:1** (≥ 3.0:1 ✓)
    - Segment 1 (`L = 52%`): **4.36:1** (≥ 3.0:1 ✓)
    - Segment 2 (`L = 60%`): **5.75:1** (≥ 3.0:1 ✓)
    - Segment 3 (`L = 68%`): **7.56:1** (≥ 3.0:1 ✓)
    - Segment 4 (`L = 76%`): **9.72:1** (≥ 3.0:1 ✓)
- **Light Theme (`--bg: #F0F0EE`, Luminance 0.8520)**
  - Formula: `L = 26 + 7 * i` (`hsl(215 65% L%)`), clamped at 58%:
    - Segment 0 (`L = 26%`): **9.68:1** (≥ 3.0:1 ✓)
    - Segment 1 (`L = 33%`): **7.50:1** (≥ 3.0:1 ✓)
    - Segment 2 (`L = 40%`): **5.87:1** (≥ 3.0:1 ✓)
    - Segment 3 (`L = 47%`): **4.60:1** (≥ 3.0:1 ✓)
    - Segment 4 (`L = 54%`): **3.60:1** (≥ 3.0:1 ✓)
- **Implementation**: Mapped via CSS custom properties `--ramp-0` through `--ramp-5` on `:root` and `:root[data-theme="dark"]`. Theme switching requires zero client-side recalculation.
- **Accessibility Safeguard**: Exact percentages (e.g., `100%`, `88%`, `74%`) and accord names are explicitly rendered in the mono table so visual information never depends on color alone.
- **Visual Evidence Captured**:
  - `reports/screenshots-d2-app/contrast-stacked-bar-light.png`
  - `reports/screenshots-d2-app/contrast-stacked-bar-dark.png`
  - `reports/screenshots-d2-app/contrast-card-strip-light.png`
  - `reports/screenshots-d2-app/contrast-card-strip-dark.png`

---

## 2. Catch-All Slashes & Brand Verification (User Adjustment 2)

A direct query on the real SQLite database (`perfumes.db`) confirmed:
- **Perfume slugs containing `/`**: 131,930 (100% of all perfumes in database).
- **Perfume slugs without `/`**: 0.
- **Brands containing `/`**: 9 brands out of 7,876 unique brands:
  - `BENCH/PH`
  - `By / Rosie Jane`
  - `E/4 Fragrance`
  - `I/ME`
  - `INVISIBLE/HR1`
  - `There/Then`
  - `unvisual/parfums`
  - `V/SITEUR`
  - `Angel Heart / エンジェルハート`
- **Architecture**:
  - Perfume detail route: `app/fragrance/[...slug]/page.tsx`
  - Brand route: `app/brand/[...slug]/page.tsx`
  - Both routes handle decoded multi-segment parameters cleanly. Unknown slugs trigger Next.js `notFound()`.
  - Tested and captured: `/brand/BENCH/PH` rendered without 404 (`reports/screenshots-d2-app/app-edge-brand-with-slash.png`).

---

## 3. Real-Fixture Edge Case Extraction (User Adjustment 3)

`fixtures/fragrances.json` contains **301 real rows** extracted directly from SQLite database covering edge cases:
1. High popularity perfumes (>2500 votes): 130 records
2. High rating classics (>4.2 rating, 300-2500 votes): 80 records
3. Gender distribution: Men (30), Women (30), Unisex (30)
4. Flat notes only (no top/heart/base pyramid): 15 records (verified with *Lanvin Eclat d'Arpège*)
5. No notes at all: 10 records
6. Missing release year (`year IS NULL OR 0`): 20 records (verified with *Gary by SpongeBob Squarepants*)
7. Extra-long perfume names (>40 characters): 20 records
8. Many accords (>5 accords): 30 records (rendered with up to 8–10 segments)
9. No accords recorded: 15 records
10. All 9 brands with slashes in name included.

---

## 4. Pure CSS & Complete Removal of Tailwind (User Adjustment 4)

- Removed `@tailwindcss/postcss` and uninstalled `tailwindcss`.
- Deleted `postcss.config.mjs` and `tailwind.config.ts`.
- Zero Tailwind `@import` or utility classes remain.
- Pure CSS design tokens in `app/globals.css`:
  - Light tokens: `--bg: #F0F0EE`, `--sf: #FFFFFF`, `--bd: #CDCDC8`, `--tx: #0F0F0D`, `--tx2: #5C5C58`, `--ac: #0055CC`, `--ac2: #CC3300`.
  - Dark tokens: `--bg: #0F0F0D`, `--sf: #161614`, `--bd: #2A2A26`, `--tx: #E8E8E4`, `--tx2: #888884`, `--ac: #4D8FFF`, `--ac2: #FF6644`.
  - Fonts: Instrument Serif (`--fd`), IBM Plex Mono (`--fm`), IBM Plex Sans (`--fb`) via `next/font/google`.

---

## 5. Server Component Image Architecture & JS Budget (User Adjustment 5)

- `ImagePanel` and `FragranceCard` are **100% Server Components**.
- Image error fallback is handled by a single shared browser listener in `app/layout.tsx`:
  ```javascript
  window.addEventListener('error', function(e){
    if (e.target && e.target.tagName === 'IMG') e.target.style.display = 'none';
  }, true);
  ```
- **Measured Initial JS on Home Page (`/`)**:
  - Modern browser JS downloaded (excluding `noModule` polyfill): **140.6 KB gzip**.
  - Target budget: **≤ 150 KB gzip** (**Passes within budget**).

---

## 6. Visual Fidelity Check: 8 Golden Combinations

Comparison of App (`reports/screenshots-d2-app/`) vs Preview (`reports/screenshots-d2-preview/`):

| # | Route | Theme | Viewport | Preview Screenshot | App Screenshot | Match Status |
|---|-------|-------|----------|-------------------|----------------|--------------|
| 1 | Catalog | Light | Desktop 1440×900 | `preview-d2-catalog-light-desktop.png` | `app-d2-catalog-light-desktop.png` | **Pixel Faithful** |
| 2 | Catalog | Dark | Desktop 1440×900 | `preview-d2-catalog-dark-desktop.png` | `app-d2-catalog-dark-desktop.png` | **Pixel Faithful** |
| 3 | Catalog | Light | Mobile 390×844 | `preview-d2-catalog-light-mobile.png` | `app-d2-catalog-light-mobile.png` | **Pixel Faithful** |
| 4 | Catalog | Dark | Mobile 390×844 | `preview-d2-catalog-dark-mobile.png` | `app-d2-catalog-dark-mobile.png` | **Pixel Faithful** |
| 5 | Detail | Light | Desktop 1440×900 | `preview-d2-detail-light-desktop.png` | `app-d2-detail-light-desktop.png` | **Pixel Faithful** |
| 6 | Detail | Dark | Desktop 1440×900 | `preview-d2-detail-dark-desktop.png` | `app-d2-detail-dark-desktop.png` | **Pixel Faithful** |
| 7 | Detail | Light | Mobile 390×844 | `preview-d2-detail-light-mobile.png` | `app-d2-detail-light-mobile.png` | **Pixel Faithful** |
| 8 | Detail | Dark | Mobile 390×844 | `preview-d2-detail-dark-mobile.png` | `app-d2-detail-dark-mobile.png` | **Pixel Faithful** |

---

## 7. Verification Results: TypeScript, Build & Lighthouse

### TypeScript Verification
```powershell
npx tsc --noEmit
# Exit code 0 (0 errors)
```

### Production Build
```powershell
npx next build
# Compiled successfully in 1014ms
# Static routes + Dynamic catch-all routes generated without errors
```

### Mobile Lighthouse Audits (Production Server, Port 3001)

| Route | Performance | Accessibility | Best Practices | SEO | Core Web Vitals |
|-------|:-----------:|:-------------:|:--------------:|:---:|:----------------|
| **Detail Page** (`/fragrance/Maison-Francis-Kurkdjian/Baccarat-Rouge-540`) | **99** | **98** | **96** | **100** | FCP 0.8s, LCP 0.8s, TBT 110ms, CLS 0 |
| **Catalog Page** (`/`) | **81** | **100** | **96** | **100** | FCP 1.5s, LCP 3.9s, TBT 320ms, CLS 0 |
