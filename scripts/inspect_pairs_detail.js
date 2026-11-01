const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('data/perfumes.db');

const ids = [68271, 9828, 44174, 108244, 84224];
const rows = db.prepare(`SELECT * FROM perfumes WHERE id IN (${ids.join(',')})`).all();
const byId = new Map(rows.map(r => [r.id, r]));

console.log('=== SIDE-BY-SIDE DATA COMPARISON ===\n');

function inspectPair(id1, id2, label) {
  const p1 = byId.get(id1);
  const p2 = byId.get(id2);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`PAIR: ${label}`);
  console.log(`[P1] ${p1.name} (${p1.brand}) [ID: ${p1.id}]`);
  console.log(`  Accords: ${p1.accords}`);
  console.log(`  Top Notes:    ${p1.notes_top}`);
  console.log(`  Middle Notes: ${p1.notes_middle}`);
  console.log(`  Base Notes:   ${p1.notes_base}`);
  console.log(`  Flat Notes:   ${p1.notes_flat}`);
  console.log(`\n[P2] ${p2.name} (${p2.brand}) [ID: ${p2.id}]`);
  console.log(`  Accords: ${p2.accords}`);
  console.log(`  Top Notes:    ${p2.notes_top}`);
  console.log(`  Middle Notes: ${p2.notes_middle}`);
  console.log(`  Base Notes:   ${p2.notes_base}`);
  console.log(`  Flat Notes:   ${p2.notes_flat}`);

  // Notes comparison
  const parseNotes = r => [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|').split('|').map(s=>s.trim().toLowerCase());
  const n1 = new Set(parseNotes(p1));
  const n2 = new Set(parseNotes(p2));
  const sharedNotes = [...n1].filter(n => n2.has(n));
  console.log(`\nShared Notes (${sharedNotes.length}):`, sharedNotes);
  console.log(`Notes in P1 only:`, [...n1].filter(n => !n2.has(n)));
  console.log(`Notes in P2 only:`, [...n2].filter(n => !n1.has(n)));

  // Accords comparison
  const parseAcc = r => (r.accords||'').split('|').filter(Boolean).map(p=>p.split(':')[0].trim().toLowerCase());
  const a1 = new Set(parseAcc(p1));
  const a2 = new Set(parseAcc(p2));
  const sharedAcc = [...a1].filter(a => a2.has(a));
  console.log(`\nShared Accords (${sharedAcc.length}):`, sharedAcc);
  console.log(`Accords in P1 only:`, [...a1].filter(a => !a2.has(a)));
  console.log(`Accords in P2 only:`, [...a2].filter(a => !a1.has(a)));
}

inspectPair(68271, 9828, 'SNOI vs Creed Aventus');
inspectPair(68271, 44174, 'SNOI vs Nishane Hacivat');
inspectPair(108244, 84224, 'Turathi Electric vs Blue Talisman');
