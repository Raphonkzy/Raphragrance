const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare(`
  SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
  FROM perfumes
  WHERE id IN (68271, 9828, 44174, 108244, 84224)
`).all();

console.log('=== EXACT PERFUME DETAILS IN SQLITE DB ===\n');
for (const r of rows) {
  console.log(`ID: ${r.id} | Name: ${r.name} | Brand: ${r.brand} | Gender: ${r.gender} | Votes: ${r.vote_count}`);
  console.log(`  Top Notes:    ${r.notes_top || '(none)'}`);
  console.log(`  Middle Notes: ${r.notes_middle || '(none)'}`);
  console.log(`  Base Notes:   ${r.notes_base || '(none)'}`);
  console.log(`  Flat Notes:   ${r.notes_flat || '(none)'}`);
  console.log(`  Accords:      ${r.accords || '(none)'}`);
  console.log('--------------------------------------------------------------------------------');
}
