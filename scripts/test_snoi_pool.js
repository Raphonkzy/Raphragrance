const fs = require('fs');

// Test what happens when:
// 1. Candidate pool includes top accord overlap or all candidates with >= 3 shared notes or >= 3 shared accords
// 2. Candidate roughScore is normalized or we evaluate all perfumes sharing >= 3 notes or top accords

const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare(`SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat FROM perfumes`).all();

// Let's check SNOI (68271) vs Aventus (9828) and Hacivat (44174)
const snoi = rows.find(r => r.id === 68271);
const aventus = rows.find(r => r.id === 9828);
const hacivat = rows.find(r => r.id === 44174);

console.log('SNOI notes:', [snoi.notes_top, snoi.notes_middle, snoi.notes_base].join('|'));
console.log('Aventus notes:', [aventus.notes_top, aventus.notes_middle, aventus.notes_base].join('|'));
console.log('Hacivat notes:', [hacivat.notes_top, hacivat.notes_middle, hacivat.notes_base].join('|'));
