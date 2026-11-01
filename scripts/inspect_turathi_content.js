const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare(`
  SELECT s.rank, s.score, s.source, p.id, p.name, p.brand
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = 108244 AND s.source = 'content'
  ORDER BY s.rank ASC
  LIMIT 20
`).all();

console.log('Turathi Electric (108244) Content Recommendations in DB:');
rows.forEach(r => {
  console.log(`  #${r.rank.toString().padStart(2)}: [${r.id}] ${r.name} (${r.brand}) | Score: ${r.score.toFixed(4)}`);
});
