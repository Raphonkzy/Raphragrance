const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();

function normalize(s) {
  return (s || '').toLowerCase().trim().replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
}

function getNotes(r) {
  const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
  return new Set(all.split('|').map(normalize).filter(Boolean));
}

const snoi = rows.find(r => r.id === 68271);
const snoiNotes = getNotes(snoi);
console.log('SNOI normalized notes (' + snoiNotes.size + '):', Array.from(snoiNotes).join(', '));

// How many fragrances have ALL of SNOI's notes?
// How many fragrances have 8 of 9? 7 of 9?
const exactMatches = [];
const subsetMatches = [];
const highOverlap = [];

for (const r of rows) {
  if (r.id === 68271) continue;
  const candNotes = getNotes(r);
  let matchCount = 0;
  for (const n of snoiNotes) {
    if (candNotes.has(n)) matchCount++;
  }
  if (matchCount === snoiNotes.size && candNotes.size === snoiNotes.size) {
    exactMatches.push(r);
  }
  if (matchCount === snoiNotes.size) {
    subsetMatches.push({ r, total: candNotes.size });
  }
  if (matchCount >= 7) {
    highOverlap.push({ r, matchCount, total: candNotes.size });
  }
}

console.log(`Fragrances with EXACT identical note set to SNOI (9/9 notes and size 9): ${exactMatches.length}`);
console.log(`Fragrances containing ALL 9 of SNOI notes (candNotes superset of SNOI): ${subsetMatches.length}`);
console.log(`Fragrances sharing >= 7 of SNOI's 9 notes: ${highOverlap.length}`);
console.log(`Fragrances sharing >= 6 of SNOI's 9 notes: ${rows.filter(r => {
  if (r.id === 68271) return false;
  const cn = getNotes(r);
  let c = 0;
  for (const n of snoiNotes) if (cn.has(n)) c++;
  return c >= 6;
}).length}`);
