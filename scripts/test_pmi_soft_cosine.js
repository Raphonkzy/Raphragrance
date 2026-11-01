const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteRaw
} = require('./ablation_common');

const backgroundSet = new Set(splitData.background);
const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat FROM perfumes').all();
const perfumeMap = new Map(rows.map(r => [r.id, r]));

function getPerfumeNotes(r) {
  const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
  return new Set(all.split('|').map(normalizeNoteRaw).filter(Boolean));
}

async function learnNormalizedPMI() {
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  const bgPairs = [];
  const pairSeen = new Set();

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      if (!backgroundSet.has(o.id)) continue;
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      for (const r of rList) {
        if (!backgroundSet.has(r.id)) continue;
        const net = (r.up_votes || 0) - (r.down_votes || 0);
        const tot = (r.up_votes || 0) + (r.down_votes || 0);
        if (net >= 5 && (r.up_votes || 0) / (tot || 1) >= 0.6) {
          const minId = Math.min(o.id, r.id);
          const maxId = Math.max(o.id, r.id);
          const key = `${minId}:${maxId}`;
          if (!pairSeen.has(key)) {
            pairSeen.add(key);
            bgPairs.push({ u: minId, v: maxId, net });
          }
        }
      }
    } catch (e) {}
  }

  const N_pairs = bgPairs.length;
  console.log(`Background pairs: ${N_pairs}`);

  const noteFreq = new Map();
  const pairCooccur = new Map();

  for (const pair of bgPairs) {
    const p1 = perfumeMap.get(pair.u);
    const p2 = perfumeMap.get(pair.v);
    if (!p1 || !p2) continue;

    const n1 = getPerfumeNotes(p1);
    const n2 = getPerfumeNotes(p2);

    for (const note of n1) noteFreq.set(note, (noteFreq.get(note) || 0) + 1);
    for (const note of n2) noteFreq.set(note, (noteFreq.get(note) || 0) + 1);

    for (const a of n1) {
      for (const b of n2) {
        if (a === b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        pairCooccur.set(key, (pairCooccur.get(key) || 0) + 1);
      }
    }
  }

  // Calculate NPMI with frequency correction & min count >= 5
  // NPMI = ln(P(a,b) / (P(a)P(b))) / -ln(P(a,b))
  // Range is [-1, 1].
  // Frequency correction: multiply by min(1.0, count / 20) to penalize low-support flukes
  const npmiPairs = [];
  for (const [key, count] of pairCooccur) {
    if (count < 5) continue;
    const [a, b] = key.split('|');
    const fA = noteFreq.get(a) || 1;
    const fB = noteFreq.get(b) || 1;

    const pA = fA / (2 * N_pairs);
    const pB = fB / (2 * N_pairs);
    const pAB = count / N_pairs;

    const pmi = Math.log(pAB / (pA * pB));
    const npmi = -pmi / Math.log(pAB);

    // Support discount to avoid spurious high NPMI on rare notes:
    const supportDiscount = Math.min(1.0, Math.log2(count) / Math.log2(20));
    const score = npmi * supportDiscount;

    if (score > 0.15) {
      npmiPairs.push({ a, b, count, fA, fB, npmi, score });
    }
  }

  npmiPairs.sort((a, b) => b.score - a.score);
  console.log(`Learned ${npmiPairs.length} note association pairs with score > 0.15`);
  console.log('\nTop 20 Learned Associations with Support Discount:');
  npmiPairs.slice(0, 20).forEach((p, i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. ${p.a.padEnd(22)} <-> ${p.b.padEnd(22)} | Count: ${p.count.toString().padStart(3)} | NPMI: ${p.npmi.toFixed(3)} | DiscScore: ${p.score.toFixed(3)}`);
  });

  // Save to file for fast use in eval
  fs.writeFileSync('data/learned_note_npmi.json', JSON.stringify(npmiPairs.slice(0, 500)));
}

learnNormalizedPMI().catch(console.error);
