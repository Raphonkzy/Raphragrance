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

async function runBootstrapEvaluations() {
  console.log('Loading ground truth and catalog...');
  const { adjFull, adjTop10 } = await loadGroundTruth();

  const rows = db.prepare(`
    SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
    FROM perfumes
  `).all();
  const numP = rows.length;

  // Precomputed note sets for MMR
  const perfumeNoteSetsDict = rows.map(r => {
    const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
    return new Set(all.split('|').map(normalizeNoteDict).filter(Boolean));
  });

  function getNoteJaccard(i1, i2) {
    const s1 = perfumeNoteSetsDict[i1];
    const s2 = perfumeNoteSetsDict[i2];
    if (s1.size === 0 || s2.size === 0) return 0;
    let inter = 0;
    for (const n of s1) if (s2.has(n)) inter++;
    return inter / (s1.size + s2.size - inter);
  }

  function buildIndex(noteNormalizer) {
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
      idToInternal,
      pData,
      noteIndex,
      accordIndex,
      pNorms,
      pAccNorms,
      pQueryNoteSums,
      pNoteArrays,
      pAccordArrays
    };
  }

  console.log('Building index Dict and Raw...');
  const idxDict = buildIndex(normalizeNoteDict);
  const idxRaw = buildIndex(normalizeNoteRaw);

  // Load learned NPMI note associations
  const npmiList = JSON.parse(fs.readFileSync('data/learned_note_npmi.json', 'utf8'));
  const npmiMap = new Map();
  for (const item of npmiList) {
    if (item.score >= 0.25) {
      const key = item.a < item.b ? `${item.a}|${item.b}` : `${item.b}|${item.a}`;
      npmiMap.set(key, item.score);
    }
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
      for (let k = 0; k < postings.length; k++) {
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
      for (let k = 0; k < postings.length; k++) {
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
      heap.push(cIdx, raw / Math.sqrt(Math.max(1, pNorms[cIdx])));
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
        if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) continue;
      } else if (config.genderMode === 'soft') {
        if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) {
          genderPenalty = config.genderPenalty || 0.08;
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

      let noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;
      const containmentQtoC = tQSum > 0 ? (sharedQ / tQSum) : 0;
      const containmentCtoQ = cQSum > 0 ? (sharedC / cQSum) : 0;

      // Soft cosine with NPMI if enabled
      if (config.useNpmi) {
        // add bonus for cross-note associations
        // scaled lightly
        let npmiBonus = 0;
        // evaluate pairs
      }

      let accordSim = 0;
      let top1AccMatch = 0;
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
        if (tAccords.ids.length > 0 && cAcc.ids.length > 0 && tAccords.ids[0] === cAcc.ids[0]) top1AccMatch = 1;
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
        const isClone = (config.useCloneFeature && cloneHouses.has(cand.brand)) ? 1.0 : 0.0;
        score = (
          config.weights.noteSim * noteSim +
          config.weights.containmentQtoC * containmentQtoC +
          config.weights.containmentCtoQ * containmentCtoQ +
          config.weights.accordSim * accordSim +
          config.weights.top1AccMatch * top1AccMatch +
          (config.useCloneFeature ? config.weights.isClone * isClone : 0.0)
        );
      }

      score -= genderPenalty;
      const tieBreaker = Math.log10(Math.max(1, cand.vote_count)) * 1e-6;
      scored.push({ id: cand.id, internalIdx: cIdx, brand: cand.brand, score: score + tieBreaker });
    }

    scored.sort((a, b) => b.score - a.score);

    // If MMR near-duplicate suppression is enabled
    if (config.useMMR) {
      const selected = [];
      const brandCount = new Map();
      const pool = scored.slice(0, 100);

      while (selected.length < topK && pool.length > 0) {
        let bestScore = -Infinity;
        let bestIdx = -1;

        for (let i = 0; i < pool.length; i++) {
          const item = pool[i];
          const bCnt = brandCount.get(item.brand) || 0;
          if (bCnt >= 2) continue; // enforce brand diversity cap

          let maxSim = 0;
          for (const s of selected) {
            const sim = getNoteJaccard(item.internalIdx, s.internalIdx);
            if (sim > maxSim) maxSim = sim;
          }

          // Penalize if note overlap with an already selected perfume exceeds threshold (e.g. >= 0.70)
          let penalty = (maxSim >= (config.mmrThreshold || 0.70)) ? (maxSim - (config.mmrThreshold || 0.70) + 0.1) * (config.mmrLambda || 0.35) : 0;
          const adjusted = item.score - penalty;

          if (adjusted > bestScore) {
            bestScore = adjusted;
            bestIdx = i;
          }
        }

        if (bestIdx >= 0) {
          const chosen = pool.splice(bestIdx, 1)[0];
          selected.push(chosen);
          brandCount.set(chosen.brand, (brandCount.get(chosen.brand) || 0) + 1);
        } else {
          break;
        }
      }
      return selected.map(s => s.id);
    }

    // Default brand cap selection
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

  // Precompute Old Baseline Engine results on Validation queries
  const stmtTarget = db.prepare("SELECT * FROM perfumes WHERE id = ?");
  const stmtOldCand1 = db.prepare("SELECT * FROM perfumes INDEXED BY idx_votes WHERE id != ? AND vote_count >= 15 AND accords LIKE ? AND accords LIKE ? LIMIT 60");
  const stmtOldCand2 = db.prepare("SELECT * FROM perfumes INDEXED BY idx_votes WHERE id != ? AND vote_count >= 25 AND accords LIKE ? LIMIT 40");

  function getOldBaselineRecs(target) {
    const tAcc = (target.accords || "").split("|").filter(Boolean).map(p => {
      const [name, val] = p.split(":");
      return { name: (name || "").trim().toLowerCase(), strength: Number(val) || 0 };
    });
    const a1 = tAcc[0] ? `%${tAcc[0].name}%` : null;
    const a2 = tAcc[1] ? `%${tAcc[1].name}%` : null;

    const tNotes = [target.notes_top, target.notes_middle, target.notes_base, target.notes_flat].filter(Boolean).join("|").toLowerCase().split("|").map(s=>s.trim()).filter(Boolean);

    const candMap = new Map();
    if (a1 && a2) {
      for (const r of stmtOldCand1.all(target.id, a1, a2)) if (r.vote_count >= 15) candMap.set(r.id, r);
    }
    if (candMap.size < 25 && a1) {
      for (const r of stmtOldCand2.all(target.id, a1)) if (r.vote_count >= 25) candMap.set(r.id, r);
    }

    const scored = Array.from(candMap.values()).map(cand => {
      const cNotes = [cand.notes_top, cand.notes_middle, cand.notes_base, cand.notes_flat].filter(Boolean).join("|").toLowerCase().split("|").map(s=>s.trim()).filter(Boolean);
      let shared = 0;
      tNotes.forEach(tn => {
        for (const cn of cNotes) {
          if (cn === tn || (cn.length > 4 && (tn.includes(cn) || cn.includes(tn)))) { shared++; break; }
        }
      });
      const totalU = new Set([...tNotes, ...cNotes]).size;
      const noteJaccard = totalU > 0 ? shared / totalU : 0;

      const cAcc = (cand.accords || "").split("|").filter(Boolean).map(p => {
        const [n, v] = p.split(":");
        return { name: (n||"").trim().toLowerCase(), strength: Number(v)||0 };
      });
      const cMap = new Map(cAcc.map(a => [a.name, a.strength]));
      let inter = 0, uni = 0;
      const allAcc = new Set([...tAcc.map(a => a.name), ...cMap.keys()]);
      allAcc.forEach(acc => {
        const w1 = tAcc.find(a => a.name === acc)?.strength || 0;
        const w2 = cMap.get(acc) || 0;
        inter += Math.min(w1, w2);
        uni += Math.max(w1, w2);
      });
      const accScore = uni > 0 ? inter / uni : 0;

      let gb = 0;
      if (target.gender && cand.gender) {
        gb = (target.gender === cand.gender || cand.gender === "unisex" || target.gender === "unisex") ? 0.10 : -0.15;
      }
      const vs = Math.min(Math.log10(Math.max(cand.vote_count || 1, 1)) / 4.2, 1) * 0.20;
      return { id: cand.id, score: (noteJaccard * 0.35) + (accScore * 0.35) + gb + vs };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map(s => s.id);
  }

  // Precompute per-query metric vectors for each system
  const valQueries = splitData.validation.filter(qid => adjFull.has(qid) && adjFull.get(qid).size > 0);
  const N = valQueries.length;
  console.log(`Evaluating on ${N} validation queries with Ground Truth...`);

  function evalQuery(recs, qgt) {
    const isHit = recs.some(id => qgt.has(id)) ? 1 : 0;
    const sortedGT = Array.from(qgt.entries()).sort((a, b) => b[1] - a[1]);
    const top3GT = sortedGT.slice(0, 3).map(e => e[0]);
    const top3Found = top3GT.filter(id => recs.includes(id)).length;
    const topGTRecall = top3GT.length > 0 ? (top3Found / top3GT.length) : 0;

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

    const precision = matchCount / 10;
    const mrr = firstRank > 0 ? (1 / firstRank) : 0;
    let idcg = 0;
    for (let i = 0; i < Math.min(10, sortedGT.length); i++) {
      idcg += sortedGT[i][1] / Math.log2(i + 2);
    }
    const ndcg = idcg > 0 ? (dcg / idcg) : 0;

    return { isHit, topGTRecall, precision, mrr, ndcg };
  }

  function collectQueryMetrics(getRecsFn) {
    const hits = new Float32Array(N);
    const recalls = new Float32Array(N);
    const precs = new Float32Array(N);
    const mrrs = new Float32Array(N);
    const ndcgs = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const qid = valQueries[i];
      const qgt = adjFull.get(qid);
      const recs = getRecsFn(qid);
      const m = evalQuery(recs, qgt);
      hits[i] = m.isHit;
      recalls[i] = m.topGTRecall;
      precs[i] = m.precision;
      mrrs[i] = m.mrr;
      ndcgs[i] = m.ndcg;
    }

    return { hits, recalls, precs, mrrs, ndcgs };
  }

  console.log('Precomputing metrics for all ablation variants...');

  // 1. Old Engine
  const mOld = collectQueryMetrics((qid) => {
    const target = stmtTarget.get(qid);
    return getOldBaselineRecs(target);
  });

  // 2. Untuned Raw (No Captives)
  const mUntunedRaw = collectQueryMetrics((qid) => {
    return runEngine(idxRaw, { mode: 'untuned', genderMode: 'none' }, qid);
  });

  // 3. Captive Dictionary
  const mCaptiveDict = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'untuned', genderMode: 'none' }, qid);
  });

  // 4. Asymmetric Containment
  const mContainment = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'containment', genderMode: 'none' }, qid);
  });

  // 5. Dynamic Accords
  const mDynamicAcc = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'dynamic_weighting', genderMode: 'none' }, qid);
  });

  // 6. Soft Gender
  const mSoftGender = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'dynamic_weighting', genderMode: 'soft', genderPenalty: 0.08 }, qid);
  });

  // 7. Hard Gender
  const mHardGender = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'dynamic_weighting', genderMode: 'hard' }, qid);
  });

  const ltrWeights = {
    noteSim: 0.35,
    containmentQtoC: 0.25,
    containmentCtoQ: 0.10,
    accordSim: 0.40,
    top1AccMatch: 0.05,
    isClone: 0.04
  };

  // 8. LTR with IsClone
  const mLTR_withClone = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'ltr', weights: ltrWeights, useCloneFeature: true, genderMode: 'soft', genderPenalty: 0.08 }, qid);
  });

  // 9. LTR without IsClone
  const mLTR_noClone = collectQueryMetrics((qid) => {
    return runEngine(idxDict, { mode: 'ltr', weights: ltrWeights, useCloneFeature: false, genderMode: 'soft', genderPenalty: 0.08 }, qid);
  });

  // 10. MMR / Near-Duplicate Suppression (Threshold 0.70, lambda 0.35)
  const mMMR = collectQueryMetrics((qid) => {
    return runEngine(idxDict, {
      mode: 'ltr',
      weights: ltrWeights,
      useCloneFeature: false,
      genderMode: 'soft',
      genderPenalty: 0.08,
      useMMR: true,
      mmrThreshold: 0.70,
      mmrLambda: 0.35
    }, qid);
  });

  console.log('Running 1,000 bootstrap resamples for 95% Confidence Intervals & Paired Hypothesis Tests...');

  // Bootstrap function
  const B = 1000;
  // Pre-generate bootstrap resample index matrix for paired comparison!
  // Same resample rows used across all systems so differences are paired per bootstrap sample!
  const resampleIndices = [];
  for (let b = 0; b < B; b++) {
    const idxs = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      idxs[i] = Math.floor(Math.random() * N);
    }
    resampleIndices.push(idxs);
  }

  function getBootstrapStats(sysM) {
    const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
    const ptHit = mean(sysM.hits);
    const ptRec = mean(sysM.recalls);
    const ptPrec = mean(sysM.precs);
    const ptMrr = mean(sysM.mrrs);
    const ptNdcg = mean(sysM.ndcgs);

    const bHit = new Float32Array(B);
    const bRec = new Float32Array(B);
    const bPrec = new Float32Array(B);
    const bMrr = new Float32Array(B);
    const bNdcg = new Float32Array(B);

    for (let b = 0; b < B; b++) {
      const idxs = resampleIndices[b];
      let sumH = 0, sumR = 0, sumP = 0, sumM = 0, sumN = 0;
      for (let i = 0; i < N; i++) {
        const idx = idxs[i];
        sumH += sysM.hits[idx];
        sumR += sysM.recalls[idx];
        sumP += sysM.precs[idx];
        sumM += sysM.mrrs[idx];
        sumN += sysM.ndcgs[idx];
      }
      bHit[b] = sumH / N;
      bRec[b] = sumR / N;
      bPrec[b] = sumP / N;
      bMrr[b] = sumM / N;
      bNdcg[b] = sumN / N;
    }

    const getCI = (arr) => {
      const s = Array.from(arr).sort((a, b) => a - b);
      const low = s[Math.floor(B * 0.025)];
      const high = s[Math.floor(B * 0.975)];
      return { low, high };
    };

    return {
      pt: { hit: ptHit, rec: ptRec, prec: ptPrec, mrr: ptMrr, ndcg: ptNdcg },
      ci: {
        hit: getCI(bHit),
        rec: getCI(bRec),
        prec: getCI(bPrec),
        mrr: getCI(bMrr),
        ndcg: getCI(bNdcg)
      },
      bootDist: { bHit, bRec, bPrec, bMrr, bNdcg }
    };
  }

  // Paired test: sysB vs sysA (is sysB significantly greater than sysA?)
  function getPairedPValue(distB, distA) {
    let countLessOrEqual = 0;
    for (let b = 0; b < B; b++) {
      if (distB[b] <= distA[b]) countLessOrEqual++;
    }
    // One-sided p-value
    return countLessOrEqual / B;
  }

  const systems = [
    { name: 'Old Baseline Engine', stats: getBootstrapStats(mOld) },
    { name: '0. Untuned Raw Notes', stats: getBootstrapStats(mUntunedRaw) },
    { name: '1. Captive Dictionary', stats: getBootstrapStats(mCaptiveDict) },
    { name: '2. + Asymmetric Containment', stats: getBootstrapStats(mContainment) },
    { name: '3. + Dynamic Accord Weighting', stats: getBootstrapStats(mDynamicAcc) },
    { name: '4. + Soft Gender Penalty', stats: getBootstrapStats(mSoftGender) },
    { name: '4b. Gender Hard Filter', stats: getBootstrapStats(mHardGender) },
    { name: '5a. LTR with IsClone', stats: getBootstrapStats(mLTR_withClone) },
    { name: '5b. LTR without IsClone', stats: getBootstrapStats(mLTR_noClone) },
    { name: '6. + MMR Near-Duplicate Supp.', stats: getBootstrapStats(mMMR) }
  ];

  console.log('\n========================================================================================================================');
  console.log('BOOTSTRAP 95% CONFIDENCE INTERVALS (VALIDATION SET N = 1,000, B = 1,000)');
  console.log('========================================================================================================================');
  console.log('System / Ablation                | TopGT-Recall@10 [95% CI]  | Hit@10 [95% CI]          | nDCG@10 [95% CI]');
  console.log('---------------------------------|---------------------------|--------------------------|-------------------------------');
  for (const s of systems) {
    const pt = s.stats.pt;
    const ci = s.stats.ci;
    const rStr = `${(pt.rec * 100).toFixed(2)}% [${(ci.rec.low * 100).toFixed(2)}-${(ci.rec.high * 100).toFixed(2)}]`;
    const hStr = `${(pt.hit * 100).toFixed(2)}% [${(ci.hit.low * 100).toFixed(2)}-${(ci.hit.high * 100).toFixed(2)}]`;
    const nStr = `${(pt.ndcg * 100).toFixed(2)}% [${(ci.ndcg.low * 100).toFixed(2)}-${(ci.ndcg.high * 100).toFixed(2)}]`;
    console.log(`${s.name.padEnd(32)} | ${rStr.padEnd(25)} | ${hStr.padEnd(24)} | ${nStr.padEnd(25)}`);
  }
  console.log('========================================================================================================================\n');

  console.log('=== PAIRED STATISTICAL SIGNIFICANCE TESTS (p-values) ===');
  console.log('1. Tuned LTR (without IsClone) vs Old Baseline Engine:');
  const ltrNoCloneStats = systems.find(s => s.name === '5b. LTR without IsClone').stats;
  const oldStats = systems.find(s => s.name === 'Old Baseline Engine').stats;
  console.log(`   TopGT Recall p-value: ${getPairedPValue(ltrNoCloneStats.bootDist.bRec, oldStats.bootDist.bRec).toFixed(4)} (Sig? ${getPairedPValue(ltrNoCloneStats.bootDist.bRec, oldStats.bootDist.bRec) < 0.05 ? 'YES (p < 0.05)' : 'NO'})`);
  console.log(`   Hit@10       p-value: ${getPairedPValue(ltrNoCloneStats.bootDist.bHit, oldStats.bootDist.bHit).toFixed(4)} (Sig? ${getPairedPValue(ltrNoCloneStats.bootDist.bHit, oldStats.bootDist.bHit) < 0.05 ? 'YES (p < 0.05)' : 'NO'})`);
  console.log(`   nDCG@10      p-value: ${getPairedPValue(ltrNoCloneStats.bootDist.bNdcg, oldStats.bootDist.bNdcg).toFixed(4)} (Sig? ${getPairedPValue(ltrNoCloneStats.bootDist.bNdcg, oldStats.bootDist.bNdcg) < 0.05 ? 'YES (p < 0.05)' : 'NO'})`);

  console.log('\n2. Incremental Ablation Steps (vs Previous Step):');
  for (let i = 2; i < systems.length; i++) {
    const prev = systems[i - 1];
    const curr = systems[i];
    const pRec = getPairedPValue(curr.stats.bootDist.bRec, prev.stats.bootDist.bRec);
    const pHit = getPairedPValue(curr.stats.bootDist.bHit, prev.stats.bootDist.bHit);
    const pNdcg = getPairedPValue(curr.stats.bootDist.bNdcg, prev.stats.bootDist.bNdcg);
    console.log(`   ${curr.name.padEnd(30)} vs ${prev.name}: TopGT p=${pRec.toFixed(3)}, Hit p=${pHit.toFixed(3)}, nDCG p=${pNdcg.toFixed(3)}`);
  }

  // Acceptance tests on LTR without isClone, and with MMR
  console.log('\n=== ACCEPTANCE CASES UNDER LTR WITHOUT ISCLONE & MMR ===');
  function checkCases(config, label) {
    console.log(`\n--- Config: ${label} ---`);
    const pairs = [
      { q: 68271, t: 9828, qN: 'SNOI', tN: 'Aventus', max: 10 },
      { q: 68271, t: 44174, qN: 'SNOI', tN: 'Hacivat', max: 10 },
      { q: 108244, t: 84224, qN: 'Turathi Electric', tN: 'Blue Talisman', max: 10 },
      { q: 9828, t: 68271, qN: 'Aventus', tN: 'SNOI', max: 20 },
      { q: 84224, t: 108244, qN: 'Blue Talisman', tN: 'Turathi Electric', max: 20 }
    ];
    for (const p of pairs) {
      const recs = runEngine(idxDict, config, p.q, 50, 400);
      const r = recs.indexOf(p.t) + 1;
      console.log(`   ${p.qN.padEnd(20)} -> ${p.tN.padEnd(22)}: Rank ${r > 0 ? ('#' + r).padStart(4) : 'NOT IN TOP 50'} (Target <= ${p.max}) | ${r > 0 && r <= p.max ? 'PASS' : 'FAIL'}`);
    }
  }

  checkCases({ mode: 'ltr', weights: ltrWeights, useCloneFeature: false, genderMode: 'soft', genderPenalty: 0.08 }, 'LTR without IsClone');
  checkCases({ mode: 'ltr', weights: ltrWeights, useCloneFeature: false, genderMode: 'soft', genderPenalty: 0.08, useMMR: true, mmrThreshold: 0.70, mmrLambda: 0.35 }, 'LTR without IsClone + MMR (0.70 threshold)');
}

runBootstrapEvaluations().catch(console.error);
