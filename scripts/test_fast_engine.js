const fs = require('fs');

// Fast evaluation script using integer indices for notes and accords
// Let's test speed on 100 queries
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare(`
  SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
  FROM perfumes
`).all();

console.log('Building fast integer structures for 131,930 perfumes...');

const canonicalNotes = new Map([
  ['oak moss', 'oakmoss'], ['oakmoss', 'oakmoss'], ['tree moss', 'oakmoss'], ['treemoss', 'oakmoss'],
  ['cedar wood', 'cedar'], ['cedarwood', 'cedar'], ['virginia cedar', 'cedar'], ['atlas cedar', 'cedar'], ['cedar', 'cedar'],
  ['bergamote', 'bergamot'], ['calabrian bergamot', 'bergamot'], ['bergamot', 'bergamot'],
  ['patchouly', 'patchouli'], ['patchouli', 'patchouli'],
  ['ambroxan', 'ambergris'], ['ambrofix', 'ambergris'], ['cetalox', 'ambergris'], ['amber gris', 'ambergris'], ['ambergris', 'ambergris'],
  ['georgywood', 'cedar'], ['akigalawood', 'patchouli'], ['iso e super', 'woody notes'], ['woody notes', 'woody notes'],
  ['woodsy notes', 'woody notes'], ['woods', 'woody notes'],
  ['blackcurrant', 'black currant'], ['black currant', 'black currant'], ['cassis', 'black currant'],
  ['mandarin', 'mandarin orange'], ['mandarine', 'mandarin orange'], ['mandarin orange', 'mandarin orange'], ['tangerine', 'mandarin orange'],
  ['bourbon vanilla', 'vanilla'], ['madagascar vanilla', 'vanilla'], ['vanilla', 'vanilla'],
  ['musk', 'musk'], ['white musk', 'white musk']
]);

function normalizeNote(raw) {
  let s = raw.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
  return canonicalNotes.get(s) || s;
}

// 1. Assign integer ID to every unique note and accord
const noteToId = new Map();
const accordToId = new Map();
function getNoteId(n) {
  let id = noteToId.get(n);
  if (id === undefined) {
    id = noteToId.size;
    noteToId.set(n, id);
  }
  return id;
}
function getAccordId(a) {
  let id = accordToId.get(a);
  if (id === undefined) {
    id = accordToId.size;
    accordToId.set(a, id);
  }
  return id;
}

// First pass: vocabulary and document frequencies
const numP = rows.length;
const rawNoteDF = new Int32Array(5000); // dynamically sized or map
const pData = [];

for (let i = 0; i < numP; i++) {
  const r = rows[i];
  const topNotes = (r.notes_top || '').split('|').map(normalizeNote).filter(Boolean);
  const midNotes = (r.notes_middle || '').split('|').map(normalizeNote).filter(Boolean);
  const baseNotes = (r.notes_base || '').split('|').map(normalizeNote).filter(Boolean);
  const flatNotes = (r.notes_flat || '').split('|').map(normalizeNote).filter(Boolean);

  const hasPyramid = (topNotes.length + midNotes.length + baseNotes.length > 0);
  const isFlatOnly = !hasPyramid && flatNotes.length > 0;
  const isNoNotes = !hasPyramid && !isFlatOnly;

  const nMap = new Map();
  if (isFlatOnly) {
    for (const n of flatNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.0));
  } else {
    for (const n of topNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.0));
    for (const n of midNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.2));
    for (const n of baseNotes) nMap.set(getNoteId(n), Math.max(nMap.get(getNoteId(n)) || 0, 1.4));
  }

  // Accords
  let accords = [];
  if (r.accords) {
    accords = r.accords.split('|').filter(Boolean).map(p => {
      const [name, val] = p.split(':');
      return { id: getAccordId((name || '').trim().toLowerCase()), val: Number(val) || 0 };
    });
  }

  pData.push({
    id: r.id,
    brand: r.brand || '',
    vote_count: r.vote_count || 0,
    noteMap: nMap,
    accords,
    hasPyramid,
    isFlatOnly,
    isNoNotes,
    hasAccords: accords.length > 0
  });
}

const numNotes = noteToId.size;
const noteDF = new Int32Array(numNotes);
for (const p of pData) {
  for (const nid of p.noteMap.keys()) {
    noteDF[nid]++;
  }
}

// IDF array
const noteIDF = new Float32Array(numNotes);
for (let nid = 0; nid < numNotes; nid++) {
  const df = noteDF[nid];
  noteIDF[nid] = Math.log(1 + (numP - df + 0.5) / (df + 0.5));
}

// Inverted index as Int32Array arrays
const noteIndex = Array.from({ length: numNotes }, () => []);
const numAccords = accordToId.size;
const accordIndex = Array.from({ length: numAccords }, () => []);

// Perfume lookup by internal index and by DB ID
const idToInternal = new Map();
const pNorms = new Float32Array(numP);
const pAccNorms = new Float32Array(numP);
const pNoteArrays = []; // { ids: Int32Array, weights: Float32Array }
const pAccordArrays = []; // { ids: Int32Array, vals: Float32Array }

for (let i = 0; i < numP; i++) {
  const p = pData[i];
  idToInternal.set(p.id, i);

  // Notes
  const nEntries = Array.from(p.noteMap.entries());
  const nIds = new Int32Array(nEntries.length);
  const nVals = new Float32Array(nEntries.length);
  let nNorm = 0;
  for (let j = 0; j < nEntries.length; j++) {
    const nid = nEntries[j][0];
    const w = nEntries[j][1];
    const tfidf = w * noteIDF[nid];
    nIds[j] = nid;
    nVals[j] = tfidf;
    nNorm += tfidf * tfidf;
    noteIndex[nid].push(i); // store internal index
  }
  pNorms[i] = Math.sqrt(nNorm);
  pNoteArrays.push({ ids: nIds, vals: nVals });

  // Centered Accords
  if (p.accords.length > 0) {
    const aCount = p.accords.length;
    const meanVal = p.accords.reduce((sum, a) => sum + a.val, 0) / aCount;
    const aIds = new Int32Array(aCount);
    const aVals = new Float32Array(aCount);
    let aNorm = 0;
    for (let j = 0; j < aCount; j++) {
      const a = p.accords[j];
      const z = a.val - meanVal;
      aIds[j] = a.id;
      aVals[j] = z;
      aNorm += z * z;
      accordIndex[a.id].push(i);
    }
    pAccNorms[i] = Math.sqrt(aNorm);
    pAccordArrays.push({ ids: aIds, vals: aVals });
  } else {
    pAccNorms[i] = 0;
    pAccordArrays.push({ ids: new Int32Array(0), vals: new Float32Array(0) });
  }
}

console.log(`Precomputation complete! Notes vocab: ${numNotes}, Accords vocab: ${numAccords}.`);
console.log(`Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`);

// Fast candidate accumulator (reusable Float32Array across queries to avoid GC)
const candScores = new Float32Array(numP);
const touchedCands = new Int32Array(numP);

function fastGetRecs(targetDbId, topK = 10, candidateLimit = 350) {
  const tIdx = idToInternal.get(targetDbId);
  if (tIdx === undefined) return [];

  const tNotes = pNoteArrays[tIdx];
  const tNorm = pNorms[tIdx];
  const tAccords = pAccordArrays[tIdx];
  const tAccNorm = pAccNorms[tIdx];
  const tHasAcc = pData[tIdx].hasAccords;

  let touchedCount = 0;

  // 1. Accumulate rough score from notes
  for (let j = 0; j < tNotes.ids.length; j++) {
    const nid = tNotes.ids[j];
    const qVal = tNotes.vals[j];
    const postings = noteIndex[nid];
    const pLen = postings.length;
    for (let k = 0; k < pLen; k++) {
      const cIdx = postings[k];
      if (cIdx === tIdx) continue;
      if (candScores[cIdx] === 0) {
        touchedCands[touchedCount++] = cIdx;
      }
      candScores[cIdx] += qVal;
    }
  }

  // 2. Accumulate from top accords (first 3)
  const topAccCount = Math.min(3, tAccords.ids.length);
  for (let j = 0; j < topAccCount; j++) {
    const aid = tAccords.ids[j];
    const postings = accordIndex[aid];
    const pLen = postings.length;
    for (let k = 0; k < pLen; k++) {
      const cIdx = postings[k];
      if (cIdx === tIdx) continue;
      if (candScores[cIdx] === 0) {
        touchedCands[touchedCount++] = cIdx;
      }
      candScores[cIdx] += 1.5;
    }
  }

  // Select top candidateLimit candidates
  const pool = [];
  for (let i = 0; i < touchedCount; i++) {
    const cIdx = touchedCands[i];
    const raw = candScores[cIdx];
    candScores[cIdx] = 0; // reset for next query
    const cNorm = Math.max(1, pNorms[cIdx]);
    pool.push({ idx: cIdx, rough: raw / Math.sqrt(cNorm) });
  }

  pool.sort((a, b) => b.rough - a.rough);
  const evalCount = Math.min(candidateLimit, pool.length);

  // Exact scoring on selected pool
  const scored = [];
  for (let i = 0; i < evalCount; i++) {
    const cIdx = pool[i].idx;
    const cNotes = pNoteArrays[cIdx];
    const cNorm = pNorms[cIdx];
    const cAcc = pAccordArrays[cIdx];
    const cAccNorm = pAccNorms[cIdx];
    const cHasAcc = pData[cIdx].hasAccords;

    // Note dot product: intersection of two sorted/small arrays
    let noteDot = 0;
    let p1 = 0, p2 = 0;
    while (p1 < tNotes.ids.length && p2 < cNotes.ids.length) {
      const id1 = tNotes.ids[p1];
      const id2 = cNotes.ids[p2];
      if (id1 === id2) {
        noteDot += tNotes.vals[p1] * cNotes.vals[p2];
        p1++; p2++;
      } else if (id1 < id2) {
        p1++;
      } else {
        p2++;
      }
    }
    const noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;

    // Centered Accord dot product
    let accordSim = 0;
    if (tHasAcc && cHasAcc && tAccNorm > 0 && cAccNorm > 0) {
      let accDot = 0;
      let a1 = 0, a2 = 0;
      while (a1 < tAccords.ids.length && a2 < cAcc.ids.length) {
        const id1 = tAccords.ids[a1];
        const id2 = cAcc.ids[a2];
        if (id1 === id2) {
          accDot += tAccords.vals[a1] * cAcc.vals[a2];
          a1++; a2++;
        } else if (id1 < id2) {
          a1++;
        } else {
          a2++;
        }
      }
      accordSim = accDot / (tAccNorm * cAccNorm);
      accordSim = Math.max(0, (accordSim + 1) / 2);
    } else {
      accordSim = noteSim;
    }

    const contentScore = (tHasAcc && cHasAcc)
      ? (0.50 * noteSim + 0.50 * accordSim)
      : noteSim;

    const tieBreaker = Math.log10(Math.max(1, pData[cIdx].vote_count)) * 1e-6;
    scored.push({ id: pData[cIdx].id, brand: pData[cIdx].brand, score: contentScore + tieBreaker });
  }

  scored.sort((a, b) => b.score - a.score);

  // Brand diversity: max 2 per brand in top 10
  const finalTop = [];
  const brandCount = new Map();
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    const cnt = brandCount.get(s.brand) || 0;
    if (cnt < 2) {
      finalTop.push(s.id);
      brandCount.set(s.brand, cnt + 1);
      if (finalTop.length >= topK) break;
    }
  }

  return finalTop;
}

// Speed test: 100 queries
const tStart = Date.now();
for (let i = 0; i < 100; i++) {
  fastGetRecs(rows[i].id, 10, 350);
}
const elapsed = Date.now() - tStart;
console.log(`100 queries executed in ${elapsed}ms (${(elapsed/100).toFixed(2)} ms/query)!`);
console.log(`Estimated time for 1,000 validation queries: ~${((elapsed/100) * 1000 / 1000).toFixed(1)} seconds!`);
