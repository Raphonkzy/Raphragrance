const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const checks = [
  { targetBrand: 'Creed', targetName: 'Aventus', queryBrand: 'Creed' },
  { targetBrand: 'Maison Francis Kurkdjian', targetName: 'Baccarat Rouge', queryBrand: 'Maison Francis Kurkdjian' },
  { targetBrand: 'Dior', targetName: 'Sauvage', queryBrand: 'Dior' },
  { targetBrand: 'Tom Ford', targetName: 'Tobacco Vanille', queryBrand: 'Tom Ford' },
  { targetBrand: 'Tom Ford', targetName: 'Lost Cherry', queryBrand: 'Tom Ford' },
  { targetBrand: 'Tom Ford', targetName: 'Tuscan Leather', queryBrand: 'Tom Ford' },
  { targetBrand: 'Parfums de Marly', targetName: 'Layton', queryBrand: 'Parfums de Marly' },
  { targetBrand: 'Parfums de Marly', targetName: 'Delina', queryBrand: 'Parfums de Marly' },
  { targetBrand: 'By Kilian', targetName: "Angels' Share", queryBrand: 'Kilian' },
  { targetBrand: 'Nishane', targetName: 'Hacivat', queryBrand: 'Nishane' },
  { targetBrand: 'Ex Nihilo', targetName: 'Blue Talisman', queryBrand: 'Ex Nihilo' },
  { targetBrand: 'Le Labo', targetName: 'Santal 33', queryBrand: 'Le Labo' },
];

console.log("=== CROSS-BRAND PERFUME MENTIONS IN DESCRIPTION ===");
let totalFound = 0;
const results = [];

for (const c of checks) {
  const rows = db.prepare(`
    SELECT id, slug, name, brand, description
    FROM perfumes
    WHERE description LIKE ?
      AND brand NOT LIKE ?
  `).all(`%${c.targetName}%`, `%${c.queryBrand}%`);

  console.log(`\nMentions of "${c.targetName}" outside of ${c.queryBrand}: ${rows.length} rows`);
  for (const r of rows) {
    totalFound++;
    results.push({ ...r, target: c.targetName });
    console.log(`  [${r.id}] "${r.name}" by "${r.brand}" (slug: ${r.slug})`);
    const idx = r.description.indexOf(c.targetName);
    const start = Math.max(0, idx - 60);
    const end = Math.min(r.description.length, idx + c.targetName.length + 80);
    console.log(`    Excerpt: "...${r.description.slice(start, end).replace(/\s+/g, ' ')}..."`);
  }
}

console.log(`\nTotal cross-brand mentions across these iconic targets: ${totalFound}`);
