const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteDict
} = require('./ablation_common');

function bootstrapMetric(values, B = 1000, seed = 42) {
  function makePrng(s) {
    let state = s % 2147483647;
    if (state <= 0) state += 2147483646;
    return function() {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }
  const rng = makePrng(seed);
  const n = values.length;
  const means = new Float64Array(B);

  for (let b = 0; b < B; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += values[(rng() * n) | 0];
    }
    means[b] = sum / n;
  }

  means.sort();
  const low = means[Math.floor(B * 0.025)];
  const high = means[Math.floor(B * 0.975)];
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  return { mean, ci95: [low, high] };
}

// Full candidate ranking helper to determine REAL content-only integer rank
function buildCandidateIndex() {
  const rows = db.prepare(`
    SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
    FROM perfumes
  `).all();
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

  const noteIndex = Array.from({ length: numNotes }, () => []);
  const accordIndex = Array.from({ length: accordToId.size }, () => []);

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
      }
      pAccNorms[i] = Math.sqrt(aNorm);
      pAccordArrays.push({ ids: aIds, vals: aVals });
      for (let j = 0; j < Math.min(3, aCount); j++) {
        accordIndex[aEntries[j].id].push(i);
      }
    } else {
      pAccNorms[i] = 0;
      pAccordArrays.push({ ids: new Int32Array(0), vals: new Float32Array(0) });
    }
  }

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

  const candScores = new Float32Array(numP);
  const touchedCands = new Int32Array(numP);

  function getFullCandidateRanking(qid, candLimit = 250) {
    const tIdx = idToInternal.get(qid);
    if (tIdx === undefined) return { ranked: [], candidateIds: new Set() };

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
      const rough = candScores[cIdx] / Math.sqrt(Math.max(1, pNorms[cIdx]));
      heap.push(cIdx, rough);
      candScores[cIdx] = 0;
    }

    const candidates = heap.heap;
    const candidateIds = new Set(candidates.map(c => pData[c.idx].id));
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
      if ((tGender === 'male' && cGender === 'female') || (tGender === 'female' && cGender === 'male')) {
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

      const score = (
        0.35 * noteSim +
        0.25 * containmentQtoC +
        0.10 * containmentCtoQ +
        0.40 * accordSim +
        0.05 * top1Match -
        genderPenalty +
        (Math.log10(Math.max(1, cand.vote_count)) * 1e-6)
      );

      scored.push({ id: cand.id, brand: cand.brand, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const ranked = [];
    const brandCount = new Map();
    for (const s of scored) {
      const cnt = brandCount.get(s.brand) || 0;
      if (cnt < 2) {
        ranked.push(s.id);
        brandCount.set(s.brand, cnt + 1);
      }
    }

    return { ranked, candidateIds };
  }

  return { getFullCandidateRanking };
}

async function runMasterEvaluation() {
  console.log('=== RAPHRAGRANCE UNIFIED REPRODUCIBILITY EVALUATION ===\n');

  let gitCommit = 'unknown';
  let isDirty = true;
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    isDirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
  } catch (e) {
    console.warn('Could not read git status:', e.message);
  }

  const splitJsonRaw = fs.readFileSync('data/eval_split.json', 'utf8');
  const splitHash = crypto.createHash('sha256').update(splitJsonRaw).digest('hex');

  const { adjFull } = await loadGroundTruth();

  const fullDb = new DatabaseSync('data/perfumes.full.db');
  const publicDb = new DatabaseSync('data/perfumes.public.db');

  const stmtTarget = fullDb.prepare('SELECT * FROM perfumes WHERE id = ?');
  const stmtOldCand1 = fullDb.prepare("SELECT * FROM perfumes INDEXED BY idx_perfumes_votes WHERE id != ? AND vote_count >= 15 AND accords LIKE ? AND accords LIKE ? LIMIT 60");
  const stmtOldCand2 = fullDb.prepare("SELECT * FROM perfumes INDEXED BY idx_perfumes_votes WHERE id != ? AND vote_count >= 25 AND accords LIKE ? LIMIT 40");

  function getOldBaselineRecs(target) {
    if (!target) return [];
    const tAcc = (target.accords || "").split("|").filter(Boolean).map(p => {
      const [name, val] = p.split(":");
      return { name: (name || "").trim().toLowerCase(), strength: Number(val) || 0 };
    });
    const a1 = tAcc[0] ? `%${tAcc[0].name}%` : null;
    const a2 = tAcc[1] ? `%${tAcc[1].name}%` : null;

    const tNotes = [target.notes_top, target.notes_middle, target.notes_base, target.notes_flat]
      .filter(Boolean).join("|").toLowerCase().split("|").map(s => s.trim()).filter(Boolean);

    const candMap = new Map();
    if (a1 && a2) {
      for (const r of stmtOldCand1.all(target.id, a1, a2)) if (r.vote_count >= 15) candMap.set(r.id, r);
    }
    if (candMap.size < 25 && a1) {
      for (const r of stmtOldCand2.all(target.id, a1)) if (r.vote_count >= 25) candMap.set(r.id, r);
    }

    const scored = Array.from(candMap.values()).map(cand => {
      const cNotes = [cand.notes_top, cand.notes_middle, cand.notes_base, cand.notes_flat]
        .filter(Boolean).join("|").toLowerCase().split("|").map(s => s.trim()).filter(Boolean);
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
        return { name: (n || "").trim().toLowerCase(), strength: Number(v) || 0 };
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
      const score = (noteJaccard * 0.35) + (accScore * 0.35) + gb + vs;
      return { id: cand.id, brand: cand.brand, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const finalTop = [];
    const brandCount = new Map();
    for (const s of scored) {
      const cnt = brandCount.get(s.brand) || 0;
      if (cnt < 2) {
        finalTop.push(s.id);
        brandCount.set(s.brand, cnt + 1);
        if (finalTop.length >= 10) break;
      }
    }
    return finalTop;
  }

  const stmtContentRecs = publicDb.prepare(`
    SELECT similar_id FROM similar
    WHERE fragrance_id = ? AND source = 'content'
    ORDER BY rank ASC LIMIT 10
  `);

  function getContentRecs(qid) {
    return stmtContentRecs.all(qid).map(r => r.similar_id);
  }

  function evaluateSet(queryIds, label) {
    const validQueries = queryIds.filter(qid => adjFull.has(qid) && adjFull.get(qid).size > 0);
    const N = validQueries.length;
    console.log(`Evaluating ${label}: ${N} active queries with ground truth...`);

    function runCollector(getRecsFn) {
      const hit10 = new Float64Array(N);
      const topGT = new Float64Array(N);
      const prec10 = new Float64Array(N);
      const mrr = new Float64Array(N);
      const ndcg10 = new Float64Array(N);

      for (let i = 0; i < N; i++) {
        const qid = validQueries[i];
        const qgt = adjFull.get(qid);
        const recs = getRecsFn(qid);

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
        const mrrVal = firstRank > 0 ? (1 / firstRank) : 0;

        let idcg = 0;
        for (let j = 0; j < Math.min(10, sortedGT.length); j++) {
          idcg += sortedGT[j][1] / Math.log2(j + 2);
        }
        const ndcgVal = idcg > 0 ? (dcg / idcg) : 0;

        hit10[i] = isHit * 100;
        topGT[i] = topGTRecall * 100;
        prec10[i] = precision * 100;
        mrr[i] = mrrVal;
        ndcg10[i] = ndcgVal * 100;
      }

      return {
        hit10: bootstrapMetric(hit10),
        topGT: bootstrapMetric(topGT),
        prec10: bootstrapMetric(prec10),
        mrr: bootstrapMetric(mrr),
        ndcg10: bootstrapMetric(ndcg10)
      };
    }

    const oldMetrics = runCollector(qid => {
      const target = stmtTarget.get(qid);
      return getOldBaselineRecs(target);
    });

    const contentMetrics = runCollector(qid => getContentRecs(qid));

    return { oldMetrics, contentMetrics };
  }

  // 1. Validation Set Evaluation
  const valResults = evaluateSet(splitData.validation, 'Validation Set');

  // 2. Test Set Evaluation
  const testResults = evaluateSet(splitData.test, 'Test Set');

  // 3. Five Original Target Evaluation (Gate 1.5)
  // Targets: TopGT-Rec@10 >= 20.00%, Hit@10 >= 50.00%, Prec@10 >= 9.00%, MRR >= 0.35, nDCG@10 >= 18.00%
  const targetsDef = [
    { name: "TopGT Recall@10", key: "topGT", target: 20.00, isPct: true },
    { name: "Hit@10", key: "hit10", target: 50.00, isPct: true },
    { name: "Precision@10", key: "prec10", target: 9.00, isPct: true },
    { name: "MRR", key: "mrr", target: 0.35, isPct: false },
    { name: "nDCG@10", key: "ndcg10", target: 18.00, isPct: true }
  ];

  const targetStatus = targetsDef.map(t => {
    const metric = testResults.contentMetrics[t.key];
    const mean = Number(metric.mean.toFixed(t.isPct ? 2 : 4));
    const ci95 = [Number(metric.ci95[0].toFixed(t.isPct ? 2 : 4)), Number(metric.ci95[1].toFixed(t.isPct ? 2 : 4))];
    const passes = mean >= t.target;
    return {
      metric: t.name,
      target_threshold: t.isPct ? `>= ${t.target}%` : `>= ${t.target}`,
      measured_mean: t.isPct ? `${mean}%` : `${mean}`,
      ci95: t.isPct ? `[${ci95[0]}%, ${ci95[1]}%]` : `[${ci95[0]}, ${ci95[1]}]`,
      status: passes ? "PASS" : "FAIL"
    };
  });

  // 4. Catalog Coverage
  console.log('Calculating Catalog Coverage...');
  const totalFragrances = fullDb.prepare('SELECT COUNT(*) as c FROM perfumes').get().c;
  
  const commCounts = fullDb.prepare(`
    SELECT fragrance_id, COUNT(*) as c
    FROM similar
    WHERE source = 'community' AND rank <= 10
    GROUP BY fragrance_id
  `).all();

  let ge1 = 0, ge5 = 0, ge10 = 0;
  for (const r of commCounts) {
    if (r.c >= 1) ge1++;
    if (r.c >= 5) ge5++;
    if (r.c >= 10) ge10++;
  }

  const breakdown = fullDb.prepare(`
    SELECT source, COUNT(*) as c
    FROM similar
    WHERE rank <= 10
    GROUP BY source
  `).all();

  let totalCommSlots = 0, totalContentSlots = 0, totalCuratedSlots = 0;
  for (const b of breakdown) {
    if (b.source === 'community') totalCommSlots = b.c;
    else if (b.source === 'content') totalContentSlots = b.c;
    else if (b.source === 'curated') totalCuratedSlots = b.c;
  }

  const totalSlots = totalCommSlots + totalContentSlots + totalCuratedSlots;
  const coverage = {
    total_fragrances: totalFragrances,
    ge1_community_share: { count: ge1, pct: (ge1 / totalFragrances) * 100 },
    ge5_community_share: { count: ge5, pct: (ge5 / totalFragrances) * 100 },
    ge10_community_share: { count: ge10, pct: (ge10 / totalFragrances) * 100 },
    top10_slot_distribution: {
      community: { count: totalCommSlots, pct: (totalCommSlots / totalSlots) * 100 },
      content: { count: totalContentSlots, pct: (totalContentSlots / totalSlots) * 100 },
      curated: { count: totalCuratedSlots, pct: (totalCuratedSlots / totalSlots) * 100 }
    }
  };

  // 5. 30% Held-Out Edge Recovery Test
  console.log('Calculating Held-Out 30% Edge Recovery on Test Set...');
  function makePrng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  const rngHeld = makePrng(42);
  const stmtDbComm = fullDb.prepare(`
    SELECT similar_id FROM similar WHERE fragrance_id = ? AND source = 'community' ORDER BY rank ASC
  `);
  const stmtDbContentAll = fullDb.prepare(`
    SELECT similar_id FROM similar WHERE fragrance_id = ? AND source = 'content' ORDER BY rank ASC LIMIT 20
  `);

  let commTestQueries = 0;
  let totalHeldOutEdges = 0;
  let contentRecovered = 0;
  let hybridRecovered = 0;

  const validTestQueries = splitData.test.filter(qid => adjFull.has(qid) && adjFull.get(qid).size > 0);
  for (const qid of validTestQueries) {
    const commRows = stmtDbComm.all(qid);
    if (commRows.length < 2) continue;

    commTestQueries++;
    const edges = commRows.map(r => r.similar_id);
    const shuffled = [...edges];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rngHeld() * (i + 1));
      const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }

    const nHeldOut = Math.max(1, Math.round(shuffled.length * 0.30));
    const heldOutSet = new Set(shuffled.slice(0, nHeldOut));
    const visibleSet = shuffled.slice(nHeldOut);
    totalHeldOutEdges += heldOutSet.size;

    const contentTop10 = stmtDbContentAll.all(qid).slice(0, 10).map(r => r.similar_id);
    for (const id of contentTop10) {
      if (heldOutSet.has(id)) contentRecovered++;
    }

    const hybridTop10 = [];
    const hybridSeen = new Set([qid]);
    for (const id of visibleSet) {
      hybridTop10.push(id);
      hybridSeen.add(id);
      if (hybridTop10.length >= 10) break;
    }
    for (const r of stmtDbContentAll.all(qid)) {
      if (!hybridSeen.has(r.similar_id)) {
        hybridTop10.push(r.similar_id);
        hybridSeen.add(r.similar_id);
        if (hybridTop10.length >= 10) break;
      }
    }
    for (const id of hybridTop10) {
      if (heldOutSet.has(id)) hybridRecovered++;
    }
  }

  const heldOutTest = {
    test_queries_with_community_edges: commTestQueries,
    total_held_out_edges: totalHeldOutEdges,
    content_only: {
      recovered_count: contentRecovered,
      recall_pct: (contentRecovered / totalHeldOutEdges) * 100
    },
    hybrid_masked: {
      recovered_count: hybridRecovered,
      recall_pct: (hybridRecovered / totalHeldOutEdges) * 100
    }
  };

  // 6. Verified 19 Anchor Overlap (Gate 1.1: loaded from data/anchors.json with DB lookup)
  console.log('Calculating Overlap across Verified Anchors from data/anchors.json...');
  const anchorsJson = JSON.parse(fs.readFileSync('data/anchors.json', 'utf8'));
  const anchorStmt = fullDb.prepare("SELECT id, name, brand FROM perfumes WHERE id = ?");

  let sumOldOverlap = 0;
  let sumContentOverlap = 0;
  const anchorDetails = [];

  for (const item of anchorsJson) {
    const a = anchorStmt.get(item.id);
    if (!a) throw new Error(`Anchor ID ${item.id} not found in database!`);

    const qgt = adjFull.get(a.id) || new Map();
    const sortedGT = Array.from(qgt.entries()).sort((x, y) => y[1] - x[1]);
    const top10GT = new Set(sortedGT.slice(0, 10).map(e => e[0]));

    const targetRow = stmtTarget.get(a.id);
    const oldRecs = targetRow ? getOldBaselineRecs(targetRow) : [];
    const contentRecs = getContentRecs(a.id);

    const oldMatch = oldRecs.filter(id => top10GT.has(id)).length;
    const contentMatch = contentRecs.filter(id => top10GT.has(id)).length;

    sumOldOverlap += oldMatch;
    sumContentOverlap += contentMatch;

    anchorDetails.push({
      id: a.id,
      name: a.name,
      brand: a.brand,
      gt_top10_count: top10GT.size,
      old_overlap: `${oldMatch}/10`,
      content_overlap: `${contentMatch}/10`
    });
  }

  const anchorOverlapSummary = {
    methodology: `Strict top-10 community neighbors (sym_net) overlap across ${anchorsJson.length} verified anchor perfumes from data/anchors.json`,
    total_anchors: anchorsJson.length,
    old_engine_avg: Number((sumOldOverlap / anchorsJson.length).toFixed(2)),
    content_only_avg: Number((sumContentOverlap / anchorsJson.length).toFixed(2)),
    content_only_top10_overlap_mean: `${(sumContentOverlap / anchorsJson.length).toFixed(2)}/10`,
    details: anchorDetails
  };

  // 7. Acceptance Cases: Real integer ranks from full candidate ranking (Gate 1.4 & 1.6)
  console.log('Calculating Real Content Ranks for Acceptance Cases from data/acceptance_cases.json...');
  const { getFullCandidateRanking } = buildCandidateIndex();

  const acceptanceCasesJson = JSON.parse(fs.readFileSync('data/acceptance_cases.json', 'utf8'));
  const slugStmt = fullDb.prepare('SELECT id, name, brand, slug FROM perfumes WHERE slug = ?');

  const acceptancePairs = acceptanceCasesJson.map(c => {
    const qRow = slugStmt.get(c.query_slug);
    const tRow = slugStmt.get(c.target_slug);
    if (!qRow) throw new Error(`Query slug not found in DB: ${c.query_slug}`);
    if (!tRow) throw new Error(`Target slug not found in DB: ${c.target_slug}`);
    return {
      query_slug: c.query_slug,
      target_slug: c.target_slug,
      kind: c.kind,
      q: qRow.id,
      t: tRow.id,
      name: `${qRow.name} -> ${tRow.name}`
    };
  });

  const stmtCuratedRecs = fullDb.prepare(`
    SELECT similar_id, rank, score, source
    FROM similar
    WHERE fragrance_id = ? AND source = 'curated'
    ORDER BY rank ASC
  `);

  const retrievalPoolSize = 250;
  const acceptanceStatus = acceptancePairs.map(p => {
    // 1. Exact candidate ranking (top 250 retrieval pool)
    const { ranked, candidateIds } = getFullCandidateRanking(p.q, retrievalPoolSize);
    const inCandidates = candidateIds.has(p.t);
    const contentRankIdx = ranked.indexOf(p.t);
    const realContentRank = inCandidates
      ? (contentRankIdx !== -1 ? contentRankIdx + 1 : `not retrieved (pool: ${retrievalPoolSize})`)
      : `not retrieved (pool: ${retrievalPoolSize})`;

    // 2. Curated rank from similar table
    const curRows = stmtCuratedRecs.all(p.q).map(r => r.similar_id);
    const curIdx = curRows.indexOf(p.t);
    const curatedRank = curIdx !== -1 ? curIdx + 1 : null;

    // 3. Final production rank
    let finalRank = null;
    if (curatedRank !== null) {
      finalRank = curatedRank;
    } else if (typeof realContentRank === 'number' && realContentRank <= 30) {
      finalRank = realContentRank;
    }

    const passesTop10Final = finalRank !== null && finalRank <= 10;
    const passesTop10Content = typeof realContentRank === 'number' && realContentRank <= 10;
    const passesOnlyBecauseCurated = passesTop10Final && !passesTop10Content;

    return {
      pair: p.name,
      query_slug: p.query_slug,
      target_slug: p.target_slug,
      kind: p.kind,
      query_id: p.q,
      target_id: p.t,
      content_only_candidate_rank: typeof realContentRank === 'number' ? `#${realContentRank}` : realContentRank,
      curated_rank: curatedRank !== null ? `#${curatedRank}` : "none",
      final_production_rank: finalRank !== null ? `#${finalRank}` : "> 30",
      passes_top10: passesTop10Final,
      passes_only_because_of_curated: passesOnlyBecauseCurated
    };
  });

  const fullReport = {
    meta: {
      generated_at: new Date().toISOString(),
      git_commit: gitCommit,
      dirty: isDirty,
      eval_split_sha256: splitHash,
      random_seeds: {
        bootstrap_seed: 42,
        held_out_seed: 42
      },
      evaluation_protocol: "Single unified frozen evaluation run. Test set was not tuned on; only final evaluation was rerun.",
      baseline_definition: {
        commit: "d200118e7a524bc8c0bdf483b22ffd012a34c2f3",
        repository: "D:/Raffa/Mengoding/Raphragrance",
        description: "Original baseline engine: candidate retrieval via SQLite LIKE on top-2 accords (60+40 candidates, min vote_count 15/25), note Jaccard similarity (0.35) + accord intersection/union (0.35) + gender bias (0.10/-0.15) + vote score (0.20) with brand cap 2."
      }
    },
    engine_configuration: {
      note_normalizer: "normalizeNoteDict (Captive Dictionary included for canonicalization)",
      weights: {
        noteSim: 0.35,
        containmentQtoC: 0.25,
        containmentCtoQ: 0.10,
        accordSim: 0.40,
        top1AccordMatch: 0.05,
        isClone: 0.00
      },
      gender_penalty: 0.08,
      dynamic_accords_branch: false,
      candidate_retrieval_limit: 250,
      brand_diversity_cap: 2,
      precomputed_top_k: 30
    },
    target_status: targetStatus,
    coverage,
    held_out_30pct_test: heldOutTest,
    anchor_19_overlap: anchorOverlapSummary,
    acceptance_cases: acceptanceStatus,
    validation_metrics: {
      num_queries: splitData.validation.filter(qid => adjFull.has(qid) && adjFull.get(qid).size > 0).length,
      old_baseline: {
        hit10: valResults.oldMetrics.hit10,
        topGT: valResults.oldMetrics.topGT,
        prec10: valResults.oldMetrics.prec10,
        mrr: valResults.oldMetrics.mrr,
        ndcg10: valResults.oldMetrics.ndcg10
      },
      content_only: {
        hit10: valResults.contentMetrics.hit10,
        topGT: valResults.contentMetrics.topGT,
        prec10: valResults.contentMetrics.prec10,
        mrr: valResults.contentMetrics.mrr,
        ndcg10: valResults.contentMetrics.ndcg10
      }
    },
    test_metrics: {
      num_queries: validTestQueries.length,
      old_baseline: {
        hit10: testResults.oldMetrics.hit10,
        topGT: testResults.oldMetrics.topGT,
        prec10: testResults.oldMetrics.prec10,
        mrr: testResults.oldMetrics.mrr,
        ndcg10: testResults.oldMetrics.ndcg10
      },
      content_only: {
        hit10: testResults.contentMetrics.hit10,
        topGT: testResults.contentMetrics.topGT,
        prec10: testResults.contentMetrics.prec10,
        mrr: testResults.contentMetrics.mrr,
        ndcg10: testResults.contentMetrics.ndcg10
      }
    }
  };

  fs.writeFileSync('reports/similarity-results.json', JSON.stringify(fullReport, null, 2));
  console.log('\n✓ Successfully generated and froze reports/similarity-results.json');

  fullDb.close();
  publicDb.close();
}

runMasterEvaluation().catch(console.error);
