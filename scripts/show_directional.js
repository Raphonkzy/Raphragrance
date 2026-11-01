const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.db');

async function showDirectionalBreakdown() {
  const targetIds = [9828, 84224, 68271]; // Aventus, Blue Talisman, SNOI
  const targets = db.prepare(`SELECT id, name, brand FROM perfumes WHERE id IN (${targetIds.join(',')})`).all();

  console.log('Reading perfumes.jsonl to gather all directional edges for targets...');
  
  // We need all outbound from targets, and all inbound to targets
  const targetSet = new Set(targetIds);
  const outboundMap = new Map(); // targetId -> Map(neighborId -> { up, down, net })
  const inboundMap = new Map();  // targetId -> Map(neighborId -> { up, down, net })

  for (const tid of targetIds) {
    outboundMap.set(tid, new Map());
    inboundMap.set(tid, new Map());
  }

  const rl = readline.createInterface({
    input: fs.createReadStream('D:/Raffa/Mengoding/Raphragrance/perfumes.jsonl'),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      const rList = (o.similar && o.similar.reminds_me_of) || [];
      
      // If o.id is one of our targets, these are outbound
      if (targetSet.has(o.id)) {
        const outM = outboundMap.get(o.id);
        for (const r of rList) {
          outM.set(r.id, { up: r.up_votes || 0, down: r.down_votes || 0, net: (r.up_votes || 0) - (r.down_votes || 0) });
        }
      }

      // If any item in rList is one of our targets, o.id is inbound to that target
      for (const r of rList) {
        if (targetSet.has(r.id)) {
          const inM = inboundMap.get(r.id);
          inM.set(o.id, { up: r.up_votes || 0, down: r.down_votes || 0, net: (r.up_votes || 0) - (r.down_votes || 0) });
        }
      }
    } catch (e) {}
  }

  for (const t of targets) {
    console.log(`\n================================================================================`);
    console.log(`TARGET: ${t.name} (${t.brand}) [ID: ${t.id}]`);
    console.log(`================================================================================`);
    const outM = outboundMap.get(t.id);
    const inM = inboundMap.get(t.id);

    // All unique neighbors
    const allNeighborIds = new Set([...outM.keys(), ...inM.keys()]);

    const neighbors = [];
    for (const nid of allNeighborIds) {
      const fwd = outM.get(nid) || null;
      const rev = inM.get(nid) || null;

      let direction = 'NONE';
      if (fwd && rev) direction = 'BOTH';
      else if (fwd && !rev) direction = 'OUTBOUND_ONLY (on target page)';
      else if (!fwd && rev) direction = 'INBOUND_ONLY (on neighbor page)';

      const fwdNet = fwd ? fwd.net : 0;
      const revNet = rev ? rev.net : 0;

      // Symmetrized formula:
      // When both exist: max(fwdNet, revNet) (or weighted: 0.5 * fwd + 0.5 * rev)
      // When one exists: that one.
      const symNet = Math.max(fwdNet, revNet);
      const maxUp = Math.max(fwd ? fwd.up : 0, rev ? rev.up : 0);
      const maxDown = Math.max(fwd ? fwd.down : 0, rev ? rev.down : 0);

      // Fetch name and brand
      const nRow = db.prepare('SELECT name, brand FROM perfumes WHERE id = ?').get(nid);
      const name = nRow ? `${nRow.name} (${nRow.brand})` : `ID:${nid}`;

      neighbors.push({
        nid,
        name,
        direction,
        fwd,
        rev,
        fwdNet,
        revNet,
        symNet,
        maxUp,
        maxDown
      });
    }

    neighbors.sort((a, b) => b.symNet - a.symNet);

    console.log(`Rank | Neighbor Perfume | Symmetrized Net | Direction | Outbound (T->N) | Inbound (N->T)`);
    console.log(`-----|------------------|-----------------|-----------|-----------------|---------------`);
    neighbors.slice(0, 15).forEach((n, idx) => {
      const fwdStr = n.fwd ? `+${n.fwd.up}/-${n.fwd.down} (net ${n.fwdNet})` : '—';
      const revStr = n.rev ? `+${n.rev.up}/-${n.rev.down} (net ${n.revNet})` : '—';
      console.log(`${(idx + 1).toString().padStart(4)} | ${n.name.padEnd(35).slice(0, 35)} | ${n.symNet.toString().padStart(15)} | ${n.direction.padEnd(25)} | ${fwdStr.padEnd(15)} | ${revStr}`);
    });

    // Check count of inbound-only vs outbound-only
    let bothCount = 0, inOnly = 0, outOnly = 0;
    for (const n of neighbors) {
      if (n.direction === 'BOTH') bothCount++;
      else if (n.direction.startsWith('INBOUND')) inOnly++;
      else if (n.direction.startsWith('OUTBOUND')) outOnly++;
    }
    console.log(`\nTotal neighbors for ${t.name}: ${neighbors.length}`);
    console.log(`  Both directions: ${bothCount}`);
    console.log(`  Inbound only (only on neighbor page): ${inOnly}`);
    console.log(`  Outbound only (only on target page): ${outOnly}`);
  }
}

showDirectionalBreakdown().catch(console.error);
