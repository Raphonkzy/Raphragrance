const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteDict,
  cloneHouses
} = require('./ablation_common');

class MinHeap {
  constructor(maxSize) { this.maxSize = maxSize; this.heap = []; }
  push(idx, val) {
    if (this.heap.length < this.maxSize) {
      this.heap.push({ idx, val });
      this._up(this.heap.length - 1);
    } else if (val > this.heap[0].val) {
      this.heap[0] = { idx, val };
      this._down(0);
    }
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].val > this.heap[i].val) {
        const tmp = this.heap[p]; this.heap[p] = this.heap[i]; this.heap[i] = tmp;
        i = p;
      } else break;
    }
  }
  _down(i) {
    const len = this.heap.length;
    while ((i << 1) + 1 < len) {
      let left = (i << 1) + 1;
      let right = left + 1;
      let smallest = (right < len && this.heap[right].val < this.heap[left].val) ? right : left;
      if (this.heap[smallest].val < this.heap[i].val) {
        const tmp = this.heap[smallest]; this.heap[smallest] = this.heap[i]; this.heap[i] = tmp;
        i = smallest;
      } else break;
    }
  }
}

async function tuneOnBackground() {
  console.log('Loading Ground Truth...');
  const { adjFull } = await loadGroundTruth();

  const rows = db.prepare(`SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes`).all();
  const numP = rows.length;

  const noteToId = new Map();
  const accordToId = new Map();
  function getNoteId(n) { let id = noteToId.get(n); if (id === undefined) { id = noteToId.size; noteToId.set(n, id); } return id; }
  function getAccordId(a) { let id = accordToId.get(a); if (id === undefined) { id = accordToId.size; accordToId.set(a, id); } return id; }

  const pData = [];
  for (let i = 0; i < numP; i++) {
    const r = rows[i];
    const topNotes = (r.notes_top || '').split('|').map(normalizeNoteDict).filter(Boolean);
    const midNotes = (r.notes_middle || '').split('|').map(normalizeNoteDict).filter(Boolean);
    const baseNotes = (r.notes_base || '').split('|').map(normalizeNoteDict).filter(Boolean);
    const flatNotes = (r.notes_flat || '').split('|').map(normalizeNoteDict).filter(Boolean);

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
      hasPyramid,
      isFlatOnly,
      isNoNotes,
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

  const noteIndex = Array.from({ length: numNotes }, () => []);
  const numAccords = accordToId.size;
  const accordIndex = Array.from({ length: numAccords }, () => []);

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
      noteIndex[nid].push(i);
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
        accordIndex[a.id].push(i);
      }
      pAccNorms[i] = Math.sqrt(aNorm);
      pAccordArrays.push({ ids: aIds, vals: aVals });
    } else {
      pAccNorms[i] = 0;
      pAccordArrays.push({ ids: new Int32Array(0), vals: new Float32Array(0) });
    }
  }

  // Precomputed candidate arrays
  const candScores = new Float32Array(numP);
  const touchedCands = new Int32Array(numP);

  function runQuery(targetDbId, wNote, wContain, wAccord, wTop1, wClone, candLimit = 300) {
    const tIdx = idToInternal.get(targetDbId);
    if (tIdx === undefined) return [];

    const tNotes = pNoteArrays[tIdx];
    const tNorm = pNorms[tIdx];
    const tAccords = pAccordArrays[tIdx];
    const tAccNorm = pAccNorms[tIdx];
    const tHasAcc = pData[tIdx].hasAccords;
    const tGender = pData[tIdx].gender;
    const tQSum = pQueryNoteSums[tIdx];

    let touchedCount = 0;

    for (let j = 0; j < tNotes.ids.length; j++) {
      const nid = tNotes.ids[j];
      const qVal = tNotes.vals[j];
      const postings = noteIndex[nid];
      const pLen = postings.length;
      for (let k = 0; k < pLen; k++) {
        const cIdx = postings[k];
        if (cIdx === tIdx) continue;
        if (candScores[cIdx] === 0) touchedCands[touchedCount++] = cIdx;
        candScores[cIdx] += qVal;
      }
    }

    const topAccCount = Math.min(3, tAccords.ids.length);
    for (let j = 0; j < topAccCount; j++) {
      const aid = tAccords.ids[j];
      const postings = accordIndex[aid];
      const pLen = postings.length;
      for (let k = 0; k < pLen; k++) {
        const cIdx = postings[k];
        if (cIdx === tIdx) continue;
        if (candScores[cIdx] === 0) touchedCands[touchedCount++] = cIdx;
        candScores[cIdx] += 1.5;
      }
    }

    const heap = new MinHeap(candLimit);
    for (let i = 0; i < touchedCount; i++) {
      const cIdx = touchedCands[i];
      const raw = candScores[cIdx];
      candScores[cIdx] = 0;
      const cNorm = Math.max(1, pNorms[cIdx]);
      heap.push(cIdx, raw / Math.sqrt(cNorm));
    }

    const candidates = heap.heap;
    const scored = [];
    for (let i = 0; i < candidates.length; i++) {
      const cIdx = candidates[i].idx;
      const cand = pData[cIdx];
      const cNotes = pNoteArrays[cIdx];
      const cNorm = pNorms[cIdx];
      const cAcc = pAccordArrays[cIdx];
      const cAccNorm = pAccNorms[cIdx];
      const cHasAcc = cand.hasAccords;
      const cGender = cand.gender;

      let genderPenalty = 0;
      if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) {
        genderPenalty = 0.08;
      }

      let noteDot = 0;
      let sharedQueryWeights = 0;
      let p1 = 0, p2 = 0;
      while (p1 < tNotes.ids.length && p2 < cNotes.ids.length) {
        const id1 = tNotes.ids[p1];
        const id2 = cNotes.ids[p2];
        if (id1 === id2) {
          const v1 = tNotes.vals[p1];
          const v2 = cNotes.vals[p2];
          noteDot += v1 * v2;
          sharedQueryWeights += v1;
          p1++; p2++;
        } else if (id1 < id2) p1++;
        else p2++;
      }

      const noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;
      const containment = tQSum > 0 ? (sharedQueryWeights / tQSum) : 0;

      let accordSim = 0;
      let top1Match = 0;
      if (tHasAcc && cHasAcc && tAccNorm > 0 && cAccNorm > 0) {
        let accDot = 0;
        let a1 = 0, a2 = 0;
        while (a1 < tAccords.ids.length && a2 < cAcc.ids.length) {
          const id1 = tAccords.ids[a1];
          const id2 = cAcc.ids[a2];
          if (id1 === id2) {
            accDot += tAccords.vals[a1] * cAcc.vals[a2];
            a1++; a2++;
          } else if (id1 < id2) a1++;
          else a2++;
        }
        accordSim = Math.max(0, (accDot / (tAccNorm * cAccNorm) + 1) / 2);
        if (tAccords.ids.length > 0 && cAcc.ids.length > 0 && tAccords.ids[0] === cAcc.ids[0]) {
          top1Match = 1;
        }
      } else {
        accordSim = noteSim;
      }

      const isClone = cloneHouses.has(cand.brand) ? 1.0 : 0.0;
      let score = (
        wNote * noteSim +
        wContain * containment +
        wAccord * accordSim +
        wTop1 * top1Match +
        wClone * isClone -
        genderPenalty
      );

      const tieBreaker = Math.log10(Math.max(1, cand.vote_count)) * 1e-6;
      scored.push({ id: cand.id, brand: cand.brand, score: score + tieBreaker });
    }

    scored.sort((a, b) => b.score - a.score);

    const finalTop = [];
    const brandCount = new Map();
    for (let i = 0; i < scored.length; i++) {
      const s = scored[i];
      const cnt = brandCount.get(s.brand) || 0;
      if (cnt < 2) {
        finalTop.push(s.id);
        brandCount.set(s.brand, cnt + 1);
        if (finalTop.length >= 10) break;
      }
    }
    return finalTop;
  }

  function evaluateSet(idList, wNote, wContain, wAccord, wTop1, wClone) {
    let hit = 0, topGT = 0, prec = 0, mrr = 0, ndcg = 0;
    let count = 0;

    for (let i = 0; i < idList.length; i++) {
      const qid = idList[i];
      const qgt = adjFull.get(qid);
      if (!qgt || qgt.size === 0) continue;

      count++;
      const recs = runQuery(qid, wNote, wContain, wAccord, wTop1, wClone);

      // TopGT Recall
      const sortedGT = Array.from(qgt.entries()).sort((a, b) => b[1] - a[1]);
      const top3GT = sortedGT.slice(0, 3).map(e => e[0]);
      const top3Found = top3GT.filter(id => recs.includes(id)).length;
      topGT += top3GT.length > 0 ? (top3Found / top3GT.length) : 0;

      // Hit & Precision & MRR & nDCG
      const isHit = recs.some(id => qgt.has(id)) ? 1 : 0;
      hit += isHit;

      let matchCount = 0;
      let firstRank = 0;
      let dcg = 0;
      recs.forEach((id, idx) => {
        const rank = idx + 1;
        if (qgt.has(id)) {
          matchCount++;
          if (firstRank === 0) firstRank = rank;
          const rel = qgt.get(id);
          dcg += rel / Math.log2(rank + 1);
        }
      });
      prec += matchCount / 10;
      if (firstRank > 0) mrr += 1 / firstRank;

      let idcg = 0;
      for (let k = 0; k < Math.min(10, sortedGT.length); k++) {
        idcg += sortedGT[k][1] / Math.log2(k + 2);
      }
      if (idcg > 0) ndcg += dcg / idcg;
    }

    return {
      count,
      topGTRecall: (topGT / count) * 100,
      hit10: (hit / count) * 100,
      prec10: (prec / count) * 100,
      mrr: (mrr / count),
      ndcg10: (ndcg / count) * 100
    };
  }

  // We sample 1,500 background queries to tune weights
  const bgSample = splitData.background.slice(0, 1500);
  console.log(`Tuning weights on Background sample of ${bgSample.length} fragrances...`);

  const weightGrid = [
    { wNote: 0.35, wContain: 0.25, wAccord: 0.35, wTop1: 0.05, wClone: 0.03, label: 'Balanced (Note 35, Contain 25, Acc 35)' },
    { wNote: 0.25, wContain: 0.35, wAccord: 0.35, wTop1: 0.05, wClone: 0.03, label: 'Containment-heavy (Contain 35, Note 25)' },
    { wNote: 0.20, wContain: 0.25, wAccord: 0.50, wTop1: 0.05, wClone: 0.03, label: 'Accord-dominant (Accord 50, Contain 25, Note 20)' },
    { wNote: 0.15, wContain: 0.25, wAccord: 0.55, wTop1: 0.05, wClone: 0.05, label: 'Accord-heavy + Clone (Accord 55, Contain 25, Note 15, Clone 5)' },
    { wNote: 0.30, wContain: 0.30, wAccord: 0.30, wTop1: 0.10, wClone: 0.05, label: 'Top-Accord Focus (Top1 10, Note 30, Contain 30, Acc 30)' }
  ];

  for (const g of weightGrid) {
    const res = evaluateSet(bgSample, g.wNote, g.wContain, g.wAccord, g.wTop1, g.wClone);
    console.log(`\nConfig: ${g.label}`);
    console.log(`  TopGT-Rec@10: ${res.topGTRecall.toFixed(2)}% | Hit@10: ${res.hit10.toFixed(2)}% | Prec@10: ${res.prec10.toFixed(2)}% | MRR: ${res.mrr.toFixed(4)} | nDCG@10: ${res.ndcg10.toFixed(2)}%`);
  }
}

tuneOnBackground().catch(console.error);
