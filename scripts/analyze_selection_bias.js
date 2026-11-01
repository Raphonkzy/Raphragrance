const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('data/perfumes.db');
const splitData = JSON.parse(fs.readFileSync('data/eval_split.json', 'utf8'));

// Qualifying benchmark set = validation (1000) + test (1000) + background (6418) = 8418
const benchmarkIds = new Set([...splitData.validation, ...splitData.test, ...splitData.background]);

// Load all perfumes from SQLite
console.log('Loading all perfumes from SQLite...');
const allRows = db.prepare(`
  SELECT id, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat
  FROM perfumes
`).all();

console.log(`Total perfumes in DB: ${allRows.length}`);

// We need to identify the no-edge fragrances.
// In earlier audit: 91,603 fragrances had at least 1 directed edge in perfumes.jsonl,
// so 131,930 - 91,603 = 40,327 fragrances had 0 community edges.
// Let's verify exactly which IDs have 0 edges in perfumes.jsonl.
const readline = require('readline');

async function analyzeBias() {
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  const idsWithAnyEdge = new Set();
  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      if (rList.length > 0) {
        idsWithAnyEdge.add(o.id);
        for (const r of rList) idsWithAnyEdge.add(r.id);
      }
    } catch (e) {}
  }

  console.log(`Perfumes connected to ANY edge (inbound or outbound): ${idsWithAnyEdge.size}`);

  function getStats(name, rows) {
    const total = rows.length;
    let flatOnlyCount = 0;
    let noAccordsCount = 0;
    let noNotesCount = 0;
    const votes = [];

    for (const r of rows) {
      const hasPyramid = Boolean(r.notes_top || r.notes_middle || r.notes_base);
      const hasFlat = Boolean(r.notes_flat);
      const hasAccords = Boolean(r.accords && r.accords.trim());

      if (!hasPyramid && hasFlat) flatOnlyCount++;
      if (!hasPyramid && !hasFlat) noNotesCount++;
      if (!hasAccords) noAccordsCount++;

      votes.push(r.vote_count || 0);
    }

    votes.sort((a, b) => a - b);
    const medianVote = votes.length > 0 ? (votes.length % 2 === 0 ? (votes[votes.length/2 - 1] + votes[votes.length/2]) / 2 : votes[Math.floor(votes.length/2)]) : 0;
    const meanVote = votes.reduce((a, b) => a + b, 0) / (total || 1);

    return {
      name,
      total,
      flatOnlyCount,
      flatOnlyPct: (flatOnlyCount / total) * 100,
      noAccordsCount,
      noAccordsPct: (noAccordsCount / total) * 100,
      noNotesCount,
      noNotesPct: (noNotesCount / total) * 100,
      medianVote,
      meanVote: Math.round(meanVote)
    };
  }

  const benchmarkRows = allRows.filter(r => benchmarkIds.has(r.id));
  const noEdgeRows = allRows.filter(r => !idsWithAnyEdge.has(r.id));
  const allSetStats = getStats('All Fragrances (Entire Catalog)', allRows);
  const benchStats = getStats('Benchmark Set (8,418 anchor fragrances)', benchmarkRows);
  const noEdgeStats = getStats('No-Edge Fragrances (0 community edges)', noEdgeRows);

  console.log('\n================================================================================');
  console.log('DATA QUALITY COMPARISON: BENCHMARK SET VS NO-EDGE FRAGRANCES');
  console.log('================================================================================');
  console.log(`Metric                        | Entire Catalog (131k) | Benchmark Set (8.4k) | No-Edge Set (${noEdgeRows.length})`);
  console.log(`------------------------------|-----------------------|----------------------|-----------------------`);
  console.log(`Total Count                   | ${allSetStats.total.toString().padEnd(21)} | ${benchStats.total.toString().padEnd(20)} | ${noEdgeStats.total.toString().padEnd(21)}`);
  console.log(`Share Flat-Only Notes (%)     | ${allSetStats.flatOnlyPct.toFixed(2)}%                 | ${benchStats.flatOnlyPct.toFixed(2)}%                | ${noEdgeStats.flatOnlyPct.toFixed(2)}%`);
  console.log(`Share Without Accords (%)     | ${allSetStats.noAccordsPct.toFixed(2)}%                  | ${benchStats.noAccordsPct.toFixed(2)}%                 | ${noEdgeStats.noAccordsPct.toFixed(2)}%`);
  console.log(`Share Without Any Notes (%)   | ${allSetStats.noNotesPct.toFixed(2)}%                  | ${benchStats.noNotesPct.toFixed(2)}%                 | ${noEdgeStats.noNotesPct.toFixed(2)}%`);
  console.log(`Median Vote Count             | ${allSetStats.medianVote.toString().padEnd(21)} | ${benchStats.medianVote.toString().padEnd(20)} | ${noEdgeStats.medianVote.toString().padEnd(21)}`);
  console.log(`Mean Vote Count               | ${allSetStats.meanVote.toString().padEnd(21)} | ${benchStats.meanVote.toString().padEnd(20)} | ${noEdgeStats.meanVote.toString().padEnd(21)}`);
  console.log('================================================================================\n');
}

analyzeBias().catch(console.error);
