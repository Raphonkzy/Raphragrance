const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat FROM perfumes').all();
const byId = new Map(rows.map(r => [r.id, r]));

// Check Layton notes and Detour Noir notes
const layton = byId.get(39314);
const detour = byId.get(70748);

console.log('--- LAYTON (39314) ---');
console.log('Accords:', layton.accords);
console.log('Notes:', [layton.notes_top, layton.notes_middle, layton.notes_base].join('|'));

console.log('\n--- DETOUR NOIR (70748) ---');
console.log('Accords:', detour.accords);
console.log('Notes:', [detour.notes_top, detour.notes_middle, detour.notes_base, detour.notes_flat].join('|'));
