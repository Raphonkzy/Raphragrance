const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const readline = require('readline');

const db = new DatabaseSync('data/perfumes.db');

// 15 test perfumes
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

// Let's get the community reminds_me_of from perfumes.jsonl for all 15
async function getCommunityReminds() {
  const targetIds = new Set(testTargets.map(t => t.id));
  const result = new Map();

  const fileStream = fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (targetIds.has(obj.id)) {
        const reminds = (obj.similar && obj.similar.reminds_me_of) || [];
        // sort by net vote = up_votes - down_votes
        const sorted = [...reminds].sort((a, b) => {
          const netA = (a.up_votes || 0) - (a.down_votes || 0);
          const netB = (b.up_votes || 0) - (b.down_votes || 0);
          return netB - netA;
        });
        result.set(obj.id, sorted.slice(0, 10));
      }
    } catch (e) {}
    if (result.size === targetIds.size) break;
  }
  return result;
}

// Current engine logic (pure content-based algorithm from lib/data.ts without KNOWN_CLUSTERS hardcoding)
function getCurrentEngineTop10(targetId) {
  const target = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(targetId);
  const targetAccords = (target.accords || "").split("|").filter(Boolean).map(p => {
    const [name, val] = p.split(":");
    return { name: (name || "").trim().toLowerCase(), strength: Number(val) || 0 };
  });
  const targetTopAccords = targetAccords.slice(0, 3).map(a => a.name);

  const parseNotes = (r) => {
    const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join("|");
    return all.split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
  };
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
      SELECT * FROM perfumes
      INDEXED BY idx_votes
      WHERE id != ?
        AND vote_count >= 15
        AND accords LIKE ?
        AND accords LIKE ?
      LIMIT 60
    `).all(target.id, a1, a2);
    for (const r of rows) addCandidate(r);
  }

  if (candidateMap.size < 25 && a1) {
    const extra = db.prepare(`
      SELECT * FROM perfumes
      INDEXED BY idx_votes
      WHERE id != ?
        AND vote_count >= 25
        AND accords LIKE ?
      LIMIT 40
    `).all(target.id, a1);
    for (const r of extra) addCandidate(r);
  }

  const genericFillers = new Set(["musk", "white musk", "amber", "water", "hedione", "iso e super"]);

  const scored = Array.from(candidateMap.values()).map(cand => {
    const candNotes = parseNotes(cand);
    const candAccords = (cand.accords || "").split("|").filter(Boolean).map(p => {
      const [name, val] = p.split(":");
      return { name: (name || "").trim().toLowerCase(), strength: Number(val) || 0 };
    });

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

    return { cand, score: totalScore, noteJaccard, accordScore, voteScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map(s => s.cand);
}

// Baseline engine (original: first 3 accords matched with LIKE, sorted by vote_count)
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
  const commMap = await getCommunityReminds();
  console.log("=== DIAGNOSIS 15 PARFUM UJI ===\n");

  const results = [];

  for (const t of testTargets) {
    const commTop = commMap.get(t.id) || [];
    const engineTop = getCurrentEngineTop10(t.id);
    const baselineTop = getBaselineEngineTop10(t.id);

    const commIds = new Set(commTop.map(c => c.id));
    const engineIds = new Set(engineTop.map(e => e.id));
    const baselineIds = new Set(baselineTop.map(b => b.id));

    const overlapEngine = engineTop.filter(e => commIds.has(e.id));
    const overlapBaseline = baselineTop.filter(b => commIds.has(b.id));

    // Get details of commTop from db
    const commDetails = commTop.map(c => {
      const r = db.prepare("SELECT id, name, brand, vote_count FROM perfumes WHERE id = ?").get(c.id);
      return r ? `${r.name} (${r.brand}) [net:${c.up_votes - c.down_votes}]` : `${c.slug} [net:${c.up_votes - c.down_votes}]`;
    });

    const engineDetails = engineTop.map(e => `${e.name} (${e.brand}) [votes:${e.vote_count}]`);
    const baselineDetails = baselineTop.map(b => `${b.name} (${b.brand}) [votes:${b.vote_count}]`);

    results.push({
      target: t,
      commTop,
      commDetails,
      engineTop,
      engineDetails,
      overlapEngine,
      baselineTop,
      baselineDetails,
      overlapBaseline
    });

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[TARGET] ${t.name} (${t.brand}) - ID: ${t.id}`);
    console.log(`\n1. Komunitas 'Reminds Me Of' (Top 10 Net Votes):`);
    commDetails.forEach((cd, i) => console.log(`   ${i+1}. ${cd}`));

    console.log(`\n2. Hasil Engine Saat Ini (Top 10 Content-Based / Scoring):`);
    engineDetails.forEach((ed, i) => {
      const isMatch = commIds.has(engineTop[i].id) ? " [MATCH KOMUNITAS!]" : "";
      console.log(`   ${i+1}. ${ed}${isMatch}`);
    });

    console.log(`\n3. Hasil Baseline (Original Top 3 Accords + Vote Count):`);
    baselineDetails.forEach((bd, i) => {
      const isMatch = commIds.has(baselineTop[i].id) ? " [MATCH KOMUNITAS!]" : "";
      console.log(`   ${i+1}. ${bd}${isMatch}`);
    });

    console.log(`\nIrisan Komunitas vs Engine Saat Ini: ${overlapEngine.length} / 10`);
    console.log(`Irisan Komunitas vs Baseline: ${overlapBaseline.length} / 10`);
    console.log(`--------------------------------------------------------------------------------\n`);
  }

  // Summary counts
  console.log("\n==================== RINGKASAN IRISAN ====================");
  let totalOverlapEngine = 0;
  let totalOverlapBaseline = 0;
  for (const r of results) {
    console.log(`${r.target.name.padEnd(25)}: Engine = ${r.overlapEngine.length}/10 | Baseline = ${r.overlapBaseline.length}/10`);
    totalOverlapEngine += r.overlapEngine.length;
    totalOverlapBaseline += r.overlapBaseline.length;
  }
  console.log(`\nRata-rata Irisan Engine: ${(totalOverlapEngine / 15).toFixed(2)} / 10 (${((totalOverlapEngine / 150) * 100).toFixed(1)}%)`);
  console.log(`Rata-rata Irisan Baseline: ${(totalOverlapBaseline / 15).toFixed(2)} / 10 (${((totalOverlapBaseline / 150) * 100).toFixed(1)}%)`);
}

run().catch(console.error);
