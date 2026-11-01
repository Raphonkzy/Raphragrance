const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { db, splitData, loadGroundTruth, normalizeNoteDict } = require('./ablation_common');

async function analyze20Failures() {
  const { adjFull } = await loadGroundTruth();
  const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
  const byId = new Map(rows.map(r => [r.id, r]));

  // Read precomputed content recommendations from similar table
  const stmtSim = db.prepare(`SELECT similar_id, rank, score FROM similar WHERE fragrance_id = ? AND source = 'content' ORDER BY rank ASC LIMIT 10`);

  const valP = splitData.validation.map(id => byId.get(id)).filter(Boolean);
  const sortedVotes = [...valP].map(p => p.vote_count).sort((a, b) => a - b);
  const t1 = sortedVotes[Math.floor(sortedVotes.length / 3)];
  const t2 = sortedVotes[Math.floor(sortedVotes.length * 2 / 3)];

  const midQueries = valP.filter(p => p.vote_count > t1 && p.vote_count <= t2);
  const failures = [];

  for (const q of midQueries) {
    const qgt = adjFull.get(q.id);
    if (!qgt || qgt.size === 0) continue;
    const simRows = stmtSim.all(q.id);
    const recIds = simRows.map(r => r.similar_id);
    const hit = recIds.some(id => qgt.has(id));
    if (!hit) {
      failures.push({
        q,
        qgt,
        recs: recIds.map(id => byId.get(id)).filter(Boolean)
      });
      if (failures.length >= 20) break;
    }
  }

  console.log(`Found ${failures.length} mid-tercile failures.`);
  const detailed = failures.map((f, i) => {
    return {
      index: i + 1,
      query: {
        id: f.q.id,
        name: f.q.name,
        brand: f.q.brand,
        gender: f.q.gender,
        votes: f.q.vote_count,
        accords: f.q.accords,
        notes: [f.q.notes_top, f.q.notes_middle, f.q.notes_base, f.q.notes_flat].filter(Boolean).join(' | ')
      },
      groundTruth: Array.from(f.qgt.entries()).map(([gid, net]) => {
        const gp = byId.get(gid);
        return {
          id: gid,
          name: gp?.name,
          brand: gp?.brand,
          accords: gp?.accords,
          notes: gp ? [gp.notes_top, gp.notes_middle, gp.notes_base, gp.notes_flat].filter(Boolean).join(' | ') : '',
          sym_net: net
        };
      }),
      topEngineRecs: f.recs.slice(0, 3).map(r => {
        return {
          id: r.id,
          name: r.name,
          brand: r.brand,
          accords: r.accords,
          notes: [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join(' | ')
        };
      })
    };
  });

  fs.writeFileSync('scripts/mid_tercile_20_failures.json', JSON.stringify(detailed, null, 2));
  console.log('Saved to scripts/mid_tercile_20_failures.json');
}

analyze20Failures().catch(console.error);
