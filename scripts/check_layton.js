const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteDict,
  cloneHouses
} = require('./ablation_common');

const code = fs.readFileSync('scripts/run_all_ablations.js', 'utf8');

// Export runEngine from run_all_ablations
const checkCode = `
const { db, splitData, loadGroundTruth, normalizeNoteDict, cloneHouses } = require('./ablation_common');
const fs = require('fs');

async function testLayton() {
  const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
  // We can require run_all_ablations functions if we export or copy
}
`;
