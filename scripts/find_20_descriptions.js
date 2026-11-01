const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

// Let's find 20 real examples of description text mentioning clone/alternative/inspired by
// Specifically look for clone houses or mentions of iconic fragrances

const query = `
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
  ORDER BY vote_count DESC
`;

const rows = db.prepare(query).all();

console.log(`Found ${rows.length} total rows with keywords.`);

// Filter for notable/representative ones across different brands (designer, niche, clone houses, and near targets)
const selected = [];
const brandsSeen = new Set();

// Priority 1: mentions of Aventus, Hacivat, Blue Talisman, or target brands
for (const r of rows) {
  const d = r.description;
  if (/aventus|hacivat|blue talisman|baccarat|sauvage|delina|santal 33|lost cherry|angels/i.test(d)) {
    selected.push(r);
    brandsSeen.add(r.brand);
    if (selected.length >= 10) break;
  }
}

// Priority 2: other clone houses or distinct brands
for (const r of rows) {
  if (selected.find(s => s.id === r.id)) continue;
  if (!brandsSeen.has(r.brand) || brandsSeen.size < 15) {
    selected.push(r);
    brandsSeen.add(r.brand);
    if (selected.length >= 25) break;
  }
}

console.log(`Selected ${selected.length} examples.`);

for (let i = 0; i < Math.min(selected.length, 22); i++) {
  const s = selected[i];
  console.log(`\nExample ${i+1}:`);
  console.log(`Fragrance: [${s.id}] "${s.name}" by "${s.brand}" (slug: ${s.slug})`);
  // extract snippet around keyword
  const match = s.description.match(/(.{0,80}(?:inspired by|alternative to|similar to|smells like|reminiscent of|clone|dupe|if you like|impression of|rendition of).{0,120})/i);
  if (match) {
    console.log(`Excerpt: "...${match[0].replace(/\s+/g, ' ').trim()}..."`);
  } else {
    console.log(`Snippet: "${s.description.slice(0, 150)}..."`);
  }
}
