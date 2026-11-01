const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare("SELECT id, name, brand, vote_count FROM perfumes WHERE brand LIKE '%Ariana%'").all();
console.log('Ariana Grande perfumes:');
rows.forEach(r => console.log(`  [${r.id}] ${r.name} (${r.brand}) - votes: ${r.vote_count}`));
