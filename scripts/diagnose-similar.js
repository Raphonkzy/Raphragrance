#!/usr/bin/env node
/**
 * scripts/diagnose-similar.js
 * Reproducible diagnostic script for the 15 anchor fragrances.
 * Compares:
 *   1. Community Ground Truth (Symmetrized reminds_me_of net_votes)
 *   2. Old/Current Engine (Content-based Note Jaccard + Accord + Vote Score)
 *   3. Baseline Engine (Original SQL LIKE Top 3 Accords + Vote Count)
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/perfumes.db');
const jsonlPath = 'D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl';

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const testTargets = [
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

async function loadSymmetrizedCommunity() {
  const targetIds = new Set(testTargets.map(t => t.id));
  const outboundMap = new Map();
  const inboundMap = new Map();

  for (const tid of targetIds) {
    outboundMap.set(tid, new Map());
    inboundMap.set(tid, new Map());
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      if (targetIds.has(o.id)) {
        const outM = outboundMap.get(o.id);
        for (const r of rList) {
          outM.set(r.id, { slug: r.slug, up: r.up_votes || 0, down: r.down_votes || 0 });
        }
      }
      for (const r of rList) {
        if (targetIds.has(r.id)) {
          const inM = inboundMap.get(r.id);
          inM.set(o.id, { slug: o.slug, up: r.up_votes || 0, down: r.down_votes || 0 });
        }
      }
    } catch (e) {}
  }

  const result = new Map();
  for (const t of testTargets) {
    const outM = outboundMap.get(t.id);
    const inM = inboundMap.get(t.id);
    const allNeighborIds = new Set([...outM.keys(), ...inM.keys()]);
    const list = [];
    for (const nid of allNeighborIds) {
      const fwd = outM.get(nid);
      const rev = inM.get(nid);
      const maxUp = Math.max(fwd ? fwd.up : 0, rev ? rev.up : 0);
      const maxDown = Math.max(fwd ? fwd.down : 0, rev ? rev.down : 0);
      const net = maxUp - maxDown;
      const slug = fwd ? fwd.slug : (rev ? rev.slug : '');
      let dir = 'BOTH';
      if (fwd && !rev) dir = 'OUT';
      else if (!fwd && rev) dir = 'IN';
      list.push({ id: nid, slug, net, up: maxUp, down: maxDown, dir });
    }
    list.sort((a, b) => b.net - a.net);
    result.set(t.id, list.slice(0, 10));
  }
  return result;
}

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

function getCurrentEngineTop10(targetId) {
  const target = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(targetId);
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
    const rows = db.prepare(`
      SELECT * FROM perfumes INDEXED BY idx_votes
      WHERE id != ? AND vote_count >= 15 AND accords LIKE ? AND accords LIKE ?
      LIMIT 60
    `).all(target.id, a1, a2);
    for (const r of rows) addCandidate(r);
  }

  if (candidateMap.size < 25 && a1) {
    const extra = db.prepare(`
      SELECT * FROM perfumes INDEXED BY idx_votes
      WHERE id != ? AND vote_count >= 25 AND accords LIKE ?
      LIMIT 40
    `).all(target.id, a1);
    for (const r of extra) addCandidate(r);
  }

  const genericFillers = new Set(["musk", "white musk", "amber", "water", "hedione", "iso e super"]);

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

    return { cand, score: totalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map(s => s.cand);
}

function getBaselineEngineTop10(targetId) {
  const target = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(targetId);
  const targetAccords = (target.accords || "").split("|").filter(Boolean).map(p => p.split(":")[0].trim().toLowerCase());
  const a1 = targetAccords[0] ? `%${targetAccords[0]}%` : null;
  const a2 = targetAccords[1] ? `%${targetAccords[1]}%` : null;
  const a3 = targetAccords[2] ? `%${targetAccords[2]}%` : null;

  let rows = [];
  if (a1 && a2 && a3) {
    rows = db.prepare(`
      SELECT * FROM perfumes
      WHERE id != ? AND accords LIKE ? AND accords LIKE ? AND accords LIKE ?
      ORDER BY vote_count DESC LIMIT 10
    `).all(target.id, a1, a2, a3);
  }
  if (rows.length < 10 && a1 && a2) {
    const more = db.prepare(`
      SELECT * FROM perfumes
      WHERE id != ? AND id NOT IN (${rows.map(r=>r.id).join(',') || 0}) AND accords LIKE ? AND accords LIKE ?
      ORDER BY vote_count DESC LIMIT ?
    `).all(target.id, a1, a2, 10 - rows.length);
    rows = rows.concat(more);
  }
  return rows;
}

async function run() {
  console.log("=== DIAGNOSIS 15 PARFUM UJI (REPRODUCIBLE RUN) ===\n");
  const commMap = await loadSymmetrizedCommunity();

  let totalMatchEngine = 0;
  let totalMatchBaseline = 0;

  for (const t of testTargets) {
    const commTop = commMap.get(t.id) || [];
    const engineTop = getCurrentEngineTop10(t.id);
    const baselineTop = getBaselineEngineTop10(t.id);

    const commIds = new Set(commTop.map(c => c.id));
    const overlapEngine = engineTop.filter(e => commIds.has(e.id));
    const overlapBaseline = baselineTop.filter(b => commIds.has(b.id));

    totalMatchEngine += overlapEngine.length;
    totalMatchBaseline += overlapBaseline.length;

    console.log(`[TARGET] ${t.name} (${t.brand}) [ID: ${t.id}] -> Overlap Engine: ${overlapEngine.length}/10, Baseline: ${overlapBaseline.length}/10`);
  }

  console.log("\n==================== RINGKASAN ====================");
  console.log(`Rata-rata Match Engine Saat Ini: ${(totalMatchEngine / 15).toFixed(2)} / 10 (${((totalMatchEngine / 150) * 100).toFixed(1)}%)`);
  console.log(`Rata-rata Match Baseline: ${(totalMatchBaseline / 15).toFixed(2)} / 10 (${((totalMatchBaseline / 150) * 100).toFixed(1)}%)`);
}

run().catch(console.error);
