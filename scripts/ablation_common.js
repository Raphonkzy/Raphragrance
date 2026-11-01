const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.db');
const splitData = JSON.parse(fs.readFileSync('data/eval_split.json', 'utf8'));

// 1. Ground truth loader: full ground truth and top-10-restricted ground truth
async function loadGroundTruth() {
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  const directed = new Map();
  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      for (const r of rList) {
        directed.set(`${o.id}->${r.id}`, { up: r.up_votes || 0, down: r.down_votes || 0 });
      }
    } catch (e) {}
  }

  const adjFull = new Map(); // id -> Map(neighborId -> symNet)
  const THRESHOLD_NET = splitData.metadata.threshold_net;
  const THRESHOLD_RATIO = splitData.metadata.threshold_ratio;

  const pairVisited = new Set();
  for (const [key, val] of directed) {
    const [uStr, vStr] = key.split('->');
    const u = Number(uStr);
    const v = Number(vStr);
    const pKey = `${Math.min(u, v)}:${Math.max(u, v)}`;
    if (pairVisited.has(pKey)) continue;
    pairVisited.add(pKey);

    const fwd = directed.get(`${u}->${v}`);
    const rev = directed.get(`${v}->${u}`);

    const maxUp = Math.max(fwd ? fwd.up : 0, rev ? rev.up : 0);
    const maxDown = Math.max(fwd ? fwd.down : 0, rev ? rev.down : 0);
    const symNet = maxUp - maxDown;
    const total = maxUp + maxDown;
    const ratio = total > 0 ? maxUp / total : 0;

    if (symNet >= THRESHOLD_NET && ratio >= THRESHOLD_RATIO) {
      if (!adjFull.has(u)) adjFull.set(u, new Map());
      adjFull.get(u).set(v, symNet);

      if (!adjFull.has(v)) adjFull.set(v, new Map());
      adjFull.get(v).set(u, symNet);
    }
  }

  // Create top-10-restricted ground truth: for each query, keep only the top 10 neighbors by symNet
  const adjTop10 = new Map();
  for (const [id, nMap] of adjFull) {
    const sorted = Array.from(nMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    adjTop10.set(id, new Map(sorted));
  }

  return { adjFull, adjTop10 };
}

// 2. Captive molecule & chemical synonyms dictionary
const captiveAndSynonyms = new Map([
  // Captives & Trade names
  ['georgywood', 'cedar'],
  ['ambrofix', 'ambergris'],
  ['cetalox', 'ambergris'],
  ['akigalawood', 'patchouli'],
  ['hedione', 'jasmine'],
  ['cashmeran', 'musk'],
  ['iso e super', 'woody notes'],
  ['ambroxan', 'ambergris'],
  ['amber gris', 'ambergris'],
  ['ambergris', 'ambergris'],

  // Standard botannical & spelling synonyms
  ['oak moss', 'oakmoss'],
  ['oakmoss', 'oakmoss'],
  ['tree moss', 'oakmoss'],
  ['treemoss', 'oakmoss'],
  ['cedar wood', 'cedar'],
  ['cedarwood', 'cedar'],
  ['virginia cedar', 'cedar'],
  ['atlas cedar', 'cedar'],
  ['cedar', 'cedar'],
  ['bergamote', 'bergamot'],
  ['calabrian bergamot', 'bergamot'],
  ['bergamot', 'bergamot'],
  ['patchouly', 'patchouli'],
  ['patchouli', 'patchouli'],
  ['woodsy notes', 'woody notes'],
  ['woods', 'woody notes'],
  ['woody notes', 'woody notes'],
  ['blackcurrant', 'black currant'],
  ['black currant', 'black currant'],
  ['cassis', 'black currant'],
  ['mandarin', 'mandarin orange'],
  ['mandarine', 'mandarin orange'],
  ['mandarin orange', 'mandarin orange'],
  ['tangerine', 'mandarin orange'],
  ['bourbon vanilla', 'vanilla'],
  ['madagascar vanilla', 'vanilla'],
  ['vanilla', 'vanilla'],
  ['musk', 'musk'],
  ['white musk', 'white musk']
]);

function normalizeNoteRaw(raw) {
  let s = raw.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
}

function normalizeNoteDict(raw) {
  const s = normalizeNoteRaw(raw);
  return captiveAndSynonyms.get(s) || s;
}

const cloneHouses = new Set([
  'Afnan', 'Lattafa Perfumes', 'Lattafa', 'Armaf', 'Maison Alhambra',
  'Fragrance World', 'Paris Corner', 'Al Haramain Perfumes', 'Rasasi', 'Zara',
  'The Dua Brand', 'Oakcha', 'Dumont', 'Orientica', 'Maison Asrar'
]);

module.exports = {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteRaw,
  normalizeNoteDict,
  cloneHouses
};
