const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.db');

// Load split
const splitData = JSON.parse(fs.readFileSync('data/eval_split.json', 'utf8'));

// Build ground truth map: id -> Map(neighborId -> symNet)
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

// Prepare cached statements for speed
const stmtTarget = db.prepare("SELECT * FROM perfumes WHERE id = ?");
const stmtBaseline3 = db.prepare(`
  SELECT id FROM perfumes
  WHERE id != ? AND accords LIKE ? AND accords LIKE ? AND accords LIKE ?
  ORDER BY vote_count DESC LIMIT 10
`);
const stmtBaseline2 = db.prepare(`
  SELECT id FROM perfumes
  WHERE id != ? AND accords LIKE ? AND accords LIKE ?
  ORDER BY vote_count DESC LIMIT 10
`);

function getBaseline1(target) {
  const targetAccords = (target.accords || "").split("|").filter(Boolean).map(p => p.split(":")[0].trim().toLowerCase());
  const a1 = targetAccords[0] ? `%${targetAccords[0]}%` : null;
  const a2 = targetAccords[1] ? `%${targetAccords[1]}%` : null;
  const a3 = targetAccords[2] ? `%${targetAccords[2]}%` : null;

  let rows = [];
  if (a1 && a2 && a3) {
    rows = stmtBaseline3.all(target.id, a1, a2, a3);
  }
  if (rows.length < 10 && a1 && a2) {
    const more = stmtBaseline2.all(target.id, a1, a2);
    const existingIds = new Set(rows.map(r => r.id));
    for (const r of more) {
      if (!existingIds.has(r.id)) {
        rows.push(r);
        if (rows.length >= 10) break;
      }
    }
  }
  return rows.map(r => r.id);
}

// Current/Old scoring engine
const stmtOldCand1 = db.prepare(`
  SELECT * FROM perfumes
  INDEXED BY idx_votes
  WHERE id != ? AND vote_count >= 15 AND accords LIKE ? AND accords LIKE ?
  LIMIT 60
`);
const stmtOldCand2 = db.prepare(`
  SELECT * FROM perfumes
  INDEXED BY idx_votes
  WHERE id != ? AND vote_count >= 25 AND accords LIKE ?
  LIMIT 40
`);

function parseNotes(r) {
  const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join("|");
  return all.split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
}

function parseAccords(r) {
  return (r.accords || "").split("|").filter(Boolean).map(p => {
    const [name, val] = p.split(":");
    return { name: (name || "").trim().toLowerCase(), strength: Number(val) || 0 };
  });
}

const genericFillers = new Set(["musk", "white musk", "amber", "water", "hedione", "iso e super"]);

function getBaseline2(target) {
  const targetAccords = parseAccords(target);
  const targetTopAccords = targetAccords.slice(0, 3).map(a => a.name);
  const targetNotes = parseNotes(target);

  const a1 = targetTopAccords[0] ? `%${targetTopAccords[0]}%` : null;
  const a2 = targetTopAccords[1] ? `%${targetTopAccords[1]}%` : null;

  const candidateMap = new Map();
  const addCandidate = (r) => {
    if (r.id !== target.id && !candidateMap.has(r.id) && r.vote_count >= 15) {
      candidateMap.set(r.id, r);
    }
  };

  if (a1 && a2) {
    const rows = stmtOldCand1.all(target.id, a1, a2);
    for (const r of rows) addCandidate(r);
  }

  if (candidateMap.size < 25 && a1) {
    const extra = stmtOldCand2.all(target.id, a1);
    for (const r of extra) addCandidate(r);
  }

  const scored = Array.from(candidateMap.values()).map(cand => {
    const candNotes = parseNotes(cand);
    const candAccords = parseAccords(cand);

    let sharedNotesCount = 0;
    let distinctiveShared = 0;
    targetNotes.forEach(tn => {
      const tnNorm = tn.replace(/[\s-]+/g, "");
      for (const cn of candNotes) {
        const cnNorm = cn.replace(/[\s-]+/g, "");
        if (cnNorm === tnNorm || (cnNorm.length > 4 && (tnNorm.includes(cnNorm) || cnNorm.includes(tnNorm)))) {
          sharedNotesCount++;
          if (!genericFillers.has(tn)) distinctiveShared++;
          break;
        }
      }
    });

    const totalUnique = new Set([...targetNotes, ...candNotes]).size;
    const noteJaccard = totalUnique > 0 ? sharedNotesCount / totalUnique : 0;

    const candAccMap = new Map(candAccords.map(a => [a.name, a.strength]));
    let inter = 0;
    let uni = 0;
    const allAccords = new Set([...targetAccords.map(a => a.name), ...candAccMap.keys()]);
    allAccords.forEach(acc => {
      const w1 = targetAccords.find(a => a.name === acc)?.strength || 0;
      const w2 = candAccMap.get(acc) || 0;
      inter += Math.min(w1, w2);
      uni += Math.max(w1, w2);
    });
    const accordScore = uni > 0 ? inter / uni : 0;

    let genderBonus = 0;
    if (target.gender && cand.gender) {
      if (target.gender === cand.gender || cand.gender === "unisex" || target.gender === "unisex") {
        genderBonus = 0.10;
      } else {
        genderBonus = -0.15;
      }
    }

    const voteScore = Math.min(Math.log10(Math.max(cand.vote_count || 1, 1)) / 4.2, 1) * 0.20;
    const totalScore = (noteJaccard * 0.35) + (distinctiveShared * 0.08) + (accordScore * 0.35) + genderBonus + voteScore;

    return { id: cand.id, score: totalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map(s => s.id);
}

// Compute metrics for a retrieved Top-10 vs ground truth
function evaluateQuery(retrievedIds, groundTruthMap) {
  // groundTruthMap: Map(neighborId -> relevance)
  const isHit = retrievedIds.some(id => groundTruthMap.has(id)) ? 1 : 0;

  let matchCount = 0;
  let firstRank = 0;
  let dcg = 0;

  retrievedIds.forEach((id, idx) => {
    const rank = idx + 1;
    if (groundTruthMap.has(id)) {
      matchCount++;
      if (firstRank === 0) firstRank = rank;
      const rel = groundTruthMap.get(id);
      dcg += rel / Math.log2(rank + 1);
    }
  });

  const precision = matchCount / 10;
  const mrr = firstRank > 0 ? 1 / firstRank : 0;

  // IDCG@10
  const sortedRels = Array.from(groundTruthMap.values()).sort((a, b) => b - a);
  let idcg = 0;
  for (let i = 0; i < Math.min(10, sortedRels.length); i++) {
    idcg += sortedRels[i] / Math.log2(i + 2);
  }
  const ndcg = idcg > 0 ? dcg / idcg : 0;

  return { isHit, precision, mrr, ndcg, matchCount };
}

async function run() {
  console.log('Loading ground truth...');
  const gt = await loadGroundTruth();
  console.log('Ground truth ready. Evaluating baselines on Validation and Test sets...\n');

  function evaluateSet(name, idList) {
    let b1Hit = 0, b1Prec = 0, b1Mrr = 0, b1Ndcg = 0;
    let b2Hit = 0, b2Prec = 0, b2Mrr = 0, b2Ndcg = 0;

    let evaluated = 0;
    for (const qid of idList) {
      const target = stmtTarget.get(qid);
      if (!target) continue;
      const qgt = gt.get(qid);
      if (!qgt || qgt.size === 0) continue;

      evaluated++;

      // Baseline 1
      const b1Ret = getBaseline1(target);
      const m1 = evaluateQuery(b1Ret, qgt);
      b1Hit += m1.isHit;
      b1Prec += m1.precision;
      b1Mrr += m1.mrr;
      b1Ndcg += m1.ndcg;

      // Baseline 2 (Current engine)
      const b2Ret = getBaseline2(target);
      const m2 = evaluateQuery(b2Ret, qgt);
      b2Hit += m2.isHit;
      b2Prec += m2.precision;
      b2Mrr += m2.mrr;
      b2Ndcg += m2.ndcg;
    }

    return {
      name,
      evaluated,
      baseline1: {
        hit10: (b1Hit / evaluated),
        prec10: (b1Prec / evaluated),
        mrr: (b1Mrr / evaluated),
        ndcg10: (b1Ndcg / evaluated)
      },
      baseline2: {
        hit10: (b2Hit / evaluated),
        prec10: (b2Prec / evaluated),
        mrr: (b2Mrr / evaluated),
        ndcg10: (b2Ndcg / evaluated)
      }
    };
  }

  const valRes = evaluateSet('Validation Set (1,000)', splitData.validation);
  console.log('Validation Set Complete.');

  const testRes = evaluateSet('Test Set (1,000)', splitData.test);
  console.log('Test Set Complete.\n');

  console.log('================================================================================');
  console.log('BASELINE EVALUATION RESULTS (STRICTLY MASKED CONTENT-ONLY)');
  console.log('================================================================================');
  console.log('\n--- 1. Validation Set (N = 1,000 fragrances, including 15 anchors) ---');
  console.log(`Baseline 1 (Original Accord LIKE + Vote Count):`);
  console.log(`  Hit@10:       ${(valRes.baseline1.hit10 * 100).toFixed(2)}%`);
  console.log(`  Precision@10: ${(valRes.baseline1.prec10 * 100).toFixed(2)}%`);
  console.log(`  MRR:          ${valRes.baseline1.mrr.toFixed(4)}`);
  console.log(`  nDCG@10:      ${(valRes.baseline1.ndcg10 * 100).toFixed(2)}%`);

  console.log(`\nBaseline 2 (Old/Current Engine: Jaccard + Accord + Vote Weight):`);
  console.log(`  Hit@10:       ${(valRes.baseline2.hit10 * 100).toFixed(2)}%`);
  console.log(`  Precision@10: ${(valRes.baseline2.prec10 * 100).toFixed(2)}%`);
  console.log(`  MRR:          ${valRes.baseline2.mrr.toFixed(4)}`);
  console.log(`  nDCG@10:      ${(valRes.baseline2.ndcg10 * 100).toFixed(2)}%`);

  console.log('\n--- 2. Test Set (N = 1,000 fragrances) ---');
  console.log(`Baseline 1 (Original Accord LIKE + Vote Count):`);
  console.log(`  Hit@10:       ${(testRes.baseline1.hit10 * 100).toFixed(2)}%`);
  console.log(`  Precision@10: ${(testRes.baseline1.prec10 * 100).toFixed(2)}%`);
  console.log(`  MRR:          ${testRes.baseline1.mrr.toFixed(4)}`);
  console.log(`  nDCG@10:      ${(testRes.baseline1.ndcg10 * 100).toFixed(2)}%`);

  console.log(`\nBaseline 2 (Old/Current Engine: Jaccard + Accord + Vote Weight):`);
  console.log(`  Hit@10:       ${(testRes.baseline2.hit10 * 100).toFixed(2)}%`);
  console.log(`  Precision@10: ${(testRes.baseline2.prec10 * 100).toFixed(2)}%`);
  console.log(`  MRR:          ${testRes.baseline2.mrr.toFixed(4)}`);
  console.log(`  nDCG@10:      ${(testRes.baseline2.ndcg10 * 100).toFixed(2)}%`);
}

run().catch(console.error);
