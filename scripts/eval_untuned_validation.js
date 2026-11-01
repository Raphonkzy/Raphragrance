const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.db');
const splitData = JSON.parse(fs.readFileSync('data/eval_split.json', 'utf8'));

// Ground truth loader
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

  const adj = new Map();
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
      if (!adj.has(u)) adj.set(u, new Map());
      adj.get(u).set(v, symNet);

      if (!adj.has(v)) adj.set(v, new Map());
      adj.get(v).set(u, symNet);
    }
  }

  return adj;
}

// Canonical synonym dictionary
const canonicalNotes = new Map([
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
  ['ambroxan', 'ambergris'],
  ['ambrofix', 'ambergris'],
  ['cetalox', 'ambergris'],
  ['amber gris', 'ambergris'],
  ['ambergris', 'ambergris'],
  ['georgywood', 'cedar'],
  ['akigalawood', 'patchouli'],
  ['iso e super', 'woody notes'],
  ['woody notes', 'woody notes'],
  ['woodsy notes', 'woody notes'],
  ['woods', 'woody notes'],
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

function normalizeNote(raw) {
  let s = raw.toLowerCase().trim();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[-_]+/g, ' ');
  s = s.replace(/[^a-z0-9 ]/g, '').trim();
  s = s.replace(/\s+/g, ' ');
  if (canonicalNotes.has(s)) return canonicalNotes.get(s);
  return s;
}

const cloneBrands = new Set([
  'Afnan', 'Lattafa Perfumes', 'Lattafa', 'Armaf', 'Maison Alhambra',
  'Fragrance World', 'Paris Corner', 'Al Haramain Perfumes', 'Rasasi', 'Zara'
]);

async function runUntunedValidation() {
  console.log('Loading ground truth...');
  const gt = await loadGroundTruth();

  console.log('Loading SQLite perfumes...');
  const rows = db.prepare(`
    SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
    FROM perfumes
  `).all();

  const perfumes = new Map();
  const noteDocFreq = new Map();

  for (const r of rows) {
    let accords = [];
    if (r.accords) {
      accords = r.accords.split('|').filter(Boolean).map(p => {
        const [name, val] = p.split(':');
        return { name: (name || '').trim().toLowerCase(), strength: Number(val) || 0 };
      });
    }

    let centeredAccords = new Map();
    let accordNorm = 0;
    if (accords.length > 0) {
      const meanVal = accords.reduce((sum, a) => sum + a.strength, 0) / accords.length;
      for (const a of accords) {
        const centered = a.strength - meanVal;
        centeredAccords.set(a.name, centered);
        accordNorm += centered * centered;
      }
      accordNorm = Math.sqrt(accordNorm);
    }

    const topNotes = (r.notes_top || '').split('|').map(normalizeNote).filter(Boolean);
    const midNotes = (r.notes_middle || '').split('|').map(normalizeNote).filter(Boolean);
    const baseNotes = (r.notes_base || '').split('|').map(normalizeNote).filter(Boolean);
    const flatNotes = (r.notes_flat || '').split('|').map(normalizeNote).filter(Boolean);

    const hasPyramid = (topNotes.length + midNotes.length + baseNotes.length > 0);
    const isFlatOnly = !hasPyramid && flatNotes.length > 0;
    const isNoNotes = !hasPyramid && !isFlatOnly;

    const noteWeights = new Map();
    if (isFlatOnly) {
      for (const n of flatNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.0));
    } else {
      for (const n of topNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.0));
      for (const n of midNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.2));
      for (const n of baseNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.4));
    }

    for (const n of noteWeights.keys()) {
      noteDocFreq.set(n, (noteDocFreq.get(n) || 0) + 1);
    }

    perfumes.set(r.id, {
      id: r.id,
      name: r.name,
      brand: r.brand || '',
      vote_count: r.vote_count || 0,
      gender: r.gender || '',
      accords,
      centeredAccords,
      accordNorm,
      noteWeights,
      hasPyramid,
      isFlatOnly,
      isNoNotes,
      hasAccords: accords.length > 0
    });
  }

  const N = perfumes.size;
  const noteIDF = new Map();
  for (const [n, df] of noteDocFreq) {
    noteIDF.set(n, Math.log(1 + (N - df + 0.5) / (df + 0.5)));
  }

  const noteIndex = new Map();
  const accordIndex = new Map();

  for (const [id, p] of perfumes) {
    let norm = 0;
    for (const [n, w] of p.noteWeights) {
      const idf = noteIDF.get(n) || 1.0;
      const tfidf = w * idf;
      norm += tfidf * tfidf;
      if (!noteIndex.has(n)) noteIndex.set(n, []);
      noteIndex.get(n).push(id);
    }
    p.noteNorm = Math.sqrt(norm);

    for (const a of p.accords) {
      if (!accordIndex.has(a.name)) accordIndex.set(a.name, []);
      accordIndex.get(a.name).push(id);
    }
  }

  console.log('Engine ready. Evaluating VALIDATION set (1,000 perfumes) only...');

  function getRecs(targetId, topK = 10) {
    const target = perfumes.get(targetId);
    if (!target) return [];

    const candidateScores = new Map();
    for (const [n, w] of target.noteWeights) {
      const idf = noteIDF.get(n) || 1.0;
      const postings = noteIndex.get(n);
      if (!postings) continue;
      const qTerm = w * idf;
      for (let i = 0; i < postings.length; i++) {
        const cid = postings[i];
        if (cid === targetId) continue;
        candidateScores.set(cid, (candidateScores.get(cid) || 0) + qTerm);
      }
    }

    const topAcc = target.accords.slice(0, 3);
    for (const a of topAcc) {
      const postings = accordIndex.get(a.name);
      if (!postings) continue;
      for (let i = 0; i < postings.length; i++) {
        const cid = postings[i];
        if (cid === targetId) continue;
        candidateScores.set(cid, (candidateScores.get(cid) || 0) + 1.5);
      }
    }

    const pool = [];
    for (const [cid, rawScore] of candidateScores) {
      const cand = perfumes.get(cid);
      const norm = cand ? Math.max(1, cand.noteNorm) : 1;
      pool.push({ id: cid, score: rawScore / Math.sqrt(norm) });
    }
    pool.sort((a, b) => b.score - a.score);
    const topCand = pool.slice(0, 1500);

    const scored = [];
    const tAcc = target.centeredAccords;
    const tAccNorm = target.accordNorm;
    const tNoteNorm = target.noteNorm;

    for (const c of topCand) {
      const cand = perfumes.get(c.id);

      let noteDot = 0;
      for (const [n, w] of target.noteWeights) {
        if (cand.noteWeights.has(n)) {
          const idf = noteIDF.get(n) || 1.0;
          const candW = cand.noteWeights.get(n);
          noteDot += (w * idf) * (candW * idf);
        }
      }
      const noteSim = (tNoteNorm > 0 && cand.noteNorm > 0) ? (noteDot / (tNoteNorm * cand.noteNorm)) : 0;

      let accordSim = 0;
      if (target.hasAccords && cand.hasAccords && tAccNorm > 0 && cand.accordNorm > 0) {
        let accDot = 0;
        for (const [acc, zVal] of tAcc) {
          if (cand.centeredAccords.has(acc)) {
            accDot += zVal * cand.centeredAccords.get(acc);
          }
        }
        accordSim = accDot / (tAccNorm * cand.accordNorm);
        accordSim = Math.max(0, (accordSim + 1) / 2);
      } else {
        accordSim = noteSim;
      }

      const contentScore = (target.hasAccords && cand.hasAccords)
        ? (0.50 * noteSim + 0.50 * accordSim)
        : noteSim;

      const tieBreaker = Math.log10(Math.max(1, cand.vote_count)) * 1e-6;
      scored.push({ id: cand.id, score: contentScore + tieBreaker });
    }

    scored.sort((a, b) => b.score - a.score);

    const finalTop = [];
    const brandCount = new Map();
    for (const r of scored) {
      const cand = perfumes.get(r.id);
      const b = cand ? cand.brand : '';
      const count = brandCount.get(b) || 0;
      if (count < 2) {
        finalTop.push(r.id);
        brandCount.set(b, count + 1);
        if (finalTop.length >= topK) break;
      }
    }
    return finalTop;
  }

  // Vote terciles on validation set
  const valPerfumes = splitData.validation.map(id => perfumes.get(id)).filter(Boolean);
  const sortedVotes = [...valPerfumes].map(p => p.vote_count).sort((a, b) => a - b);
  const t1Vote = sortedVotes[Math.floor(sortedVotes.length / 3)];
  const t2Vote = sortedVotes[Math.floor(sortedVotes.length * 2 / 3)];

  console.log(`Validation Vote Terciles: T1 <= ${t1Vote}, T2 <= ${t2Vote}, T3 > ${t2Vote}`);

  function evalQueryMetrics(retrievedIds, qgt) {
    const isHit = retrievedIds.some(id => qgt.has(id)) ? 1 : 0;

    // TopGT Recall@10: Of the 3 strongest community neighbors by sym_net, how many appear in top 10?
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

  // Accumulators for overall & stratifications
  function createBucket() {
    return { n: 0, hit: 0, topGT: 0, prec: 0, mrr: 0, ndcg: 0 };
  }
  function addMetric(b, m) {
    b.n++;
    b.hit += m.isHit;
    b.topGT += m.topGTRecall;
    b.prec += m.precision;
    b.mrr += m.mrr;
    b.ndcg += m.ndcg;
  }
  function getAvg(b) {
    const n = b.n || 1;
    return {
      n: b.n,
      hit10: (b.hit / n) * 100,
      topGTRecall10: (b.topGT / n) * 100,
      prec10: (b.prec / n) * 100,
      mrr: (b.mrr / n),
      ndcg10: (b.ndcg / n) * 100
    };
  }

  const overall = createBucket();
  // (a) Data format
  const bPyramid = createBucket();
  const bFlatOnly = createBucket();
  const bNoAccords = createBucket();
  // (b) Vote terciles
  const bLowVote = createBucket();
  const bMidVote = createBucket();
  const bHighVote = createBucket();
  // (c) Clone vs Other brands
  const bCloneBrand = createBucket();
  const bOtherBrand = createBucket();

  let evaluated = 0;
  for (const qid of splitData.validation) {
    const p = perfumes.get(qid);
    if (!p) continue;
    const qgt = gt.get(qid);
    if (!qgt || qgt.size === 0) continue;

    evaluated++;
    const recs = getRecs(qid, 10);
    const m = evalQueryMetrics(recs, qgt);

    addMetric(overall, m);

    // Stratification (a)
    if (!p.hasAccords) addMetric(bNoAccords, m);
    else if (p.isFlatOnly) addMetric(bFlatOnly, m);
    else addMetric(bPyramid, m);

    // Stratification (b)
    if (p.vote_count <= t1Vote) addMetric(bLowVote, m);
    else if (p.vote_count <= t2Vote) addMetric(bMidVote, m);
    else addMetric(bHighVote, m);

    // Stratification (c)
    if (cloneBrands.has(p.brand)) addMetric(bCloneBrand, m);
    else addMetric(bOtherBrand, m);
  }

  console.log(`Evaluated ${evaluated} perfumes on Validation Set.\n`);

  function printMetrics(label, b) {
    const a = getAvg(b);
    console.log(`${label.padEnd(35)} (N = ${a.n.toString().padStart(4)}): TopGT-Rec@10: ${a.topGTRecall10.toFixed(2)}% | Hit@10: ${a.hit10.toFixed(2)}% | Prec@10: ${a.prec10.toFixed(2)}% | MRR: ${a.mrr.toFixed(4)} | nDCG@10: ${a.ndcg10.toFixed(2)}%`);
  }

  console.log('================================================================================');
  console.log('UNTUNED CONTENT ENGINE: VALIDATION SET RESULTS (MASKED GROUND TRUTH)');
  console.log('================================================================================');
  printMetrics('OVERALL VALIDATION SET', overall);

  console.log('\n--- (a) Stratification by Note & Accord Representation ---');
  printMetrics('1. Full Pyramid Notes + Accords', bPyramid);
  printMetrics('2. Flat-Only Notes + Accords', bFlatOnly);
  printMetrics('3. No Accords (Notes Only)', bNoAccords);

  console.log('\n--- (b) Stratification by Vote Count Terciles ---');
  printMetrics(`1. Low Votes (<= ${t1Vote})`, bLowVote);
  printMetrics(`2. Mid Votes (${t1Vote+1} - ${t2Vote})`, bMidVote);
  printMetrics(`3. High Votes (> ${t2Vote})`, bHighVote);

  console.log('\n--- (c) Stratification by Brand Type ---');
  printMetrics('1. Clone Houses (Afnan/Lattafa/etc.)', bCloneBrand);
  printMetrics('2. Other Houses (Designer & Niche)', bOtherBrand);
  console.log('================================================================================\n');

  // Check 15 Anchor Fragrances
  console.log('--- 15 ANCHOR FRAGRANCES ON UNTUNED CONTENT ENGINE (TOP 10) ---');
  const anchorIds = [
    { id: 9828, name: "Aventus", brand: "Creed" },
    { id: 31861, name: "Sauvage", brand: "Dior" },
    { id: 33519, name: "Baccarat Rouge 540", brand: "Maison Francis Kurkdjian" },
    { id: 12201, name: "Santal 33", brand: "Le Labo" },
    { id: 1825, name: "Tobacco Vanille", brand: "Tom Ford" },
    { id: 39314, name: "Layton", brand: "Parfums de Marly" },
    { id: 43871, name: "Delina", brand: "Parfums de Marly" },
    { id: 84224, name: "Blue Talisman", brand: "Ex Nihilo" },
    { id: 51411, name: "Lost Cherry", brand: "Tom Ford" },
    { id: 62615, name: "Angels' Share", brand: "By Kilian" },
    { id: 474, name: "Green Irish Tweed", brand: "Creed" },
    { id: 485, name: "Light Blue", brand: "Dolce&Gabbana" },
    { id: 30529, name: "XJ 1861 Naxos", brand: "Xerjoff" },
    { id: 50757, name: "Y Eau de Parfum", brand: "Yves Saint Laurent" },
    { id: 1849, name: "Tuscan Leather", brand: "Tom Ford" }
  ];

  let anchorMatches = 0;
  for (const a of anchorIds) {
    const qgt = gt.get(a.id);
    const recs = getRecs(a.id, 10);
    const m = evalQueryMetrics(recs, qgt);
    const matchCount = recs.filter(id => qgt.has(id)).length;
    anchorMatches += matchCount;
    console.log(`[ANCHOR] ${a.name.padEnd(23)} (${a.brand.padEnd(20)}): Overlap: ${matchCount}/10 | TopGT Rec: ${(m.topGTRecall * 100).toFixed(1)}% | Hit: ${m.isHit ? 'YES' : 'NO'}`);
  }
  console.log(`\nAverage Anchor Match: ${(anchorMatches / 15).toFixed(2)} / 10 (${((anchorMatches / 150) * 100).toFixed(1)}%)`);
}

runUntunedValidation().catch(console.error);
