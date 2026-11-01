const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const readline = require('readline');

const db = new DatabaseSync('data/perfumes.db');

console.log("=== RUNNING SECTION 1 DATA AUDIT ===");

// 1. Column analysis
const cols = db.prepare("PRAGMA table_info(perfumes)").all();
console.log("\n1.1 DB COLUMNS:");
console.log(cols.map(c => `${c.name} (${c.type})`).join(', '));

// 2. Data quality metrics
console.log("\n2. DATA QUALITY AUDIT:");
const totalRow = db.prepare("SELECT COUNT(*) as c FROM perfumes").get();
const total = totalRow.c;
console.log(`Total perfumes in DB: ${total}`);

// No notes at all
const noNotesRow = db.prepare(`
  SELECT COUNT(*) as c FROM perfumes
  WHERE (notes_top IS NULL OR notes_top = '')
    AND (notes_middle IS NULL OR notes_middle = '')
    AND (notes_base IS NULL OR notes_base = '')
    AND (notes_flat IS NULL OR notes_flat = '')
`).get();
console.log(`Fragrances with NO notes at all: ${noNotesRow.c} (${(noNotesRow.c / total * 100).toFixed(2)}%)`);

// Only flat notes
const onlyFlatRow = db.prepare(`
  SELECT COUNT(*) as c FROM perfumes
  WHERE (notes_flat IS NOT NULL AND notes_flat != '')
    AND (notes_top IS NULL OR notes_top = '')
    AND (notes_middle IS NULL OR notes_middle = '')
    AND (notes_base IS NULL OR notes_base = '')
`).get();
console.log(`Fragrances with ONLY flat notes: ${onlyFlatRow.c} (${(onlyFlatRow.c / total * 100).toFixed(2)}%)`);

// Has full pyramid (top, middle, base)
const fullPyramidRow = db.prepare(`
  SELECT COUNT(*) as c FROM perfumes
  WHERE (notes_top IS NOT NULL AND notes_top != '')
    AND (notes_middle IS NOT NULL AND notes_middle != '')
    AND (notes_base IS NOT NULL AND notes_base != '')
`).get();
console.log(`Fragrances with tiered pyramid (top, mid, base): ${fullPyramidRow.c} (${(fullPyramidRow.c / total * 100).toFixed(2)}%)`);

// No accords
const noAccordsRow = db.prepare(`
  SELECT COUNT(*) as c FROM perfumes
  WHERE accords IS NULL OR accords = ''
`).get();
console.log(`Fragrances with NO accords: ${noAccordsRow.c} (${(noAccordsRow.c / total * 100).toFixed(2)}%)`);

// Single accord
const singleAccordRow = db.prepare(`
  SELECT COUNT(*) as c FROM perfumes
  WHERE accords IS NOT NULL AND accords != '' AND accords NOT LIKE '%|%'
`).get();
console.log(`Fragrances with SINGLE accord: ${singleAccordRow.c} (${(singleAccordRow.c / total * 100).toFixed(2)}%)`);

// Both no notes and no accords (extreme sparse)
const noNotesNoAccords = db.prepare(`
  SELECT COUNT(*) as c FROM perfumes
  WHERE (notes_top IS NULL OR notes_top = '')
    AND (notes_middle IS NULL OR notes_middle = '')
    AND (notes_base IS NULL OR notes_base = '')
    AND (notes_flat IS NULL OR notes_flat = '')
    AND (accords IS NULL OR accords = '')
`).get();
console.log(`Fragrances with NEITHER notes NOR accords: ${noNotesNoAccords.c} (${(noNotesNoAccords.c / total * 100).toFixed(2)}%)`);

// Duplicate or near-duplicate names
console.log("\n2.2 NAME DUPLICATIONS & INCONSISTENCIES:");
const duplicateSameBrand = db.prepare(`
  SELECT name, brand, COUNT(*) as c
  FROM perfumes
  GROUP BY LOWER(TRIM(name)), LOWER(TRIM(brand))
  HAVING c > 1
`).all();
console.log(`Distinct (name, brand) pairs that have exact duplicate rows: ${duplicateSameBrand.length}`);
let totalDuplicateRows = duplicateSameBrand.reduce((acc, r) => acc + (r.c - 1), 0);
console.log(`Total redundant duplicate rows from same brand: ${totalDuplicateRows}`);
console.log("Sample duplicates:", duplicateSameBrand.slice(0, 5));

const duplicateAcrossBrands = db.prepare(`
  SELECT LOWER(TRIM(name)) as n, COUNT(DISTINCT LOWER(TRIM(brand))) as brand_count, COUNT(*) as c
  FROM perfumes
  GROUP BY LOWER(TRIM(name))
  HAVING brand_count > 1
`).all();
console.log(`Fragrance names shared across different brands: ${duplicateAcrossBrands.length} distinct names (representing ${duplicateAcrossBrands.reduce((a, b) => a + b.c, 0)} total rows)`);
console.log("Sample shared names:", duplicateAcrossBrands.slice(0, 5));

// Inconsistent note spellings analysis
console.log("\n2.3 NOTE VOCABULARY AUDIT:");
const allNotesRows = db.prepare("SELECT notes_top, notes_middle, notes_base, notes_flat FROM perfumes").all();
const noteFreq = new Map();
for (const r of allNotesRows) {
  const combined = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
  if (!combined) continue;
  const parts = combined.split('|');
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    noteFreq.set(p, (noteFreq.get(p) || 0) + 1);
  }
}
console.log(`Total unique raw note strings in database: ${noteFreq.size}`);

// Find casing and suffix discrepancies
const lowerMap = new Map();
for (const [note, count] of noteFreq.entries()) {
  const l = note.toLowerCase();
  if (!lowerMap.has(l)) lowerMap.set(l, []);
  lowerMap.get(l).push({ note, count });
}
const casingVariants = Array.from(lowerMap.entries()).filter(([l, list]) => list.length > 1);
console.log(`Notes with casing/formatting variants: ${casingVariants.length}`);
console.log("Sample casing variants:", casingVariants.slice(0, 5));

// Find "accord" suffix variants (e.g. Ambergris vs Ambergris Accord)
const accordSuffixes = [];
for (const note of noteFreq.keys()) {
  if (note.toLowerCase().endsWith(' accord')) {
    const baseName = note.slice(0, -7).trim();
    if (noteFreq.has(baseName) || lowerMap.has(baseName.toLowerCase())) {
      accordSuffixes.push({ accordNote: note, baseNote: baseName });
    }
  }
}
console.log(`Notes existing BOTH as raw note AND as "... Accord": ${accordSuffixes.length}`);
console.log("Sample Accord duplicates:", accordSuffixes.slice(0, 5));

// Inconsistent brand names audit
console.log("\n2.4 BRAND NAMES AUDIT:");
const brands = db.prepare("SELECT DISTINCT brand FROM perfumes WHERE brand IS NOT NULL AND brand != ''").all().map(r => r.brand);
console.log(`Total distinct brand strings: ${brands.length}`);
const normalizedBrands = new Map();
for (const b of brands) {
  const norm = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedBrands.has(norm)) normalizedBrands.set(norm, []);
  normalizedBrands.get(norm).push(b);
}
const brandVariants = Array.from(normalizedBrands.entries()).filter(([norm, list]) => list.length > 1);
console.log(`Brand names with punctuation/spacing variants: ${brandVariants.length}`);
console.log("Sample brand variants:", brandVariants.slice(0, 8));

// 3. Description field search
console.log("\n3. DESCRIPTION FIELD AUDIT:");
const cloneKeywords = [
  "inspired by",
  "alternative to",
  "similar to",
  "smells like",
  "reminiscent of",
  "clone",
  "dupe",
  "if you like",
  "reminds of",
  "reminds me of",
  "type of",
  "impression of",
  "tribute to",
  "homage to",
  "rendition of"
];

for (const kw of cloneKeywords) {
  const countRow = db.prepare("SELECT COUNT(*) as c FROM perfumes WHERE description LIKE ?").get(`%${kw}%`);
  console.log(`  "${kw}": ${countRow.c} mentions`);
}

const combinedQuery = `
  SELECT id, slug, name, brand, description
  FROM perfumes
  WHERE description LIKE '%inspired by%'
     OR description LIKE '%alternative to%'
     OR description LIKE '%similar to%'
     OR description LIKE '%smells like%'
     OR description LIKE '%reminiscent of%'
     OR description LIKE '%clone%'
     OR description LIKE '%dupe%'
     OR description LIKE '%if you like%'
     OR description LIKE '%impression of%'
     OR description LIKE '%rendition of%'
`;
const matchingDesc = db.prepare(combinedQuery).all();
console.log(`\nTotal perfumes with at least one clone keyword in description: ${matchingDesc.length}`);

// 4. Example Fragrances Deep-dive
console.log("\n4. EXAMPLE FRAGRANCES DEEP DIVE:");
const targetQueries = [
  { label: "Afnan Supremacy Not Only Intense", brand: "Afnan", name: "Supremacy Not Only Intense" },
  { label: "Creed Aventus", brand: "Creed", name: "Aventus" },
  { label: "Nishane Hacivat", brand: "Nishane", name: "Hacivat" },
  { label: "Afnan Turathi Electric", brand: "Afnan", name: "Turathi Electric" },
  { label: "Ex Nihilo Blue Talisman", brand: "Ex Nihilo", name: "Blue Talisman" },
];

for (const t of targetQueries) {
  let rows = db.prepare("SELECT id, slug, name, brand, year, accords, notes_top, notes_middle, notes_base, notes_flat, vote_count, rating_avg, description FROM perfumes WHERE name LIKE ? AND brand LIKE ?").all(`%${t.name}%`, `%${t.brand}%`);
  if (rows.length === 0) {
    rows = db.prepare("SELECT id, slug, name, brand, year, accords, notes_top, notes_middle, notes_base, notes_flat, vote_count, rating_avg, description FROM perfumes WHERE name LIKE ?").all(`%${t.name}%`);
  }
  console.log(`\n--- ${t.label} ---`);
  if (rows.length === 0) {
    console.log(`  NOT FOUND IN DB! Let's search broadly for brand='${t.brand}' or name containing '${t.name.split(' ')[0]}'`);
    const broad = db.prepare("SELECT id, slug, name, brand FROM perfumes WHERE brand LIKE ? ORDER BY vote_count DESC LIMIT 10").all(`%${t.brand}%`);
    console.log(`  Available from brand '${t.brand}':`, broad.map(b => `${b.id}: ${b.name}`));
  } else {
    for (const r of rows) {
      console.log(`  ID: ${r.id} | Slug: ${r.slug} | Name: "${r.name}" | Brand: "${r.brand}" | Year: ${r.year} | Votes: ${r.vote_count}`);
      console.log(`  Accords: ${r.accords}`);
      console.log(`  Top Notes: ${r.notes_top}`);
      console.log(`  Middle Notes: ${r.notes_middle}`);
      console.log(`  Base Notes: ${r.notes_base}`);
      console.log(`  Flat Notes: ${r.notes_flat}`);
      console.log(`  Description snippet: ${(r.description || '').slice(0, 150)}...`);
    }
  }
}
