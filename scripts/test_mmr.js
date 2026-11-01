const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteDict
} = require('./ablation_common');

const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
const numP = rows.length;
const idToInternal = new Map(rows.map((r, i) => [r.id, i]));

const perfumeNoteSets = rows.map(r => {
  const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
  return new Set(all.split('|').map(normalizeNoteDict).filter(Boolean));
});

function noteJaccard(i1, i2) {
  const s1 = perfumeNoteSets[i1];
  const s2 = perfumeNoteSets[i2];
  if (s1.size === 0 || s2.size === 0) return 0;
  let inter = 0;
  for (const n of s1) if (s2.has(n)) inter++;
  return inter / (s1.size + s2.size - inter);
}

// Let's import runEngine logic from run_all_ablations
const ablationScript = fs.readFileSync('scripts/run_all_ablations.js', 'utf8');

// We can run candidate scoring and then apply MMR:
// MMR re-ranking on the top 100 candidates:
function applyMMR(candidateList, topK = 10, lambda = 0.5, simThreshold = 0.70) {
  const selected = [];
  const selectedIndices = [];
  const remaining = [...candidateList];

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const cIntIdx = idToInternal.get(cand.id);

      // Max similarity to already selected candidates
      let maxSim = 0;
      for (const sIntIdx of selectedIndices) {
        const sim = noteJaccard(cIntIdx, sIntIdx);
        if (sim > maxSim) maxSim = sim;
      }

      // If maxSim >= simThreshold, apply penalty
      let penalty = maxSim >= simThreshold ? (maxSim - simThreshold + 0.1) * lambda : 0;
      const mmrScore = cand.score - penalty;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const chosen = remaining.splice(bestIdx, 1)[0];
      selected.push(chosen);
      selectedIndices.push(idToInternal.get(chosen.id));
    } else {
      break;
    }
  }

  return selected;
}
