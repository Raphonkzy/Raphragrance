const fs = require('fs');

// Test how many notes have df > 15,000
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare('SELECT notes_top, notes_middle, notes_base, notes_flat FROM perfumes').all();
const df = new Map();

for (const r of rows) {
  const notes = new Set([r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|').toLowerCase().split('|').map(s=>s.trim()).filter(Boolean));
  for (const n of notes) {
    df.set(n, (df.get(n) || 0) + 1);
  }
}

const sorted = Array.from(df.entries()).sort((a, b) => b[1] - a[1]);
console.log('Top 15 most frequent notes:');
sorted.slice(0, 15).forEach(([n, count]) => {
  console.log(`  ${n.padEnd(25)}: ${count} perfumes (${((count/rows.length)*100).toFixed(1)}%)`);
});
