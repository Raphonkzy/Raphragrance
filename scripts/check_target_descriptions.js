const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const ids = [68271, 9828, 44174, 108244, 84224];
for (const id of ids) {
  const r = db.prepare("SELECT id, name, brand, description FROM perfumes WHERE id = ?").get(id);
  console.log(`\n[${r.id}] ${r.name} (${r.brand})`);
  console.log(`Description: "${r.description}"`);
}
