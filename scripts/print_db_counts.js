const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'perfumes.public.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

const perfumesCount = db.prepare('SELECT count(*) as count FROM perfumes').get().count;
const sources = db.prepare('SELECT source, count(*) as count FROM similar GROUP BY source').all();
const communityCountRow = db.prepare("SELECT count(*) as count FROM similar WHERE source = 'community'").get();
const communityCount = communityCountRow ? communityCountRow.count : 0;
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
const edgeTables = tables.filter(t => /edge|community/i.test(t));

console.log('=== DATABASE ROW COUNTS (data/perfumes.public.db) ===');
console.log(`perfumes count: ${perfumesCount}`);
console.log('similar rows by source:');
for (const s of sources) {
  console.log(`  - ${s.source}: ${s.count}`);
}
console.log(`community rows in public DB: ${communityCount}`);
console.log(`community/edge tables in public DB: ${edgeTables.length > 0 ? edgeTables.join(', ') : 'NONE (0)'}`);
db.close();
