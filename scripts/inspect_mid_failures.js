const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const { db, splitData, loadGroundTruth, normalizeNoteDict, cloneHouses } = require('./ablation_common');

class MinHeap {
  constructor(maxSize) { this.maxSize = maxSize; this.heap = []; }
  push(idx, val) {
    if (this.heap.length < this.maxSize) {
      this.heap.push({ idx, val });
      this._up(this.heap.length - 1);
    } else if (val > this.heap[0].val) {
      this.heap[0] = { idx, val };
      this._down(0);
    }
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].val > this.heap[i].val) {
        const tmp = this.heap[p]; this.heap[p] = this.heap[i]; this.heap[i] = tmp;
        i = p;
      } else break;
    }
  }
  _down(i) {
    const len = this.heap.length;
    while ((i << 1) + 1 < len) {
      let left = (i << 1) + 1;
      let right = left + 1;
      let smallest = (right < len && this.heap[right].val < this.heap[left].val) ? right : left;
      if (this.heap[smallest].val < this.heap[i].val) {
        const tmp = this.heap[smallest]; this.heap[smallest] = this.heap[i]; this.heap[i] = tmp;
        i = smallest;
      } else break;
    }
  }
}

async function inspectMidTercileFailures() {
  const { adjFull } = await loadGroundTruth();
  const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
  const numP = rows.length;
  const byId = new Map(rows.map(r => [r.id, r]));

  const noteToId = new Map();
  const accordToId = new Map();
  function getNoteId(n) { let id = noteToId.get(n); if (id === undefined) { id = noteToId.size; noteToId.set(n, id); } return id; }
  function getAccordId(a) { let id = accordToId.get(a); if (id === undefined) { id = accordToId.size; accordToId.set(a, id); } return id; }

  const pData = [];
  for (let i = 0; i < numP; i++) {
    const r = rows[i];
    const topNotes = (r.notes_top || '').split('|').map(normalizeNoteDict).filter(Boolean);
    const midNotes = (r.notes_middle || '').split('|').map(normalizeNoteDict).filter(Boolean);
    const baseNotes = (r.notes_base || '').split('|').map(normalizeNoteDict).filter(Boolean);
    const flatNotes = (r.notes_flat || '').split('|').map(normalizeNoteDict).filter(Boolean);

    const hasPyramid = (topNotes.length + midNotes.length + baseNotes.length > 0);
    const isFlatOnly = !hasPyramid && flatNotes.length > 0;

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
      gender: (r.gender || 'unisex').toLowerCase(),
      vote_count: r.vote_count || 0,
      noteMap: nMap,
      accords,
      hasAccords: accords.length > 0
    });
  }

  const numNotes = noteToId.size;
  const noteDF = new Int32Array(numNotes);
  for (const p of pData) for (const nid of p.noteMap.keys()) noteDF[nid]++;

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
  const pQueryNoteSums = new Float32Array(numP);
  const pNoteArrays = [];
  const pAccordArrays = [];

  for (let i = 0; i < numP; i++) {
    const p = pData[i];
    idToInternal.set(p.id, i);

    const nEntries = Array.from(p.noteMap.entries()).sort((a, b) => a[0] - b[0]);
    const nIds = new Int32Array(nEntries.length);
    const nVals = new Float32Array(nEntries.length);
    let nNorm = 0;
    let qSum = 0;
    for (let j = 0; j < nEntries.length; j++) {
      const nid = nEntries[j][0];
      const w = nEntries[j][1];
      const tfidf = w * noteIDF[nid];
      nIds[j] = nid;
      nVals[j] = tfidf;
      nNorm += tfidf * tfidf;
      qSum += tfidf;
      noteIndex[nid].push(i);
    }
    pNorms[i] = Math.sqrt(nNorm);
    pQueryNoteSums[i] = qSum;
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

  const candScores = new Float32Array(numP);
  const touchedCands = new Int32Array(numP);

  function runEngine(targetDbId) {
    const tIdx = idToInternal.get(targetDbId);
    if (tIdx === undefined) return [];

    const tNotes = pNoteArrays[tIdx];
    const tNorm = pNorms[tIdx];
    const tAccords = pAccordArrays[tIdx];
    const tAccNorm = pAccNorms[tIdx];
    const tHasAcc = pData[tIdx].hasAccords;
    const tGender = pData[tIdx].gender;
    const tQSum = pQueryNoteSums[tIdx];

    let touchedCount = 0;
    for (let j = 0; j < tNotes.ids.length; j++) {
      const nid = tNotes.ids[j];
      const qVal = tNotes.vals[j];
      const postings = noteIndex[nid];
      for (let k = 0; k < postings.length; k++) {
        const cIdx = postings[k];
        if (cIdx === tIdx) continue;
        if (candScores[cIdx] === 0) touchedCands[touchedCount++] = cIdx;
        candScores[cIdx] += qVal;
      }
    }
    const topAccCount = Math.min(3, tAccords.ids.length);
    for (let j = 0; j < topAccCount; j++) {
      const aid = tAccords.ids[j];
      const postings = accordIndex[aid];
      for (let k = 0; k < postings.length; k++) {
        const cIdx = postings[k];
        if (cIdx === tIdx) continue;
        if (candScores[cIdx] === 0) touchedCands[touchedCount++] = cIdx;
        candScores[cIdx] += 1.5;
      }
    }

    const heap = new MinHeap(250);
    for (let i = 0; i < touchedCount; i++) {
      const cIdx = touchedCands[i];
      const raw = candScores[cIdx];
      candScores[cIdx] = 0;
      heap.push(cIdx, raw / Math.sqrt(Math.max(1, pNorms[cIdx])));
    }

    const candidates = heap.heap;
    const scored = [];
    for (let i = 0; i < candidates.length; i++) {
      const cIdx = candidates[i].idx;
      const cand = pData[cIdx];
      const cNotes = pNoteArrays[cIdx];
      const cNorm = pNorms[cIdx];
      const cAcc = pAccordArrays[cIdx];
      const cAccNorm = pAccNorms[cIdx];
      const cHasAcc = cand.hasAccords;
      const cGender = cand.gender;

      let genderPenalty = 0;
      if ((tGender === 'men' && cGender === 'women') || (tGender === 'women' && cGender === 'men')) {
        genderPenalty = 0.08;
      }

      let noteDot = 0, sharedQ = 0;
      let p1 = 0, p2 = 0;
      while (p1 < tNotes.ids.length && p2 < cNotes.ids.length) {
        if (tNotes.ids[p1] === cNotes.ids[p2]) {
          noteDot += tNotes.vals[p1] * cNotes.vals[p2];
          sharedQ += tNotes.vals[p1];
          p1++; p2++;
        } else if (tNotes.ids[p1] < cNotes.ids[p2]) p1++;
        else p2++;
      }

      const noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;
      const containment = tQSum > 0 ? (sharedQ / tQSum) : 0;

      let accordSim = 0;
      if (tHasAcc && cHasAcc && tAccNorm > 0 && cAccNorm > 0) {
        let accDot = 0;
        let a1 = 0, a2 = 0;
        while (a1 < tAccords.ids.length && a2 < cAcc.ids.length) {
          if (tAccords.ids[a1] === cAcc.ids[a2]) {
            accDot += tAccords.vals[a1] * cAcc.vals[a2];
            a1++; a2++;
          } else if (tAccords.ids[a1] < cAcc.ids[a2]) a1++;
          else a2++;
        }
        accordSim = Math.max(0, (accDot / (tAccNorm * cAccNorm) + 1) / 2);
      } else {
        accordSim = noteSim;
      }

      const score = (0.35 * noteSim + 0.35 * containment + 0.30 * accordSim) - genderPenalty;
      scored.push({ id: cand.id, brand: cand.brand, score });
    }

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

  // Find mid-tercile failures
  const valP = splitData.validation.map(id => byId.get(id)).filter(Boolean);
  const sortedVotes = [...valP].map(p => p.vote_count).sort((a, b) => a - b);
  const t1 = sortedVotes[Math.floor(sortedVotes.length / 3)];
  const t2 = sortedVotes[Math.floor(sortedVotes.length * 2 / 3)];

  const midQueries = valP.filter(p => p.vote_count > t1 && p.vote_count <= t2);
  const failures = [];

  for (const q of midQueries) {
    const qgt = adjFull.get(q.id);
    if (!qgt || qgt.size === 0) continue;
    const recs = runEngine(q.id);
    const hit = recs.some(id => qgt.has(id));
    if (!hit) {
      failures.push({ q, qgt, recs });
      if (failures.length >= 20) break;
    }
  }

  console.log(`\n=== 20 MID-TERCILE FAILURES ANALYSIS ===\n`);
  failures.forEach((f, idx) => {
    const q = f.q;
    const gtNeighbors = Array.from(f.qgt.entries()).map(([gid, net]) => {
      const gp = byId.get(gid);
      return `${gp ? gp.name : gid} (${gp ? gp.brand : '?'}) [sym_net: ${net}]`;
    }).join('; ');

    const top3Recs = f.recs.slice(0, 3).map(rid => {
      const rp = byId.get(rid);
      return `${rp ? rp.name : rid} (${rp ? rp.brand : '?'})`;
    }).join('; ');

    console.log(`${idx+1}. Query: ${q.name} (${q.brand}) [Votes: ${q.vote_count}]`);
    console.log(`   Accords: ${q.accords}`);
    console.log(`   GT Neighbors: ${gtNeighbors}`);
    console.log(`   Engine Top 3: ${top3Recs}`);
    console.log('---');
  });
}

inspectMidTercileFailures().catch(console.error);
