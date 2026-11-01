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

const rows = db.prepare(`
  SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
  FROM perfumes
`).all();
const numP = rows.length;

function buildTestIndex(noteNormalizer) {
  const noteToId = new Map();
  const accordToId = new Map();
  function getNoteId(n) { let id = noteToId.get(n); if (id === undefined) { id = noteToId.size; noteToId.set(n, id); } return id; }
  function getAccordId(a) { let id = accordToId.get(a); if (id === undefined) { id = accordToId.size; accordToId.set(a, id); } return id; }

  const pData = [];
  for (let i = 0; i < numP; i++) {
    const r = rows[i];
    const topNotes = (r.notes_top || '').split('|').map(noteNormalizer).filter(Boolean);
    const midNotes = (r.notes_middle || '').split('|').map(noteNormalizer).filter(Boolean);
    const baseNotes = (r.notes_base || '').split('|').map(noteNormalizer).filter(Boolean);
    const flatNotes = (r.notes_flat || '').split('|').map(noteNormalizer).filter(Boolean);

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

  const idToInternal = new Map();
  const pNorms = new Float32Array(numP);
  const pAccNorms = new Float32Array(numP);
  const pQueryNoteSums = new Float32Array(numP);
  const pNoteArrays = [];
  const pAccordArrays = [];

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

console.log('Building raw & dict index...');
const idxRaw = buildTestIndex(normalizeNoteRaw);
const idxDict = buildTestIndex(normalizeNoteDict);

function scoreQueryAll(idxObj, config, qid) {
  const { idToInternal, pData, pNorms, pAccNorms, pQueryNoteSums, pNoteArrays, pAccordArrays } = idxObj;
  const tIdx = idToInternal.get(qid);
  if (tIdx === undefined) return [];

  const tNotes = pNoteArrays[tIdx];
  const tNorm = pNorms[tIdx];
  const tAccords = pAccordArrays[tIdx];
  const tAccNorm = pAccNorms[tIdx];
  const tHasAcc = pData[tIdx].hasAccords;
  const tGender = pData[tIdx].gender;
  const tQSum = pQueryNoteSums[tIdx];

  const scored = [];

  for (let cIdx = 0; cIdx < numP; cIdx++) {
    if (cIdx === tIdx) continue;
    const cand = pData[cIdx];
    const cNotes = pNoteArrays[cIdx];
    const cNorm = pNorms[cIdx];
    const cAcc = pAccordArrays[cIdx];
    const cAccNorm = pAccNorms[cIdx];
    const cHasAcc = cand.hasAccords;
    const cGender = cand.gender;
    const cQSum = pQueryNoteSums[cIdx];

    let genderPenalty = 0;
    if (config.genderPenalty) {
      if ((tGender === 'male' && cGender === 'female') || (tGender === 'female' && cGender === 'male')) {
        genderPenalty = config.genderPenalty;
      }
    }

    let noteDot = 0, sharedQ = 0, sharedC = 0;
    let p1 = 0, p2 = 0;
    while (p1 < tNotes.ids.length && p2 < cNotes.ids.length) {
      if (tNotes.ids[p1] === cNotes.ids[p2]) {
        const v1 = tNotes.vals[p1];
        const v2 = cNotes.vals[p2];
        noteDot += v1 * v2;
        sharedQ += v1;
        sharedC += v2;
        p1++; p2++;
      } else if (tNotes.ids[p1] < cNotes.ids[p2]) p1++;
      else p2++;
    }

    if (noteDot === 0 && !tHasAcc) continue;

    const noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;
    const containmentQtoC = tQSum > 0 ? (sharedQ / tQSum) : 0;
    const containmentCtoQ = cQSum > 0 ? (sharedC / cQSum) : 0;

    let accordSim = 0;
    let top1Match = 0;
    if (tHasAcc && cHasAcc && tAccNorm > 0 && cAccNorm > 0) {
      let accDot = 0;
      let a1 = 0, a2 = 0;
      while (a1 < tAccords.ids.length && a2 < cAcc.ids.length) {
        if (tAccords.ids[a1] === cAcc.ids[a2]) {
          accDot += tAccords.vals[a1] * cAcc.vals[a2];
          a1++; a2++;
        } else if (tAccords.ids[a1] < cAcc.ids[a2]) a1++;
        else a2++;
      }
      accordSim = Math.max(0, (accDot / (tAccNorm * cAccNorm) + 1) / 2);
      if (tAccords.ids.length > 0 && cAcc.ids.length > 0 && tAccords.ids[0] === cAcc.ids[0]) top1Match = 1;
    } else {
      accordSim = noteSim;
    }

    let score = 0;
    if (config.mode === 'untuned') {
      score = (tHasAcc && cHasAcc) ? (0.50 * noteSim + 0.50 * accordSim) : noteSim;
    } else if (config.mode === 'containment') {
      const blendedNote = 0.60 * noteSim + 0.40 * containmentQtoC;
      score = (tHasAcc && cHasAcc) ? (0.50 * blendedNote + 0.50 * accordSim) : blendedNote;
    } else if (config.mode === 'dynamic_accords') {
      const blendedNote = 0.60 * noteSim + 0.40 * containmentQtoC;
      if (accordSim >= 0.85 && tHasAcc && cHasAcc) {
        score = 0.65 * accordSim + 0.35 * blendedNote;
      } else if (tHasAcc && cHasAcc) {
        score = 0.50 * accordSim + 0.50 * blendedNote;
      } else {
        score = blendedNote;
      }
    } else if (config.mode === 'ltr') {
      const isClone = (config.useClone && cloneHouses.has(cand.brand)) ? 1.0 : 0.0;
      score = (
        0.35 * noteSim +
        0.25 * containmentQtoC +
        0.10 * containmentCtoQ +
        0.40 * accordSim +
        0.05 * top1Match +
        (config.useClone ? 0.04 * isClone : 0.0)
      );
    }

    score -= genderPenalty;
    scored.push({ id: cand.id, brand: cand.brand, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Apply brand cap 2
  const ranked = [];
  const brandCount = new Map();
  for (const s of scored) {
    const cnt = brandCount.get(s.brand) || 0;
    if (cnt < 2) {
      ranked.push(s.id);
      brandCount.set(s.brand, cnt + 1);
    }
  }
  return ranked;
}

const cases = [
  { q: 68271, t: 9828, name: 'SNOI -> Aventus' },
  { q: 68271, t: 44174, name: 'SNOI -> Hacivat' },
  { q: 108244, t: 84224, name: 'Turathi Electric -> Blue Talisman' },
  { q: 9828, t: 68271, name: 'Aventus -> SNOI' },
  { q: 84224, t: 108244, name: 'Blue Talisman -> Turathi Electric' }
];

const variants = [
  { name: '1. Untuned + Raw Notes', fn: (qid) => scoreQueryAll(idxRaw, { mode: 'untuned' }, qid) },
  { name: '2. Untuned + Dict Notes', fn: (qid) => scoreQueryAll(idxDict, { mode: 'untuned' }, qid) },
  { name: '3. + Asymmetric Containment', fn: (qid) => scoreQueryAll(idxDict, { mode: 'containment' }, qid) },
  { name: '4. + Dynamic Accords', fn: (qid) => scoreQueryAll(idxDict, { mode: 'dynamic_accords' }, qid) },
  { name: '5. LTR with IsClone', fn: (qid) => scoreQueryAll(idxDict, { mode: 'ltr', useClone: true, genderPenalty: 0.08 }, qid) },
  { name: '6. LTR without IsClone', fn: (qid) => scoreQueryAll(idxDict, { mode: 'ltr', useClone: false, genderPenalty: 0.08 }, qid) },
  {
    name: '7. Precomputed (Content-Only DB)',
    fn: (qid) => {
      const rows = db.prepare('SELECT similar_id FROM similar WHERE fragrance_id = ? AND source = \'content\' ORDER BY rank ASC LIMIT 500').all(qid);
      return rows.map(r => r.similar_id);
    }
  }
];

const tableResults = [];

for (const v of variants) {
  const row = { variant: v.name };
  for (const c of cases) {
    const list = v.fn(c.q);
    const r = list.indexOf(c.t) + 1;
    row[c.name] = r > 0 ? `#${r}` : '> 500';
  }
  tableResults.push(row);
}

console.log('\n--- ABLATION ACCEPTANCE TABLE ---');
console.table(tableResults);

fs.writeFileSync('scripts/ablation_acceptance_results.json', JSON.stringify(tableResults, null, 2));
