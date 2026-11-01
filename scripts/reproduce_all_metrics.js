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

async function runMasterEvaluation() {
  console.log('=== RAPHRAGRANCE UNIFIED REPRODUCIBILITY EVALUATION ===\n');

  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.warn('Could not read git rev:', e.message);
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

  // 3. Catalog Coverage
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

  // 4. 30% Held-Out Edge Recovery Test
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

  // 5. 15 Anchor Fragrance Overlap
  const ANCHORS = [
    { id: 9828, name: "Aventus", brand: "Creed" },
    { id: 1418, name: "Bleu de Chanel", brand: "Chanel" },
    { id: 31861, name: "Sauvage", brand: "Dior" },
    { id: 39314, name: "Layton", brand: "Parfums de Marly" },
    { id: 33519, name: "Baccarat Rouge 540", brand: "Maison Francis Kurkdjian" },
    { id: 51411, name: "Lost Cherry", brand: "Tom Ford" },
    { id: 44174, name: "Hacivat", brand: "Nishane" },
    { id: 62615, name: "Angels' Share", brand: "By Kilian" },
    { id: 68271, name: "Supremacy Not Only Intense", brand: "Afnan" },
    { id: 1825, name: "Terre d'Hermes", brand: "Hermes" },
    { id: 84224, name: "Blue Talisman", brand: "Ex Nihilo" },
    { id: 108244, name: "Turathi Electric", brand: "Afnan" },
    { id: 50384, name: "Cloud", brand: "Ariana Grande" },
    { id: 53, name: "Kouros", brand: "Yves Saint Laurent" },
    { id: 43632, name: "Black Phantom", brand: "By Kilian" }
  ];

  let sumOldOverlap = 0;
  let sumContentOverlap = 0;
  const anchorDetails = [];

  for (const a of ANCHORS) {
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
    methodology: "Strict top-10 community neighbors (sym_net) overlap across 15 anchor perfumes",
    old_engine_avg: Number((sumOldOverlap / ANCHORS.length).toFixed(2)),
    content_only_avg: Number((sumContentOverlap / ANCHORS.length).toFixed(2)),
    headline_retraction: "Earlier claims of 5.0/10 and 4.4/10 evaluated against an unranked, loose bag of all community votes. Strict apples-to-apples top-10 community neighbor overlap is 0.6/10 (Old Engine) vs 1.2/10 (Content-Only).",
    details: anchorDetails
  };

  // 6. Curated Acceptance Cases Ranks
  const acceptancePairs = [
    { q: 68271, t: 9828, name: "SNOI -> Aventus" },
    { q: 68271, t: 44174, name: "SNOI -> Hacivat" },
    { q: 108244, t: 84224, name: "Turathi Electric -> Blue Talisman" },
    { q: 9828, t: 68271, name: "Aventus -> SNOI" },
    { q: 84224, t: 108244, name: "Blue Talisman -> Turathi Electric" }
  ];

  const stmtCuratedRecs = fullDb.prepare(`
    SELECT similar_id, rank, score, source
    FROM similar
    WHERE fragrance_id = ? AND source = 'curated'
    ORDER BY rank ASC
  `);

  const acceptanceStatus = acceptancePairs.map(p => {
    const cRows = stmtContentRecs.all(p.q).map(r => r.similar_id);
    const contentRank = cRows.indexOf(p.t) + 1;

    const curRows = stmtCuratedRecs.all(p.q).map(r => r.similar_id);
    const curatedRank = curRows.indexOf(p.t) + 1;

    return {
      pair: p.name,
      content_only_rank: contentRank > 0 ? `#${contentRank}` : '> 10',
      curated_rank: curatedRank > 0 ? `#${curatedRank}` : 'none',
      final_production_rank: curatedRank > 0 ? `#${curatedRank}` : (contentRank > 0 ? `#${contentRank}` : '> 10')
    };
  });

  const fullReport = {
    meta: {
      generated_at: new Date().toISOString(),
      git_commit: gitCommit,
      eval_split_sha256: splitHash,
      random_seeds: {
        bootstrap_seed: 42,
        held_out_seed: 42
      },
      evaluation_protocol: "Single unified frozen evaluation run. Test set was not tuned on; only final evaluation was rerun."
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
    coverage,
    held_out_30pct_test: heldOutTest,
    anchor_15_overlap: anchorOverlapSummary,
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
