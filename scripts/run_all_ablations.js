const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteRaw,
  normalizeNoteDict,
  cloneHouses
} = require('./ablation_common');

class MinHeap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.heap = [];
  }
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

async function runAblations() {
  console.log('--- Step 1: Loading Ground Truth ---');
  const { adjFull, adjTop10 } = await loadGroundTruth();

  console.log('--- Step 2: Loading SQLite Catalog ---');
  const rows = db.prepare(`
    SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
    FROM perfumes
  `).all();
  const numP = rows.length;

  function buildIndex(noteNormalizer) {
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

    const pData = [];
    for (let i = 0; i < numP; i++) {
      const r = rows[i];
      const topNotes = (r.notes_top || '').split('|').map(noteNormalizer).filter(Boolean);
      const midNotes = (r.notes_middle || '').split('|').map(noteNormalizer).filter(Boolean);
      const baseNotes = (r.notes_base || '').split('|').map(noteNormalizer).filter(Boolean);
      const flatNotes = (r.notes_flat || '').split('|').map(noteNormalizer).filter(Boolean);

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
    for (const p of pData) {
      for (const nid of p.noteMap.keys()) {
        noteDF[nid]++;
      }
    }

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

    return {
      noteToId,
      accordToId,
      pData,
      noteIDF,
      noteIndex,
      accordIndex,
      idToInternal,
      pNorms,
      pAccNorms,
      pQueryNoteSums,
      pNoteArrays,
      pAccordArrays
    };
  }

  console.log('Building index with Captive Dictionary...');
  const idxDict = buildIndex(normalizeNoteDict);

  console.log('Building index with Raw Notes (no captive dictionary)...');
  const idxRaw = buildIndex(normalizeNoteRaw);

  function evalQueryMetrics(retrievedIds, qgt) {
    const isHit = retrievedIds.some(id => qgt.has(id)) ? 1 : 0;

    const sortedGT = Array.from(qgt.entries()).sort((a, b) => b[1] - a[1]);
    const top3GT = sortedGT.slice(0, 3).map(e => e[0]);
    const top3Found = top3GT.filter(id => retrievedIds.includes(id)).length;
    const topGTRecall = top3GT.length > 0 ? (top3Found / top3GT.length) : 0;

    let matchCount = 0;
    let firstRank = 0;
    let dcg = 0;

    retrievedIds.forEach((id, idx) => {
      const rank = idx + 1;
      if (qgt.has(id)) {
        matchCount++;
        if (firstRank === 0) firstRank = rank;
        const rel = qgt.get(id);
        dcg += rel / Math.log2(rank + 1);
      }
    });

    const precision = matchCount / 10;
    const mrr = firstRank > 0 ? (1 / firstRank) : 0;

    let idcg = 0;
    for (let i = 0; i < Math.min(10, sortedGT.length); i++) {
      idcg += sortedGT[i][1] / Math.log2(i + 2);
    }
    const ndcg = idcg > 0 ? (dcg / idcg) : 0;

    return { isHit, topGTRecall, precision, mrr, ndcg };
  }

  const candScores = new Float32Array(numP);
  const touchedCands = new Int32Array(numP);

  function runEngine(idxObj, config, targetDbId, topK = 10, candLimit = 250) {
    const {
      pData,
      noteIndex,
      accordIndex,
      idToInternal,
      pNorms,
      pAccNorms,
      pQueryNoteSums,
      pNoteArrays,
      pAccordArrays
    } = idxObj;

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
        if (candScores[cIdx] === 0) {
          touchedCands[touchedCount++] = cIdx;
        }
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
        if (candScores[cIdx] === 0) {
          touchedCands[touchedCount++] = cIdx;
        }
        candScores[cIdx] += 1.5;
      }
    }

    // Use MinHeap of size candLimit to find top candidates in O(touchedCount * log K)
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
      const cQSum = pQueryNoteSums[cIdx];

      let genderPenalty = 0;
      if (config.genderMode === 'hard') {
        if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) {
          continue;
        }
      } else if (config.genderMode === 'soft') {
        if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) {
          genderPenalty = config.genderPenalty || 0.08;
        }
      }

      let noteDot = 0;
      let sharedQueryWeights = 0;
      let sharedCandWeights = 0;
      let p1 = 0, p2 = 0;
      while (p1 < tNotes.ids.length && p2 < cNotes.ids.length) {
        const id1 = tNotes.ids[p1];
        const id2 = cNotes.ids[p2];
        if (id1 === id2) {
          const v1 = tNotes.vals[p1];
          const v2 = cNotes.vals[p2];
          noteDot += v1 * v2;
          sharedQueryWeights += v1;
          sharedCandWeights += v2;
          p1++; p2++;
        } else if (id1 < id2) {
          p1++;
        } else {
          p2++;
        }
      }

      const noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;
      const containmentQtoC = tQSum > 0 ? (sharedQueryWeights / tQSum) : 0;
      const containmentCtoQ = cQSum > 0 ? (sharedCandWeights / cQSum) : 0;

      let accordSim = 0;
      let top1AccMatch = 0;
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

        if (tAccords.ids.length > 0 && cAcc.ids.length > 0 && tAccords.ids[0] === cAcc.ids[0]) {
          top1AccMatch = 1;
        }
      } else {
        accordSim = noteSim;
      }

      let score = 0;
      if (config.mode === 'untuned') {
        score = (tHasAcc && cHasAcc) ? (0.50 * noteSim + 0.50 * accordSim) : noteSim;
      } else if (config.mode === 'containment') {
        const blendedNote = (0.60 * noteSim + 0.40 * containmentQtoC);
        score = (tHasAcc && cHasAcc) ? (0.50 * blendedNote + 0.50 * accordSim) : blendedNote;
      } else if (config.mode === 'dynamic_weighting') {
        const blendedNote = (0.60 * noteSim + 0.40 * containmentQtoC);
        if (accordSim >= 0.85 && tHasAcc && cHasAcc) {
          score = 0.65 * accordSim + 0.35 * blendedNote;
        } else if (tHasAcc && cHasAcc) {
          score = 0.50 * accordSim + 0.50 * blendedNote;
        } else {
          score = blendedNote;
        }
      } else if (config.mode === 'ltr') {
        const isClone = cloneHouses.has(cand.brand) ? 1.0 : 0.0;
        score = (
          config.weights.noteSim * noteSim +
          config.weights.containmentQtoC * containmentQtoC +
          config.weights.containmentCtoQ * containmentCtoQ +
          config.weights.accordSim * accordSim +
          config.weights.top1AccMatch * top1AccMatch +
          config.weights.isClone * isClone
        );
      }

      score -= genderPenalty;
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
        if (finalTop.length >= topK) break;
      }
    }
    return finalTop;
  }

  function evaluateAblation(name, idxObj, config, useTop10GT = false) {
    const gtMap = useTop10GT ? adjTop10 : adjFull;
    let hit = 0, topGT = 0, prec = 0, mrr = 0, ndcg = 0;
    let evaluated = 0;

    const tStart = Date.now();
    for (const qid of splitData.validation) {
      const qgt = gtMap.get(qid);
      if (!qgt || qgt.size === 0) continue;

      evaluated++;
      const recs = runEngine(idxObj, config, qid, 10, 250);
      const m = evalQueryMetrics(recs, qgt);

      hit += m.isHit;
      topGT += m.topGTRecall;
      prec += m.precision;
      mrr += m.mrr;
      ndcg += m.ndcg;
    }

    const sec = ((Date.now() - tStart)/1000).toFixed(1);
    console.log(`Evaluated ${name} in ${sec}s.`);
    return {
      name,
      evaluated,
      sec,
      topGTRecall: (topGT / evaluated) * 100,
      hit10: (hit / evaluated) * 100,
      prec10: (prec / evaluated) * 100,
      mrr: (mrr / evaluated),
      ndcg10: (ndcg / evaluated) * 100
    };
  }

  console.log('\n--- Step 3: Running Ablation Suite on Validation Set (N = 1,000) ---');

  const res0_raw = evaluateAblation(
    '0. Baseline Untuned (Raw Notes, No Captives)',
    idxRaw,
    { mode: 'untuned', genderMode: 'none' }
  );

  const res1_dict = evaluateAblation(
    '1. Captive Dictionary (georgywood, ambrofix, etc.)',
    idxDict,
    { mode: 'untuned', genderMode: 'none' }
  );

  const res2_contain = evaluateAblation(
    '2. + Asymmetric Containment (Q->C 40%, Cosine 60%)',
    idxDict,
    { mode: 'containment', genderMode: 'none' }
  );

  const res3_dynamic = evaluateAblation(
    '3. + Dynamic Accord Weighting (accord >= 0.85 -> 65%)',
    idxDict,
    { mode: 'dynamic_weighting', genderMode: 'none' }
  );

  const res4_soft_gender = evaluateAblation(
    '4. + Soft Gender Penalty (-0.08 cross-gender)',
    idxDict,
    { mode: 'dynamic_weighting', genderMode: 'soft', genderPenalty: 0.08 }
  );

  const res4_hard_gender = evaluateAblation(
    '4b. Gender Hard Filter (exclude cross-gender)',
    idxDict,
    { mode: 'dynamic_weighting', genderMode: 'hard' }
  );

  const ltrWeights = {
    noteSim: 0.35,
    containmentQtoC: 0.25,
    containmentCtoQ: 0.10,
    accordSim: 0.40,
    top1AccMatch: 0.05,
    isClone: 0.04
  };

  const res5_ltr = evaluateAblation(
    '5. Learning-to-Rank (LTR Linear Model from Background)',
    idxDict,
    { mode: 'ltr', weights: ltrWeights, genderMode: 'soft', genderPenalty: 0.08 }
  );

  console.log('\n========================================================================================================');
  console.log('ABLATION EXPERIMENTS SUMMARY (FULL GROUND TRUTH, VALIDATION N = 1,000)');
  console.log('========================================================================================================');
  console.log('Experiment                                          | TopGT-Rec@10 | Hit@10  | Prec@10 | MRR    | nDCG@10');
  console.log('----------------------------------------------------|--------------|---------|---------|--------|--------');
  [res0_raw, res1_dict, res2_contain, res3_dynamic, res4_soft_gender, res4_hard_gender, res5_ltr].forEach(r => {
    console.log(
      `${r.name.padEnd(51)} | ` +
      `${r.topGTRecall.toFixed(2).padStart(11)}% | ` +
      `${r.hit10.toFixed(2).padStart(6)}% | ` +
      `${r.prec10.toFixed(2).padStart(6)}% | ` +
      `${r.mrr.toFixed(4).padStart(6)} | ` +
      `${r.ndcg10.toFixed(2).padStart(6)}%`
    );
  });
  console.log('========================================================================================================\n');

  // Size-normalized view
  console.log('\nEvaluating Size-Normalized View (Top 10 GT restricted)...');
  const res_norm_old = evaluateAblation(
    'Old Baseline Engine (Size-Normalized)',
    idxDict,
    { mode: 'untuned', genderMode: 'none' },
    true
  );
  const res_norm_best = evaluateAblation(
    'Tuned LTR Engine (Size-Normalized, Top-10 GT)',
    idxDict,
    { mode: 'ltr', weights: ltrWeights, genderMode: 'soft', genderPenalty: 0.08 },
    true
  );

  console.log(`\nSize-Normalized Old Engine:   TopGT-Rec@10: ${res_norm_old.topGTRecall.toFixed(2)}% | Hit@10: ${res_norm_old.hit10.toFixed(2)}% | Prec@10: ${res_norm_old.prec10.toFixed(2)}% | MRR: ${res_norm_old.mrr.toFixed(4)} | nDCG@10: ${res_norm_old.ndcg10.toFixed(2)}%`);
  console.log(`Size-Normalized Tuned Engine: TopGT-Rec@10: ${res_norm_best.topGTRecall.toFixed(2)}% | Hit@10: ${res_norm_best.hit10.toFixed(2)}% | Prec@10: ${res_norm_best.prec10.toFixed(2)}% | MRR: ${res_norm_best.mrr.toFixed(4)} | nDCG@10: ${res_norm_best.ndcg10.toFixed(2)}%`);

  // Check acceptance cases on best engine
  console.log('\n--- ACCEPTANCE CASES CHECKS ON TUNED CONTENT ENGINE ---');
  function checkPairRank(qId, targetId, qName, tName, maxRank = 10) {
    const recs = runEngine(idxDict, { mode: 'ltr', weights: ltrWeights, genderMode: 'soft', genderPenalty: 0.08 }, qId, 50, 400);
    const rank = recs.indexOf(targetId) + 1;
    console.log(`Query ${qName.padEnd(28)} -> Target: ${tName.padEnd(24)} | Rank: ${rank > 0 ? ('#' + rank).padStart(4) : 'NOT IN TOP 50'} | Pass <= ${maxRank}? ${rank > 0 && rank <= maxRank ? '✓ PASS' : '✗ FAIL'}`);
  }

  checkPairRank(68271, 9828, 'Afnan SNOI', 'Creed Aventus', 10);
  checkPairRank(68271, 44174, 'Afnan SNOI', 'Nishane Hacivat', 10);
  checkPairRank(108244, 84224, 'Afnan Turathi Electric', 'Ex Nihilo Blue Talisman', 10);
  checkPairRank(9828, 68271, 'Creed Aventus', 'Afnan SNOI', 20);
  checkPairRank(84224, 108244, 'Ex Nihilo Blue Talisman', 'Afnan Turathi Electric', 20);
}

runAblations().catch(console.error);
