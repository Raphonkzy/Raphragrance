const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('data/perfumes.db');

const rows = db.prepare(`
  SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
  FROM perfumes
`).all();

// Comprehensive synonym & normalization dictionary
const canonicalNotes = new Map([
  ['oak moss', 'oakmoss'],
  ['oakmoss', 'oakmoss'],
  ['tree moss', 'oakmoss'],
  ['treemoss', 'oakmoss'],
  ['cedar wood', 'cedar'],
  ['cedarwood', 'cedar'],
  ['virginia cedar', 'cedar'],
  ['atlas cedar', 'cedar'],
  ['cedar', 'cedar'],
  ['bergamote', 'bergamot'],
  ['calabrian bergamot', 'bergamot'],
  ['bergamot', 'bergamot'],
  ['patchouly', 'patchouli'],
  ['patchouli', 'patchouli'],
  ['ambroxan', 'ambergris'],
  ['ambrofix', 'ambergris'],
  ['cetalox', 'ambergris'],
  ['amber gris', 'ambergris'],
  ['ambergris', 'ambergris'],
  ['georgywood', 'cedar'],
  ['akigalawood', 'patchouli'],
  ['iso e super', 'woody notes'],
  ['woody notes', 'woody notes'],
  ['woodsy notes', 'woody notes'],
  ['woods', 'woody notes'],
  ['blackcurrant', 'black currant'],
  ['black currant', 'black currant'],
  ['cassis', 'black currant'],
  ['mandarin', 'mandarin orange'],
  ['mandarine', 'mandarin orange'],
  ['mandarin orange', 'mandarin orange'],
  ['tangerine', 'mandarin orange'],
  ['bourbon vanilla', 'vanilla'],
  ['madagascar vanilla', 'vanilla'],
  ['vanilla', 'vanilla'],
  ['musk', 'musk'],
  ['white musk', 'white musk']
]);

function normalizeNote(raw) {
  let s = raw.toLowerCase().trim();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[-_]+/g, ' ');
  s = s.replace(/[^a-z0-9 ]/g, '').trim();
  s = s.replace(/\s+/g, ' ');
  if (canonicalNotes.has(s)) return canonicalNotes.get(s);
  return s;
}

const perfumes = new Map();
const noteDocFreq = new Map();

for (const r of rows) {
  let accords = [];
  if (r.accords) {
    accords = r.accords.split('|').filter(Boolean).map(p => {
      const [name, val] = p.split(':');
      return {
        name: (name || '').trim().toLowerCase(),
        strength: Number(val) || 0
      };
    });
  }

  let centeredAccords = new Map();
  let accordNorm = 0;
  if (accords.length > 0) {
    const meanVal = accords.reduce((sum, a) => sum + a.strength, 0) / accords.length;
    for (const a of accords) {
      const centered = a.strength - meanVal;
      centeredAccords.set(a.name, centered);
      accordNorm += centered * centered;
    }
    accordNorm = Math.sqrt(accordNorm);
  }

  const topNotes = (r.notes_top || '').split('|').map(normalizeNote).filter(Boolean);
  const midNotes = (r.notes_middle || '').split('|').map(normalizeNote).filter(Boolean);
  const baseNotes = (r.notes_base || '').split('|').map(normalizeNote).filter(Boolean);
  const flatNotes = (r.notes_flat || '').split('|').map(normalizeNote).filter(Boolean);

  const isFlatOnly = (topNotes.length + midNotes.length + baseNotes.length === 0) && flatNotes.length > 0;
  const isNoNotes = (topNotes.length + midNotes.length + baseNotes.length + flatNotes.length === 0);

  const noteWeights = new Map();
  if (isFlatOnly) {
    for (const n of flatNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.0));
  } else {
    for (const n of topNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.0));
    for (const n of midNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.2));
    for (const n of baseNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.4));
  }

  for (const n of noteWeights.keys()) {
    noteDocFreq.set(n, (noteDocFreq.get(n) || 0) + 1);
  }

  perfumes.set(r.id, {
    id: r.id,
    name: r.name,
    brand: r.brand,
    vote_count: r.vote_count || 0,
    gender: r.gender || '',
    accords,
    centeredAccords,
    accordNorm,
    noteWeights,
    isFlatOnly,
    isNoNotes,
    hasAccords: accords.length > 0
  });
}

const N = perfumes.size;
const noteIDF = new Map();
for (const [n, df] of noteDocFreq) {
  noteIDF.set(n, Math.log(1 + (N - df + 0.5) / (df + 0.5)));
}

// Inverted index for notes and accords
const noteIndex = new Map();
const accordIndex = new Map();

for (const [id, p] of perfumes) {
  let norm = 0;
  for (const [n, w] of p.noteWeights) {
    const idf = noteIDF.get(n) || 1.0;
    const tfidf = w * idf;
    norm += tfidf * tfidf;

    if (!noteIndex.has(n)) noteIndex.set(n, []);
    noteIndex.get(n).push(id);
  }
  p.noteNorm = Math.sqrt(norm);

  for (const a of p.accords) {
    if (!accordIndex.has(a.name)) accordIndex.set(a.name, []);
    accordIndex.get(a.name).push(id);
  }
}

console.log('Indexed notes and accords.');

function getRecommendations(targetId, topK = 20) {
  const target = perfumes.get(targetId);
  if (!target) return [];

  // Multi-signal candidate generation:
  // 1. Inverted index on notes
  const candidateScores = new Map(); // candId -> roughNoteScore
  for (const [n, w] of target.noteWeights) {
    const idf = noteIDF.get(n) || 1.0;
    const postings = noteIndex.get(n);
    if (!postings) continue;
    // Note weight in query
    const queryTerm = w * idf;
    for (let i = 0; i < postings.length; i++) {
      const cid = postings[i];
      if (cid === targetId) continue;
      candidateScores.set(cid, (candidateScores.get(cid) || 0) + queryTerm);
    }
  }

  // 2. Inverted index on top 3 accords (ensures high accord overlap candidates are always retrieved!)
  const topAccords = target.accords.slice(0, 3);
  for (const a of topAccords) {
    const postings = accordIndex.get(a.name);
    if (!postings) continue;
    for (let i = 0; i < postings.length; i++) {
      const cid = postings[i];
      if (cid === targetId) continue;
      // boost candidate existence
      candidateScores.set(cid, (candidateScores.get(cid) || 0) + 1.5);
    }
  }

  // Normalize candidate score by sqrt(cand.noteNorm + 1) to avoid length bias
  const candidatePool = [];
  for (const [cid, rawScore] of candidateScores) {
    const cand = perfumes.get(cid);
    const norm = cand ? Math.max(1, cand.noteNorm) : 1;
    candidatePool.push({ id: cid, score: rawScore / Math.sqrt(norm) });
  }

  candidatePool.sort((a, b) => b.score - a.score);
  // Take top 1,500 candidates for fine-grained ranking
  const topCandidates = candidatePool.slice(0, 1500);

  const results = [];
  const targetAccords = target.centeredAccords;
  const targetAccNorm = target.accordNorm;
  const targetNoteNorm = target.noteNorm;

  for (const c of topCandidates) {
    const cand = perfumes.get(c.id);

    // Note Cosine
    let noteDot = 0;
    for (const [n, w] of target.noteWeights) {
      if (cand.noteWeights.has(n)) {
        const idf = noteIDF.get(n) || 1.0;
        const candW = cand.noteWeights.get(n);
        noteDot += (w * idf) * (candW * idf);
      }
    }
    const noteSim = (targetNoteNorm > 0 && cand.noteNorm > 0) ? (noteDot / (targetNoteNorm * cand.noteNorm)) : 0;

    // Centered Accord Cosine
    let accordSim = 0;
    if (target.hasAccords && cand.hasAccords && targetAccNorm > 0 && cand.accordNorm > 0) {
      let accDot = 0;
      for (const [acc, zVal] of targetAccords) {
        if (cand.centeredAccords.has(acc)) {
          accDot += zVal * cand.centeredAccords.get(acc);
        }
      }
      accordSim = accDot / (targetAccNorm * cand.accordNorm);
      accordSim = Math.max(0, (accordSim + 1) / 2);
    } else {
      accordSim = noteSim;
    }

    const contentScore = (target.hasAccords && cand.hasAccords)
      ? (0.50 * noteSim + 0.50 * accordSim)
      : noteSim;

    // Tiny vote tie-breaker
    const tieBreaker = Math.log10(Math.max(1, cand.vote_count)) * 1e-6;
    const finalScore = contentScore + tieBreaker;

    results.push({
      id: cand.id,
      name: cand.name,
      brand: cand.brand,
      score: finalScore,
      noteSim,
      accordSim
    });
  }

  results.sort((a, b) => b.score - a.score);

  // Brand diversity cap: max 2 per brand in top 10
  const finalTop = [];
  const brandCount = new Map();
  for (const r of results) {
    const b = r.brand || '';
    const count = brandCount.get(b) || 0;
    if (count < 2) {
      finalTop.push(r);
      brandCount.set(b, count + 1);
      if (finalTop.length >= topK) break;
    }
  }

  return finalTop;
}

console.log('\n--- EVALUATING KEY ACCEPTANCE PAIRS ---');
function checkPair(qId, targetId, qName, tName, maxRank = 10) {
  const recs = getRecommendations(qId, 30);
  const rank = recs.findIndex(r => r.id === targetId) + 1;
  const inTop = rank > 0 && rank <= maxRank;
  console.log(`Query ${qName} (ID: ${qId}) -> Looking for ${tName} (ID: ${targetId}):`);
  console.log(`  Rank: ${rank > 0 ? rank : 'NOT in Top 30'} | Pass <= ${maxRank}? ${inTop ? '✓ PASS' : '✗ FAIL'}`);
  if (rank > 0) {
    const item = recs[rank - 1];
    console.log(`  Details: score: ${item.score.toFixed(4)} | noteSim: ${item.noteSim.toFixed(4)} | accordSim: ${item.accordSim.toFixed(4)}`);
  }
}

// 1. SNOI (68271) -> Creed Aventus (9828) & Nishane Hacivat (44174) in Top 10
checkPair(68271, 9828, 'SNOI', 'Creed Aventus', 10);
checkPair(68271, 44174, 'SNOI', 'Nishane Hacivat', 10);

// 2. Turathi Electric (108244) -> Ex Nihilo Blue Talisman (84224) in Top 10
checkPair(108244, 84224, 'Turathi Electric', 'Blue Talisman', 10);

// 3. Reverse: Creed Aventus (9828) -> SNOI (68271) in Top 20
checkPair(9828, 68271, 'Creed Aventus', 'SNOI', 20);

// 4. Reverse: Blue Talisman (84224) -> Turathi Electric (108244) in Top 20
checkPair(84224, 108244, 'Blue Talisman', 'Turathi Electric', 20);
