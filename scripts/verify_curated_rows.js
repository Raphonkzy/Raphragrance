const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.public.db');

const rows = db.prepare(`
  SELECT s.fragrance_id, p1.name AS query_perfume, p1.brand AS query_brand,
         s.similar_id, p2.name AS target_perfume, p2.brand AS target_brand,
         s.rank, s.score, s.source
  FROM similar s
  JOIN perfumes p1 ON p1.id = s.fragrance_id
  JOIN perfumes p2 ON p2.id = s.similar_id
  WHERE s.source = 'curated'
  ORDER BY s.fragrance_id, s.rank
`).all();

console.log(`=== CONFIRMING ALL 6 CURATED OVERRIDE ROWS IN PUBLIC DB ===`);
console.table(rows);
