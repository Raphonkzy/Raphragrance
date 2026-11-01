const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { db, splitData, loadGroundTruth, normalizeNoteDict } = require('./ablation_common');

async function evaluateNoAccordsBackground() {
  const { adjFull } = await loadGroundTruth();

  const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat FROM perfumes').all();
  const byId = new Map(rows.map(r => [r.id, r]));

  // Find all fragrances in Background set that have NO accords
  const bgNoAccords = [];
  for (const id of splitData.background) {
    const p = byId.get(id);
    if (!p) continue;
    if (!p.accords || !p.accords.trim()) {
      bgNoAccords.push(p);
    }
  }

  console.log(`Qualifying fragrances in Background set with NO accords: ${bgNoAccords.length}`);

  // What about in the entire database of perfumes that have ANY ground truth edge in perfumes.jsonl?
  const allNoAccordsWithGT = [];
  for (const [id, gt] of adjFull) {
    const p = byId.get(id);
    if (p && (!p.accords || !p.accords.trim()) && gt.size > 0) {
      allNoAccordsWithGT.push(p);
    }
  }

  console.log(`Total fragrances across entire catalog with NO accords and >= 3 GT edges (net >= 5): ${allNoAccordsWithGT.length}`);

  allNoAccordsWithGT.forEach((p, i) => {
    const gt = adjFull.get(p.id);
    console.log(`  ${i+1}. ${p.name} (${p.brand}) [ID: ${p.id}, votes: ${p.vote_count}] -> GT edges: ${gt.size}`);
  });
}

evaluateNoAccordsBackground().catch(console.error);
