const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteRaw,
  normalizeNoteDict,
  cloneHouses
} = require('./ablation_common');

// Let's inspect Turathi Electric (108244) -> Blue Talisman (84224)
// Compare Raw vs Dict under exact scoring functions!

const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
const numP = rows.length;

function buildTestIndex(normalizer) {
  const noteToId = new Map();
  const accordToId = new Map();

  function getNoteId(n) {
    let id = noteToId.get(n);
    if (id === undefined) { id = noteToId.size; noteToId.set(n, id); }
    return id;
  }
  function getAccordId(a) {
    let id = accordToId.get(a);
    if (id === undefined) { id = accordToId.size; accordToId.set(a, id); }
    return id;
  }

  const pData = [];
  for (let i = 0; i < numP; i++) {
    const r = rows[i];
    const topNotes = (r.notes_top || '').split('|').map(normalizer).filter(Boolean);
    const midNotes = (r.notes_middle || '').split('|').map(normalizer).filter(Boolean);
    const baseNotes = (r.notes_base || '').split('|').map(normalizer).filter(Boolean);
    const flatNotes = (r.notes_flat || '').split('|').map(normalizer).filter(Boolean);

    const hasPyramid = (topNotes.length + midNotes.length + baseNotes.length > 0);
    const isFlatOnly = !hasPyramid && flatNotes.length > 0;

    const nMap = new Map();
    if (isFlatOnly) {
      for (const n of flatNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.0));
    } else {
      for (const n of topNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.0));
      for (const n of midNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.2));
      for (const n of baseNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.4));
    }

    let accords = [];
    if (r.accords) {
      accords = r.accords.split('|').filter(Boolean).map(p => {
        const [name, val] = p.split(':');
        return { id: getAccordId((name || '').trim().toLowerCase()), val: Number(val) || 0 };
      });
    }

    pData.push({
      id: r.id,
      name: r.name,
      brand: r.brand || '',
      gender: (r.gender || 'unisex').toLowerCase(),
      vote_count: r.vote_count || 0,
      noteMap: nMap,
      accords,
      hasAccords: accords.length > 0
    });
  }

  const numNotes = noteToId.size;
  const noteDF = new Int32Array(numNotes);
  for (const p of pData) for (const nid of p.noteMap.keys()) noteDF[nid]++;

  const noteIDF = new Float32Array(numNotes);
  for (let nid = 0; nid < numNotes; nid++) {
    const df = noteDF[nid];
    noteIDF[nid] = Math.log(1 + (numP - df + 0.5) / (df + 0.5));
  }

  const pNorms = new Float32Array(numP);
  const pAccNorms = new Float32Array(numP);
  const pQueryNoteSums = new Float32Array(numP);
  const pNoteArrays = [];
  const pAccordArrays = [];
  const idToInternal = new Map();

  for (let i = 0; i < numP; i++) {
    const p = pData[i];
    idToInternal.set(p.id, i);

    const nEntries = Array.from(p.noteMap.entries()).sort((a, b) => a[0] - b[0]);
    const nIds = new Int32Array(nEntries.length);
    const nVals = new Float32Array(nEntries.length);
    let nNorm = 0;
    let qSum = 0;
    for (let j = 0; j < nEntries.length; j++) {
      const nid = nEntries[j][0];
      const w = nEntries[j][1];
      const tfidf = w * noteIDF[nid];
      nIds[j] = nid;
      nVals[j] = tfidf;
      nNorm += tfidf * tfidf;
      qSum += tfidf;
    }
    pNorms[i] = Math.sqrt(nNorm);
    pQueryNoteSums[i] = qSum;
    pNoteArrays.push({ ids: nIds, vals: nVals });

    if (p.accords.length > 0) {
      const aEntries = [...p.accords].sort((a, b) => a.id - b.id);
      const aCount = aEntries.length;
      const meanVal = aEntries.reduce((sum, a) => sum + a.val, 0) / aCount;
      const aIds = new Int32Array(aCount);
      const aVals = new Float32Array(aCount);
      let aNorm = 0;
      for (let j = 0; j < aCount; j++) {
        const a = aEntries[j];
        const z = a.val - meanVal;
        aIds[j] = a.id;
        aVals[j] = z;
        aNorm += z * z;
      }
      pAccNorms[i] = Math.sqrt(aNorm);
      pAccordArrays.push({ ids: aIds, vals: aVals });
    } else {
      pAccNorms[i] = 0;
      pAccordArrays.push({ ids: new Int32Array(0), vals: new Float32Array(0) });
    }
  }

  return { idToInternal, pData, pNorms, pAccNorms, pQueryNoteSums, pNoteArrays, pAccordArrays };
}

function scorePair(idx, id1, id2) {
  const i1 = idx.idToInternal.get(id1);
  const i2 = idx.idToInternal.get(id2);
  const n1 = idx.pNoteArrays[i1];
  const n2 = idx.pNoteArrays[i2];
  const norm1 = idx.pNorms[i1];
  const norm2 = idx.pNorms[i2];

  let dot = 0, sharedQ = 0;
  let p1 = 0, p2 = 0;
  while (p1 < n1.ids.length && p2 < n2.ids.length) {
    if (n1.ids[p1] === n2.ids[p2]) {
      dot += n1.vals[p1] * n2.vals[p2];
      sharedQ += n1.vals[p1];
      p1++; p2++;
    } else if (n1.ids[p1] < n2.ids[p2]) p1++;
    else p2++;
  }
  const noteSim = (norm1 > 0 && norm2 > 0) ? dot / (norm1 * norm2) : 0;
  const containment = idx.pQueryNoteSums[i1] > 0 ? sharedQ / idx.pQueryNoteSums[i1] : 0;

  // Accords
  const a1 = idx.pAccordArrays[i1];
  const a2 = idx.pAccordArrays[i2];
  let accDot = 0;
  let pa1 = 0, pa2 = 0;
  while (pa1 < a1.ids.length && pa2 < a2.ids.length) {
    if (a1.ids[pa1] === a2.ids[pa2]) {
      accDot += a1.vals[pa1] * a2.vals[pa2];
      pa1++; pa2++;
    } else if (a1.ids[pa1] < a2.ids[pa2]) pa1++;
    else pa2++;
  }
  const accordSim = (idx.pAccNorms[i1] > 0 && idx.pAccNorms[i2] > 0) ? Math.max(0, (accDot / (idx.pAccNorms[i1] * idx.pAccNorms[i2]) + 1) / 2) : noteSim;

  return { noteSim, containment, accordSim };
}

console.log('Building index Raw...');
const idxRaw = buildTestIndex(normalizeNoteRaw);
console.log('Building index Dict...');
const idxDict = buildTestIndex(normalizeNoteDict);

console.log('\n--- Turathi Electric (108244) -> Blue Talisman (84224) Pair Features ---');
console.log('Raw Notes:', scorePair(idxRaw, 108244, 84224));
console.log('Dict Notes:', scorePair(idxDict, 108244, 84224));
