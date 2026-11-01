const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteRaw,
  normalizeNoteDict
} = require('./ablation_common');

const npmiData = JSON.parse(fs.readFileSync('data/learned_note_npmi.json', 'utf8'));

// Build note similarity lookup
const noteSimMap = new Map();
for (const p of npmiData) {
  if (p.score >= 0.35) { // meaningful association threshold
    const key = p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
    noteSimMap.set(key, p.score);
  }
}
console.log(`Loaded ${noteSimMap.size} note similarity associations with score >= 0.35`);

// Let's test on 1,000 Validation queries!
