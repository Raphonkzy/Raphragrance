const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.db');

// Fixed seed random generator (PRNG) for 100% reproducibility
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

async function prepareSplitAndEvaluateBaselines() {
  console.log('--- Step 1: Building Ground Truth Symmetrized Graph ---');
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  const directedEdges = new Map(); // 'u->v' => { up, down, net }

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      for (const r of rList) {
        directedEdges.set(`${o.id}->${r.id}`, {
          up: r.up_votes || 0,
          down: r.down_votes || 0,
          net: (r.up_votes || 0) - (r.down_votes || 0)
        });
      }
    } catch (e) {}
  }

  console.log(`Loaded ${directedEdges.size} directed edges.`);

  // Threshold: net_votes >= 5 and up/(up+down) >= 0.6
  const THRESHOLD_NET = 5;
  const THRESHOLD_RATIO = 0.6;

  // Build symmetrized adjacency list: perfume_id -> Map(neighbor_id -> { symNet, up, down })
  const adj = new Map();
  const addEdge = (u, v, symNet, up, down) => {
    if (!adj.has(u)) adj.set(u, new Map());
    adj.get(u).set(v, { symNet, up, down });
  };

  const pairVisited = new Set();
  for (const [key, val] of directedEdges) {
    const [uStr, vStr] = key.split('->');
    const u = Number(uStr);
    const v = Number(vStr);
    const minId = Math.min(u, v);
    const maxId = Math.max(u, v);
    const pKey = `${minId}:${maxId}`;
    if (pairVisited.has(pKey)) continue;
    pairVisited.add(pKey);

    const fwd = directedEdges.get(`${minId}->${maxId}`);
    const rev = directedEdges.get(`${maxId}->${minId}`);

    const maxUp = Math.max(fwd ? fwd.up : 0, rev ? rev.up : 0);
    const maxDown = Math.max(fwd ? fwd.down : 0, rev ? rev.down : 0);
    const symNet = maxUp - maxDown;
    const total = maxUp + maxDown;
    const ratio = total > 0 ? maxUp / total : 0;

    if (symNet >= THRESHOLD_NET && ratio >= THRESHOLD_RATIO) {
      addEdge(minId, maxId, symNet, maxUp, maxDown);
      addEdge(maxId, minId, symNet, maxUp, maxDown);
    }
  }

  // Find candidate pool: perfumes in database that have degree >= 3
  const qualifyingPerfumes = [];
  for (const [id, neighbors] of adj) {
    if (neighbors.size >= 3) {
      // check if it exists in SQLite DB
      qualifyingPerfumes.push(id);
    }
  }

  console.log(`Total perfumes with >= 3 qualifying edges (net >= ${THRESHOLD_NET}, ratio >= ${THRESHOLD_RATIO}): ${qualifyingPerfumes.length}`);

  // 15 Anchor IDs must be in validation set
  const anchorIds = [
    9828,   // Aventus
    31861,  // Sauvage
    33519,  // Baccarat Rouge 540
    12201,  // Santal 33
    1825,   // Tobacco Vanille
    39314,  // Layton
    43871,  // Delina
    84224,  // Blue Talisman
    51411,  // Lost Cherry
    62615,  // Angels' Share
    474,    // Green Irish Tweed
    485,    // Light Blue
    30529,  // XJ 1861 Naxos
    50757,  // Y Eau de Parfum
    1849    // Tuscan Leather
  ];

  // Verify all 15 anchors are in qualifying
  for (const aId of anchorIds) {
    if (!adj.has(aId) || adj.get(aId).size < 3) {
      console.log(`Warning: anchor ${aId} has only ${adj.get(aId)?.size || 0} qualifying neighbors`);
    }
  }

  // Deterministic shuffle using seed 42
  const rng = mulberry32(42);
  const remaining = qualifyingPerfumes.filter(id => !anchorIds.includes(id));
  
  // Fisher-Yates shuffle
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // Validation: 15 anchors + 985 remaining = 1,000
  const valIds = [...anchorIds, ...remaining.slice(0, 985)];
  // Test: next 1,000
  const testIds = remaining.slice(985, 1985);
  // Background: the rest
  const backgroundIds = remaining.slice(1985);

  console.log(`Split created:`);
  console.log(`  Validation set: ${valIds.length} fragrances (includes all 15 anchors)`);
  console.log(`  Test set:       ${testIds.length} fragrances`);
  console.log(`  Background set: ${backgroundIds.length} fragrances`);

  // Save split to JSON for 100% reproducibility
  const splitData = {
    metadata: {
      date: new Date().toISOString(),
      seed: 42,
      threshold_net: THRESHOLD_NET,
      threshold_ratio: THRESHOLD_RATIO,
      counts: { validation: valIds.length, test: testIds.length, background: backgroundIds.length }
    },
    validation: valIds,
    test: testIds,
    background: backgroundIds
  };
  fs.writeFileSync('data/eval_split.json', JSON.stringify(splitData, null, 2));
  console.log('Saved split to data/eval_split.json');

  return { adj, valIds, testIds, anchorIds };
}

prepareSplitAndEvaluateBaselines().catch(console.error);
