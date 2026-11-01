const fs = require('fs');
const readline = require('readline');

async function analyzeThresholds() {
  console.log('Reading perfumes.jsonl and analyzing thresholds...');
  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  // Track directed edges
  // u -> v: { up, down, net, sourceBrand, targetSlug }
  // We need perfume brands. Let's build a brand map first or during pass.
  const brandMap = new Map(); // id -> brand
  const rawEdges = []; // { u, v, up, down }

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      brandMap.set(o.id, o.brand || '');
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      for (const r of rList) {
        rawEdges.push({
          u: o.id,
          v: r.id,
          up: r.up_votes || 0,
          down: r.down_votes || 0
        });
      }
    } catch (e) {}
  }

  console.log(`Parsed ${brandMap.size} perfumes, ${rawEdges.length} directed edges.`);

  // Symmetrize edges
  // Pair key: min(u,v) + ':' + max(u,v)
  // Let's store u->v and v->u
  const edgeMap = new Map(); // 'u:v' (ordered) -> { up_uv, down_uv, up_vu, down_vu }
  for (const e of rawEdges) {
    const key = `${e.u}->${e.v}`;
    edgeMap.set(key, { up: e.up, down: e.down });
  }

  // Undirected pairs
  const pairMap = new Map(); // 'min:max' -> { u, v, net_u_to_v, net_v_to_u, sym_net, sym_up, sym_down, ratio }
  const visited = new Set();

  for (const e of rawEdges) {
    const minId = Math.min(e.u, e.v);
    const maxId = Math.max(e.u, e.v);
    const pKey = `${minId}:${maxId}`;
    if (visited.has(pKey)) continue;
    visited.add(pKey);

    const fwd = edgeMap.get(`${minId}->${maxId}`) || null;
    const rev = edgeMap.get(`${maxId}->${minId}`) || null;

    const up_fwd = fwd ? fwd.up : 0;
    const down_fwd = fwd ? fwd.down : 0;
    const up_rev = rev ? rev.up : 0;
    const down_rev = rev ? rev.down : 0;

    // Symmetrized: weighted combination or max
    // Since Fragrantica mirrors identical votes when synced, but one-way truncation has only one direction:
    // If both exist: average or max (they differ by at most a few votes: avg or max is essentially identical).
    // If only one exists: use that one.
    const maxUp = Math.max(up_fwd, up_rev);
    const maxDown = Math.max(down_fwd, down_rev);
    const symNet = maxUp - maxDown;
    const totalVotes = maxUp + maxDown;
    const upRatio = totalVotes > 0 ? maxUp / totalVotes : 0;

    pairMap.set(pKey, {
      u: minId,
      v: maxId,
      has_fwd: !!fwd,
      has_rev: !!rev,
      fwd_net: up_fwd - down_fwd,
      rev_net: up_rev - down_rev,
      sym_net: symNet,
      sym_up: maxUp,
      sym_down: maxDown,
      up_ratio: upRatio
    });
  }

  console.log(`Total unique undirected fragrance pairs: ${pairMap.size}`);

  const cloneBrands = new Set([
    'Afnan', 'Lattafa Perfumes', 'Lattafa', 'Armaf', 'Maison Alhambra',
    'Fragrance World', 'Paris Corner', 'Al Haramain Perfumes', 'Rasasi', 'Zara'
  ]);

  const thresholds = [3, 5, 10, 20];
  const ratioThreshold = 0.6; // at least 60% up-votes (up / (up + down) >= 0.6)

  for (const th of thresholds) {
    let pairCount = 0;
    let cloneEdgesCount = 0;
    const perTargetDegree = new Map(); // id -> count of qualifying neighbors

    for (const [pKey, p] of pairMap) {
      if (p.sym_net >= th) {
        pairCount++;
        const bU = brandMap.get(p.u) || '';
        const bV = brandMap.get(p.v) || '';
        if (cloneBrands.has(bU) || cloneBrands.has(bV)) {
          cloneEdgesCount++;
        }
        perTargetDegree.set(p.u, (perTargetDegree.get(p.u) || 0) + 1);
        perTargetDegree.set(p.v, (perTargetDegree.get(p.v) || 0) + 1);
      }
    }

    let perfumesWithGte3 = 0;
    for (const [id, deg] of perTargetDegree) {
      if (deg >= 3) perfumesWithGte3++;
    }

    console.log(`\n--- Threshold net_votes >= ${th} ---`);
    console.log(`  Qualifying unique pairs: ${pairCount}`);
    console.log(`  Edges involving major clone brands (Afnan/Lattafa/Armaf/Alhambra/etc.): ${cloneEdgesCount} (${((cloneEdgesCount/pairCount)*100).toFixed(1)}%)`);
    console.log(`  Perfumes with at least 3 qualifying neighbors: ${perfumesWithGte3}`);
  }

  // Now test with ratio rule: net_votes >= th AND up_ratio >= 0.6
  console.log(`\n=== WITH UP/DOWN RATIO RULE: net_votes >= th AND (up / (up + down) >= 0.6) ===`);
  for (const th of thresholds) {
    let pairCount = 0;
    let cloneEdgesCount = 0;
    const perTargetDegree = new Map();

    for (const [pKey, p] of pairMap) {
      if (p.sym_net >= th && p.up_ratio >= 0.6) {
        pairCount++;
        const bU = brandMap.get(p.u) || '';
        const bV = brandMap.get(p.v) || '';
        if (cloneBrands.has(bU) || cloneBrands.has(bV)) {
          cloneEdgesCount++;
        }
        perTargetDegree.set(p.u, (perTargetDegree.get(p.u) || 0) + 1);
        perTargetDegree.set(p.v, (perTargetDegree.get(p.v) || 0) + 1);
      }
    }

    let perfumesWithGte3 = 0;
    for (const [id, deg] of perTargetDegree) {
      if (deg >= 3) perfumesWithGte3++;
    }

    console.log(`\n--- Threshold net_votes >= ${th} + ratio >= 0.6 ---`);
    console.log(`  Qualifying unique pairs: ${pairCount}`);
    console.log(`  Edges involving clone brands: ${cloneEdgesCount} (${((cloneEdgesCount/pairCount)*100).toFixed(1)}%)`);
    console.log(`  Perfumes with at least 3 qualifying neighbors: ${perfumesWithGte3}`);
  }
}

analyzeThresholds().catch(console.error);
