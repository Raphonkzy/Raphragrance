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

const cloneBrands = new Set([
  'Afnan', 'Lattafa Perfumes', 'Lattafa', 'Armaf', 'Maison Alhambra',
  'Fragrance World', 'Paris Corner', 'Al Haramain Perfumes', 'Rasasi', 'Zara'
]);

async function main() {
  console.log('Step 1: Loading ground truth...');
  const gt = await loadGroundTruth();

  console.log('Step 2: Loading SQLite database...');
  const rows = db.prepare(`
    SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
    FROM perfumes
  `).all();

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

  const numP = rows.length;
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
  const pNoteArrays = [];
  const pAccordArrays = [];

  for (let i = 0; i < numP; i++) {
    const p = pData[i];
    idToInternal.set(p.id, i);

    // Sort notes by ID for linear merge
    const nEntries = Array.from(p.noteMap.entries()).sort((a, b) => a[0] - b[0]);
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
      noteIndex[nid].push(i);
    }
    pNorms[i] = Math.sqrt(nNorm);
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

  console.log(`Structures ready. Notes: ${numNotes}, Accords: ${numAccords}.`);

  const candScores = new Float32Array(numP);
  const touchedCands = new Int32Array(numP);

  function fastGetRecs(targetDbId, topK = 10, candidateLimit = 300) {
    const tIdx = idToInternal.get(targetDbId);
    if (tIdx === undefined) return [];

    const tNotes = pNoteArrays[tIdx];
    const tNorm = pNorms[tIdx];
    const tAccords = pAccordArrays[tIdx];
    const tAccNorm = pAccNorms[tIdx];
    const tHasAcc = pData[tIdx].hasAccords;

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

    const pool = [];
    for (let i = 0; i < touchedCount; i++) {
      const cIdx = touchedCands[i];
      const raw = candScores[cIdx];
      candScores[cIdx] = 0;
      const cNorm = Math.max(1, pNorms[cIdx]);
      pool.push({ idx: cIdx, rough: raw / Math.sqrt(cNorm) });
    }

    pool.sort((a, b) => b.rough - a.rough);
    const evalCount = Math.min(candidateLimit, pool.length);

    const scored = [];
    for (let i = 0; i < evalCount; i++) {
      const cIdx = pool[i].idx;
      const cNotes = pNoteArrays[cIdx];
      const cNorm = pNorms[cIdx];
      const cAcc = pAccordArrays[cIdx];
      const cAccNorm = pAccNorms[cIdx];
      const cHasAcc = pData[cIdx].hasAccords;

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

  // Vote terciles on validation set
  const valPerfumes = splitData.validation.map(id => pData[idToInternal.get(id)]).filter(Boolean);
  const sortedVotes = [...valPerfumes].map(p => p.vote_count).sort((a, b) => a - b);
  const t1Vote = sortedVotes[Math.floor(sortedVotes.length / 3)];
  const t2Vote = sortedVotes[Math.floor(sortedVotes.length * 2 / 3)];

  console.log(`Validation Vote Terciles: T1 <= ${t1Vote}, T2 <= ${t2Vote}, T3 > ${t2Vote}`);

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

  function createBucket() { return { n: 0, hit: 0, topGT: 0, prec: 0, mrr: 0, ndcg: 0 }; }
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
  const bPyramid = createBucket();
  const bFlatOnly = createBucket();
  const bNoAccords = createBucket();
  const bLowVote = createBucket();
  const bMidVote = createBucket();
  const bHighVote = createBucket();
  const bCloneBrand = createBucket();
  const bOtherBrand = createBucket();

  console.log('Evaluating 1,000 Validation Perfumes (Strictly Masked Content-Only)...');
  const tEvalStart = Date.now();

  for (let q = 0; q < splitData.validation.length; q++) {
    const qid = splitData.validation[q];
    const pIdx = idToInternal.get(qid);
    if (pIdx === undefined) continue;
    const p = pData[pIdx];
    const qgt = gt.get(qid);
    if (!qgt || qgt.size === 0) continue;

    const recs = fastGetRecs(qid, 10, 300);
    const m = evalQueryMetrics(recs, qgt);

    addMetric(overall, m);

    if (!p.hasAccords) addMetric(bNoAccords, m);
    else if (p.isFlatOnly) addMetric(bFlatOnly, m);
    else addMetric(bPyramid, m);

    if (p.vote_count <= t1Vote) addMetric(bLowVote, m);
    else if (p.vote_count <= t2Vote) addMetric(bMidVote, m);
    else addMetric(bHighVote, m);

    if (cloneBrands.has(p.brand)) addMetric(bCloneBrand, m);
    else addMetric(bOtherBrand, m);
  }

  console.log(`Evaluated ${overall.n} queries in ${((Date.now() - tEvalStart)/1000).toFixed(1)}s.\n`);

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

  // Check 15 Anchors
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
    const recs = fastGetRecs(a.id, 10, 300);
    const m = evalQueryMetrics(recs, qgt);
    const matchCount = recs.filter(id => qgt.has(id)).length;
    anchorMatches += matchCount;
    console.log(`[ANCHOR] ${a.name.padEnd(23)} (${a.brand.padEnd(20)}): Overlap: ${matchCount}/10 | TopGT Rec: ${(m.topGTRecall * 100).toFixed(1)}% | Hit: ${m.isHit ? 'YES' : 'NO'}`);
  }
  console.log(`\nAverage Anchor Match: ${(anchorMatches / 15).toFixed(2)} / 10 (${((anchorMatches / 150) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
