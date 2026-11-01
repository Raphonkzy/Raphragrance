const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteDict
} = require('./ablation_common');

// 15 Corrected Anchor Perfumes from SQLite
const ANCHORS = [
  { id: 9828, name: "Aventus", brand: "Creed" },
  { id: 1418, name: "Bleu de Chanel", brand: "Chanel" },
  { id: 31861, name: "Sauvage", brand: "Dior" },
  { id: 39314, name: "Layton", brand: "Parfums de Marly" },
  { id: 33519, name: "Baccarat Rouge 540", brand: "Maison Francis Kurkdjian" },
  { id: 51411, name: "Lost Cherry", brand: "Tom Ford" },
  { id: 44174, name: "Hacivat", brand: "Nishane" },
  { id: 62615, name: "Angels' Share", brand: "By Kilian" },
  { id: 68271, name: "Supremacy Not Only Intense", brand: "Afnan" },
  { id: 1825, name: "Terre d'Hermes", brand: "Hermes" },
  { id: 84224, name: "Blue Talisman", brand: "Ex Nihilo" },
  { id: 108244, name: "Turathi Electric", brand: "Afnan" },
  { id: 50384, name: "Cloud", brand: "Ariana Grande" },
  { id: 53, name: "Kouros", brand: "Yves Saint Laurent" },
  { id: 43632, name: "Black Phantom", brand: "By Kilian" }
];

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

async function runAnchorsOverlap() {
  const { adjFull } = await loadGroundTruth();
  const rows = db.prepare('SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender FROM perfumes').all();
  const numP = rows.length;
  const byId = new Map(rows.map(r => [r.id, r]));

  const perfumeNoteSetsDict = rows.map(r => {
    const all = [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|');
    return new Set(all.split('|').map(normalizeNoteDict).filter(Boolean));
  });

  function getNoteJaccard(i1, i2) {
    const s1 = perfumeNoteSetsDict[i1];
    const s2 = perfumeNoteSetsDict[i2];
    if (s1.size === 0 || s2.size === 0) return 0;
    let inter = 0;
    for (const n of s1) if (s2.has(n)) inter++;
    return inter / (s1.size + s2.size - inter);
  }

  function buildIndex(noteNormalizer) {
    const noteToId = new Map();
    const accordToId = new Map();

    function getNoteId(n) {
      let id = noteToId.get(n);
      if (id === undefined) { id = noteToId.size; noteToId.set(n, id); }
      return id;
    }
    function getAccordId(a) {
      let id = accordToId.get(a);
      if (id === undefined) { id = accordToId.size; accordToId.set(a, id); }
      return id;
    }

    const pData = [];
    for (let i = 0; i < numP; i++) {
      const r = rows[i];
      const topNotes = (r.notes_top || '').split('|').map(noteNormalizer).filter(Boolean);
      const midNotes = (r.notes_middle || '').split('|').map(noteNormalizer).filter(Boolean);
      const baseNotes = (r.notes_base || '').split('|').map(noteNormalizer).filter(Boolean);
      const flatNotes = (r.notes_flat || '').split('|').map(noteNormalizer).filter(Boolean);

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

    return {
      idToInternal,
      pData,
      noteIndex,
      accordIndex,
      pNorms,
      pAccNorms,
      pQueryNoteSums,
      pNoteArrays,
      pAccordArrays
    };
  }

  const idxDict = buildIndex(normalizeNoteDict);

  const candScores = new Float32Array(numP);
  const touchedCands = new Int32Array(numP);

  function runContentEngine(targetDbId, config) {
    const {
      pData,
      noteIndex,
      accordIndex,
      idToInternal,
      pNorms,
      pAccNorms,
      pQueryNoteSums,
      pNoteArrays,
      pAccordArrays
    } = idxDict;

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

    const heap = new MinHeap(300);
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
      const cQSum = pQueryNoteSums[cIdx];

      let genderPenalty = 0;
      if ((tGender === 'male' && cGender === 'female') || (tGender === 'female' && cGender === 'male')) {
        genderPenalty = 0.08;
      }

      let noteDot = 0, sharedQ = 0, sharedC = 0;
      let p1 = 0, p2 = 0;
      while (p1 < tNotes.ids.length && p2 < cNotes.ids.length) {
        if (tNotes.ids[p1] === cNotes.ids[p2]) {
          const v1 = tNotes.vals[p1];
          const v2 = cNotes.vals[p2];
          noteDot += v1 * v2;
          sharedQ += v1;
          sharedC += v2;
          p1++; p2++;
        } else if (tNotes.ids[p1] < cNotes.ids[p2]) p1++;
        else p2++;
      }

      const noteSim = (tNorm > 0 && cNorm > 0) ? (noteDot / (tNorm * cNorm)) : 0;
      const containmentQtoC = tQSum > 0 ? (sharedQ / tQSum) : 0;
      const containmentCtoQ = cQSum > 0 ? (sharedC / cQSum) : 0;

      let accordSim = 0;
      let top1Match = 0;
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
        if (tAccords.ids.length > 0 && cAcc.ids.length > 0 && tAccords.ids[0] === cAcc.ids[0]) top1Match = 1;
      } else {
        accordSim = noteSim;
      }

      let score = 0;
      if (config.mode === 'untuned') {
        score = (tHasAcc && cHasAcc) ? (0.50 * noteSim + 0.50 * accordSim) : noteSim;
      } else if (config.mode === 'tuned') {
        score = (0.35 * noteSim + 0.25 * containmentQtoC + 0.10 * containmentCtoQ + 0.40 * accordSim + 0.05 * top1Match) - genderPenalty;
      }

      scored.push({ id: cand.id, internalIdx: cIdx, brand: cand.brand, score });
    }

    scored.sort((a, b) => b.score - a.score);

    if (config.useMMR) {
      const selected = [];
      const brandCount = new Map();
      const pool = scored.slice(0, 100);
      while (selected.length < 10 && pool.length > 0) {
        let bestScore = -Infinity;
        let bestIdx = -1;
        for (let i = 0; i < pool.length; i++) {
          const item = pool[i];
          const bCnt = brandCount.get(item.brand) || 0;
          if (bCnt >= 2) continue;
          let maxSim = 0;
          for (const s of selected) {
            const sim = getNoteJaccard(item.internalIdx, s.internalIdx);
            if (sim > maxSim) maxSim = sim;
          }
          let penalty = (maxSim >= 0.70) ? (maxSim - 0.70 + 0.1) * 0.35 : 0;
          const adj = item.score - penalty;
          if (adj > bestScore) { bestScore = adj; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          const chosen = pool.splice(bestIdx, 1)[0];
          selected.push(chosen);
          brandCount.set(chosen.brand, (brandCount.get(chosen.brand) || 0) + 1);
        } else break;
      }
      return selected.map(s => s.id);
    }

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

  const stmtTarget = db.prepare("SELECT * FROM perfumes WHERE id = ?");
  const stmtOldCand1 = db.prepare("SELECT * FROM perfumes INDEXED BY idx_votes WHERE id != ? AND vote_count >= 15 AND accords LIKE ? AND accords LIKE ? LIMIT 60");
  const stmtOldCand2 = db.prepare("SELECT * FROM perfumes INDEXED BY idx_votes WHERE id != ? AND vote_count >= 25 AND accords LIKE ? LIMIT 40");

  function getOldEngine(target) {
    const tAcc = (target.accords || "").split("|").filter(Boolean).map(p => {
      const [name, val] = p.split(":");
      return { name: (name || "").trim().toLowerCase(), strength: Number(val) || 0 };
    });
    const a1 = tAcc[0] ? `%${tAcc[0].name}%` : null;
    const a2 = tAcc[1] ? `%${tAcc[1].name}%` : null;
    const tNotes = [target.notes_top, target.notes_middle, target.notes_base, target.notes_flat].filter(Boolean).join("|").toLowerCase().split("|").map(s=>s.trim()).filter(Boolean);

    const candMap = new Map();
    if (a1 && a2) for (const r of stmtOldCand1.all(target.id, a1, a2)) if (r.vote_count >= 15) candMap.set(r.id, r);
    if (candMap.size < 25 && a1) for (const r of stmtOldCand2.all(target.id, a1)) if (r.vote_count >= 25) candMap.set(r.id, r);

    const scored = Array.from(candMap.values()).map(cand => {
      const cNotes = [cand.notes_top, cand.notes_middle, cand.notes_base, cand.notes_flat].filter(Boolean).join("|").toLowerCase().split("|").map(s=>s.trim()).filter(Boolean);
      let shared = 0;
      tNotes.forEach(tn => {
        for (const cn of cNotes) if (cn === tn || (cn.length > 4 && (tn.includes(cn) || cn.includes(tn)))) { shared++; break; }
      });
      const totalU = new Set([...tNotes, ...cNotes]).size;
      const noteJaccard = totalU > 0 ? shared / totalU : 0;

      const cAcc = (cand.accords || "").split("|").filter(Boolean).map(p => {
        const [n, v] = p.split(":");
        return { name: (n||"").trim().toLowerCase(), strength: Number(v)||0 };
      });
      const cMap = new Map(cAcc.map(a => [a.name, a.strength]));
      let inter = 0, uni = 0;
      const allAcc = new Set([...tAcc.map(a => a.name), ...cMap.keys()]);
      allAcc.forEach(acc => {
        const w1 = tAcc.find(a => a.name === acc)?.strength || 0;
        const w2 = cMap.get(acc) || 0;
        inter += Math.min(w1, w2);
        uni += Math.max(w1, w2);
      });
      const accScore = uni > 0 ? inter / uni : 0;
      let gb = 0;
      if (target.gender && cand.gender) {
        gb = (target.gender === cand.gender || cand.gender === "unisex" || target.gender === "unisex") ? 0.10 : -0.15;
      }
      const vs = Math.min(Math.log10(Math.max(cand.vote_count || 1, 1)) / 4.2, 1) * 0.20;
      return { id: cand.id, score: (noteJaccard * 0.35) + (accScore * 0.35) + gb + vs };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map(s => s.id);
  }

  console.log('================================================================================================');
  console.log('15 CORRECTED ANCHORS OVERLAP COMPARISON WITH EXACT TOP-10 COMMUNITY NEIGHBORS (sym_net)');
  console.log('================================================================================================');
  console.log('Anchor Fragrance              | Top-10 GT Neighbors | Old Engine | Untuned Content | Tuned Content | Tuned + MMR');
  console.log('------------------------------|---------------------|------------|-----------------|---------------|------------');

  let sumOld = 0, sumUntuned = 0, sumTuned = 0, sumMMR = 0;

  for (const a of ANCHORS) {
    const qgt = adjFull.get(a.id) || new Map();
    const sortedGT = Array.from(qgt.entries()).sort((x, y) => y[1] - x[1]);
    const top10GT = new Set(sortedGT.slice(0, 10).map(e => e[0]));
    const totalGTCount = top10GT.size;

    const targetRow = stmtTarget.get(a.id);
    const oldRecs = targetRow ? getOldEngine(targetRow) : [];
    const untunedRecs = runContentEngine(a.id, { mode: 'untuned' });
    const tunedRecs = runContentEngine(a.id, { mode: 'tuned' });
    const mmrRecs = runContentEngine(a.id, { mode: 'tuned', useMMR: true });

    const overlapOld = oldRecs.filter(id => top10GT.has(id)).length;
    const overlapUntuned = untunedRecs.filter(id => top10GT.has(id)).length;
    const overlapTuned = tunedRecs.filter(id => top10GT.has(id)).length;
    const overlapMMR = mmrRecs.filter(id => top10GT.has(id)).length;

    sumOld += overlapOld;
    sumUntuned += overlapUntuned;
    sumTuned += overlapTuned;
    sumMMR += overlapMMR;

    const nameStr = `${a.name} (${a.brand})`.slice(0, 28);
    console.log(
      `${nameStr.padEnd(29)} | ` +
      `${totalGTCount.toString().padStart(19)} | ` +
      `${(overlapOld + '/10').padStart(10)} | ` +
      `${(overlapUntuned + '/10').padStart(15)} | ` +
      `${(overlapTuned + '/10').padStart(13)} | ` +
      `${(overlapMMR + '/10').padStart(11)}`
    );
  }

  console.log('------------------------------|---------------------|------------|-----------------|---------------|------------');
  console.log(
    `${'AVERAGE OVERLAP / 10'.padEnd(29)} | ` +
    `${'10.0'.padStart(19)} | ` +
    `${((sumOld / 15).toFixed(1) + '/10').padStart(10)} | ` +
    `${((sumUntuned / 15).toFixed(1) + '/10').padStart(15)} | ` +
    `${((sumTuned / 15).toFixed(1) + '/10').padStart(13)} | ` +
    `${((sumMMR / 15).toFixed(1) + '/10').padStart(11)}`
  );
  console.log('================================================================================================\n');
}

runAnchorsOverlap().catch(console.error);
