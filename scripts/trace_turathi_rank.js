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

const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
const numP = rows.length;

function runForQuery(normalizer, weights, topK = 30) {
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

  const tIdx = idToInternal.get(108244); // Turathi Electric
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
    if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) {
      genderPenalty = 0.08;
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

    if (noteDot === 0) continue;

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

    const isClone = cloneHouses.has(cand.brand) ? 1.0 : 0.0;
    const score = (
      weights.wNote * noteSim +
      weights.wContainQ * containmentQtoC +
      weights.wContainC * containmentCtoQ +
      weights.wAccord * accordSim +
      weights.wTop1 * top1Match +
      weights.wClone * isClone -
      genderPenalty
    );

    scored.push({ id: cand.id, name: cand.name, brand: cand.brand, score, noteSim, accordSim, containmentQtoC });
  }

  scored.sort((a, b) => b.score - a.score);

  // Apply brand cap 2
  const finalRanks = [];
  const brandCount = new Map();
  for (const s of scored) {
    const cnt = brandCount.get(s.brand) || 0;
    if (cnt < 2) {
      finalRanks.push(s);
      brandCount.set(s.brand, cnt + 1);
    }
  }

  const btRank = finalRanks.findIndex(r => r.id === 84224) + 1;
  return { btRank, top15: finalRanks.slice(0, 20) };
}

// 1. Untuned weights (50% note, 50% accord)
const wUntuned = { wNote: 0.50, wContainQ: 0.0, wContainC: 0.0, wAccord: 0.50, wTop1: 0.0, wClone: 0.0 };
// 2. LTR weights with clone feature
const wLTR_withClone = { wNote: 0.35, wContainQ: 0.25, wContainC: 0.10, wAccord: 0.40, wTop1: 0.05, wClone: 0.04 };
// 3. LTR weights without clone feature
const wLTR_noClone = { wNote: 0.35, wContainQ: 0.25, wContainC: 0.10, wAccord: 0.40, wTop1: 0.05, wClone: 0.0 };

console.log('--- TURATHI ELECTRIC -> BLUE TALISMAN RANK COMPARISON ---');
const rawUntuned = runForQuery(normalizeNoteRaw, wUntuned);
console.log('Raw Notes + Untuned Weights -> Blue Talisman Rank:', rawUntuned.btRank);

const dictUntuned = runForQuery(normalizeNoteDict, wUntuned);
console.log('Dict Notes + Untuned Weights -> Blue Talisman Rank:', dictUntuned.btRank);

const dictLTR = runForQuery(normalizeNoteDict, wLTR_withClone);
console.log('Dict Notes + LTR with Clone -> Blue Talisman Rank:', dictLTR.btRank);

const dictLTR_noClone = runForQuery(normalizeNoteDict, wLTR_noClone);
console.log('Dict Notes + LTR without Clone -> Blue Talisman Rank:', dictLTR_noClone.btRank);

console.log('\nCandidates ahead of Blue Talisman in Dict LTR:');
dictLTR.top15.forEach((c, idx) => {
  console.log(`  #${(idx+1).toString().padStart(2)}: [${c.id}] ${c.name} (${c.brand}) | Score: ${c.score.toFixed(4)} | NoteSim: ${c.noteSim.toFixed(3)} | AccSim: ${c.accordSim.toFixed(3)} | Cont: ${c.containmentQtoC.toFixed(3)}`);
});
