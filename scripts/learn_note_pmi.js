const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.db');
const splitData = JSON.parse(fs.readFileSync('data/eval_split.json', 'utf8'));

const backgroundSet = new Set(splitData.background);
console.log(`Background set size: ${backgroundSet.size}`);

// Load perfumes from SQLite
const rows = db.prepare(`
  SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
  FROM perfumes
`).all();
const perfumeMap = new Map(rows.map(r => [r.id, r]));

function normalizeNote(raw) {
  let s = raw.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
  return s;
}

function getPerfumeNotes(r) {
  const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
  return new Set(all.split('|').map(normalizeNote).filter(Boolean));
}

async function learnBackgroundNoteAssociations() {
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

  console.log(`Total qualifying community pairs strictly within Background set: ${bgPairs.length}`);

  // Count individual note frequencies in background pairs
  const noteFreq = new Map();
  const pairCooccur = new Map(); // 'n1|n2' (ordered) -> count

  for (const pair of bgPairs) {
    const p1 = perfumeMap.get(pair.u);
    const p2 = perfumeMap.get(pair.v);
    if (!p1 || !p2) continue;

    const n1 = getPerfumeNotes(p1);
    const n2 = getPerfumeNotes(p2);

    for (const note of n1) {
      noteFreq.set(note, (noteFreq.get(note) || 0) + 1);
    }
    for (const note of n2) {
      noteFreq.set(note, (noteFreq.get(note) || 0) + 1);
    }

    // Cross-perfume co-occurrences
    for (const a of n1) {
      for (const b of n2) {
        if (a === b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        pairCooccur.set(key, (pairCooccur.get(key) || 0) + 1);
      }
    }
  }

  const N_pairs = bgPairs.length;
  console.log(`Unique notes in Background pairs: ${noteFreq.size}`);
  console.log(`Cross-pair note co-occurrences: ${pairCooccur.size}`);

  // Calculate NPMI or Jaccard
  // NPMI(x, y) = -ln(P(x, y) / (P(x)*P(y))) / ln(P(x,y))
  const associations = [];
  for (const [key, count] of pairCooccur) {
    if (count < 3) continue; // minimum co-occurrence threshold
    const [a, b] = key.split('|');
    const fA = noteFreq.get(a) || 1;
    const fB = noteFreq.get(b) || 1;

    // Jaccard similarity across pair occurrences
    const jaccard = count / (fA + fB - count);
    const pA = fA / (2 * N_pairs);
    const pB = fB / (2 * N_pairs);
    const pAB = count / N_pairs;
    const pmi = Math.log(pAB / (pA * pB));
    const npmi = -pmi / Math.log(pAB);

    associations.push({ a, b, count, fA, fB, jaccard, pmi, npmi });
  }

  associations.sort((a, b) => b.jaccard - a.jaccard);

  console.log('\nTop 25 Learned Note Associations by Jaccard:');
  associations.slice(0, 25).forEach((item, i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. ${item.a.padEnd(20)} <--> ${item.b.padEnd(20)} | Jaccard: ${item.jaccard.toFixed(3)} | NPMI: ${item.npmi.toFixed(3)} | Count: ${item.count} (fA:${item.fA}, fB:${item.fB})`);
  });

  // Check specific molecules: georgywood, ambrofix, akigalawood, cedar, ambergris, etc.
  console.log('\nLearned Associations for Specific Target Notes:');
  const targetNotes = ['georgywood', 'ambrofix', 'akigalawood', 'ambroxan', 'oak moss', 'oakmoss', 'birch'];
  for (const t of targetNotes) {
    const matches = associations.filter(x => x.a === t || x.b === t).slice(0, 5);
    console.log(`Target '${t}':`);
    if (matches.length === 0) console.log('  (No associations with count >= 3)');
    matches.forEach(m => {
      const partner = m.a === t ? m.b : m.a;
      console.log(`  <--> ${partner.padEnd(20)} | Jaccard: ${m.jaccard.toFixed(3)} | Count: ${m.count}`);
    });
  }
}

learnBackgroundNoteAssociations().catch(console.error);
