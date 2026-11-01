const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const names = ['Lost Cherry', 'Cloud', 'Black Phantom', "Angels' Share"];
for (const n of names) {
  const rows = db.prepare('SELECT id, name, brand, vote_count FROM perfumes WHERE name LIKE ?').all(`%${n}%`);
  console.log(`\nMatches for "${n}":`);
  rows.slice(0, 5).forEach(r => console.log(`  [${r.id}] ${r.name} (${r.brand}) - votes: ${r.vote_count}`));
}
