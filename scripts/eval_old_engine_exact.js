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

const stmtTarget = db.prepare("SELECT * FROM perfumes WHERE id = ?");
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

function evaluateQuery(retrievedIds, qgt) {
  const isHit = retrievedIds.some(id => qgt.has(id)) ? 1 : 0;

  // TopGT Recall@10
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
  const mrr = firstRank > 0 ? 1 / firstRank : 0;

  let idcg = 0;
  for (let i = 0; i < Math.min(10, sortedGT.length); i++) {
    idcg += sortedGT[i][1] / Math.log2(i + 2);
  }
  const ndcg = idcg > 0 ? dcg / idcg : 0;

  return { isHit, topGTRecall, precision, mrr, ndcg, matchCount };
}

async function run() {
  console.log('Loading ground truth...');
  const gt = await loadGroundTruth();

  let b2Hit = 0, b2TopGT = 0, b2Prec = 0, b2Mrr = 0, b2Ndcg = 0;
  let evaluated = 0;

  for (const qid of splitData.validation) {
    const target = stmtTarget.get(qid);
    if (!target) continue;
    const qgt = gt.get(qid);
    if (!qgt || qgt.size === 0) continue;

    evaluated++;
    const b2Ret = getBaseline2(target);
    const m2 = evaluateQuery(b2Ret, qgt);

    b2Hit += m2.isHit;
    b2TopGT += m2.topGTRecall;
    b2Prec += m2.precision;
    b2Mrr += m2.mrr;
    b2Ndcg += m2.ndcg;
  }

  console.log('================================================================');
  console.log('EXACT OLD ENGINE BASELINE ON VALIDATION SET (N = 1,000)');
  console.log('================================================================');
  console.log(`Evaluated:        ${evaluated}`);
  console.log(`TopGT Recall@10:  ${((b2TopGT / evaluated) * 100).toFixed(2)}%`);
  console.log(`Hit@10:           ${((b2Hit / evaluated) * 100).toFixed(2)}%`);
  console.log(`Precision@10:     ${((b2Prec / evaluated) * 100).toFixed(2)}%`);
  console.log(`MRR:              ${(b2Mrr / evaluated).toFixed(4)}`);
  console.log(`nDCG@10:          ${((b2Ndcg / evaluated) * 100).toFixed(2)}%`);
  console.log('================================================================');
}

run().catch(console.error);
