# Curated Similarity Overrides Guide

This document describes how to curate known fragrance counterpart and clone pairs in Raphragrance. Curated overrides are the deterministic, version-controlled mechanism for known clones and counterparts that cannot be resolved from marketing pyramid notes alone.

---

## 1. File Location and Format

Curated pairs are stored in:
`data/similar_overrides.csv`

The file is tracked by Git. It uses standard CSV format with a 4-column header:

```csv
a_slug,b_slug,strength,note
Afnan/Supremacy-Not-Only-Intense,Creed/Aventus,1.0,owner-provided
Afnan/Supremacy-Not-Only-Intense,Nishane/Hacivat,0.95,owner-provided
Afnan/Turathi-Electric,Ex-Nihilo/Blue-Talisman,0.95,owner-provided
```

### Columns:
1. `a_slug` (string, required): Exact URL slug of fragrance A (e.g. `Afnan/Supremacy-Not-Only-Intense`).
2. `b_slug` (string, required): Exact URL slug of fragrance B (e.g. `Creed/Aventus`).
3. `strength` (float, required, `0.0` to `1.0`): Similarity weighting factor (typically `0.9` to `1.0`).
4. `note` (string, required): Editorial or provenance note (e.g. `owner-provided`).

### Bidirectional Injection
Overrides are **bidirectional**. When you specify `A,B`, the build pipeline automatically injects:
- `A -> B` as a rank #1 / curated result on fragrance A's page.
- `B -> A` as a rank #1 / curated result on fragrance B's page.
Do **not** manually add the reverse pair; doing so will trigger a duplicate pair validation error.

---

## 2. Validation Rules Enforced at Build Time

The build pipeline (`scripts/verify-build-safety.js` and `scripts/build_dual_databases.js`) enforces strict automated validation. The build will immediately **FAIL** if any of the following occur:
1. **Unknown Slug**: Either `a_slug` or `b_slug` does not exist in the 131,930-fragrance catalog.
2. **Self Pair**: `a_slug` is identical to `b_slug`.
3. **Duplicate Pair**: The pair `(A, B)` or `(B, A)` has already been defined earlier in the file.
4. **Strength Out of Bounds**: The `strength` value is less than `0.0`, greater than `1.0`, or not a number.
5. **Malformed Row**: A row has fewer than 4 columns or missing slug values.

---

## 3. How to Add a New Pair

### Step 1: Find the Exact Slugs
Verify that both fragrance slugs exist in the database:
```bash
node -e "const db = new (require('node:sqlite').DatabaseSync)('data/perfumes.public.db'); console.log(db.prepare(\"SELECT slug, name, brand FROM perfumes WHERE name LIKE '%Aventus%' LIMIT 5\").all());"
```

### Step 2: Add One Line to `data/similar_overrides.csv`
Open `data/similar_overrides.csv` and append your pair at the bottom:
```csv
Brand-A/Fragrance-A,Brand-B/Fragrance-B,0.95,owner-provided
```

### Step 3: Rebuild the Database
Run the dual database rebuild script:
```bash
node scripts/build_dual_databases.js
```
This merges the curated pairs into both `perfumes.public.db` and `perfumes.full.db` with `source = 'curated'` at rank 1..k.

### Step 4: Verify the Build & Overrides
Run the build safety check:
```bash
node scripts/verify-build-safety.js
```
And verify that the pairs appear in the database:
```bash
node -e "const db = new (require('node:sqlite').DatabaseSync)('data/perfumes.public.db'); console.log(db.prepare(\"SELECT s.fragrance_id, p1.name AS query, p2.name AS target, s.rank, s.source FROM similar s JOIN perfumes p1 ON p1.id = s.fragrance_id JOIN perfumes p2 ON p2.id = s.similar_id WHERE s.source = 'curated'\").all());"
```

### Step 5: Run Unit Tests
```bash
node --test tests/curated_loader.test.js
```
