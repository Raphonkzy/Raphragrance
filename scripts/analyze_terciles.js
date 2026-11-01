const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const { db, splitData, loadGroundTruth } = require('./ablation_common');

async function analyzeTerciles() {
  const { adjFull, adjTop10 } = await loadGroundTruth();

  const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat FROM perfumes').all();
  const byId = new Map(rows.map(r => [r.id, r]));

  const valP = splitData.validation.map(id => byId.get(id)).filter(Boolean);
  const sortedVotes = [...valP].map(p => p.vote_count).sort((a, b) => a - b);
  const t1 = sortedVotes[Math.floor(sortedVotes.length / 3)];
  const t2 = sortedVotes[Math.floor(sortedVotes.length * 2 / 3)];

  const tLow = valP.filter(p => p.vote_count <= t1);
  const tMid = valP.filter(p => p.vote_count > t1 && p.vote_count <= t2);
  const tHigh = valP.filter(p => p.vote_count > t2);

  function getStats(name, list) {
    let totalGtEdges = 0;
    let totalSymNet = 0;
    let flankerCount = 0;
    let flatCount = 0;

    for (const p of list) {
      const gt = adjFull.get(p.id) || new Map();
      totalGtEdges += gt.size;
      for (const net of gt.values()) totalSymNet += net;

      // check if flanker (contains 'eau', 'intense', 'edp', 'parfum', 'elixir', 'cologne')
      if (/\b(intense|eau|edp|edt|parfum|elixir|cologne|extreme|absolu)\b/i.test(p.name)) flankerCount++;
      if (!p.notes_top && !p.notes_middle && !p.notes_base && p.notes_flat) flatCount++;
    }

    return {
      name,
      count: list.length,
      avgGtEdges: (totalGtEdges / list.length).toFixed(1),
      avgSymNetPerEdge: (totalSymNet / (totalGtEdges || 1)).toFixed(1),
      avgTotalSymNet: (totalSymNet / list.length).toFixed(1),
      flankerPct: ((flankerCount / list.length) * 100).toFixed(1),
      flatPct: ((flatCount / list.length) * 100).toFixed(1)
    };
  }

  console.log('--- TERCILE STRUCTURAL COMPARISON ---');
  console.log(getStats(`Low Votes (<= ${t1})`, tLow));
  console.log(getStats(`Mid Votes (${t1+1} - ${t2})`, tMid));
  console.log(getStats(`High Votes (> ${t2})`, tHigh));
}

analyzeTerciles().catch(console.error);
