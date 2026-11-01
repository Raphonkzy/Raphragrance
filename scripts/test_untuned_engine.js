const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('data/perfumes.db');

console.log('Loading all 131,930 perfumes into memory...');
const t0 = Date.now();
const rows = db.prepare(`
  SELECT id, name, brand, vote_count, accords, notes_top, notes_middle, notes_base, notes_flat, gender
  FROM perfumes
`).all();
console.log(`Loaded ${rows.length} rows in ${Date.now() - t0}ms. Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`);

// 1. Synonym map & normalization for notes
const synonymMap = new Map([
  ['musk', 'musk'],
  ['white musk', 'white musk'],
  ['cedar wood', 'cedar'],
  ['cedarwood', 'cedar'],
  ['virginia cedar', 'virginia cedar'],
  ['atlas cedar', 'atlas cedar'],
  ['bergamote', 'bergamot'],
  ['calabrian bergamot', 'calabrian bergamot'],
  ['patchouly', 'patchouli'],
  ['ambergris', 'ambergris'],
  ['iso e super', 'iso e super'],
  ['oak moss', 'oakmoss'],
  ['bourbon vanilla', 'vanilla'],
  ['madagascar vanilla', 'vanilla'],
  ['tahitian vanilla', 'vanilla']
]);

function normalizeNote(raw) {
  let s = raw.toLowerCase().trim();
  // normalize accents
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // replace dashes/underscores with space
  s = s.replace(/[-_]+/g, ' ');
  // clean punctuation
  s = s.replace(/[^a-z0-9 ]/g, '').trim();
  if (synonymMap.has(s)) return synonymMap.get(s);
  return s;
}

// 2. Parse all notes and accords
const perfumes = new Map();
const noteDocFreq = new Map(); // note -> count of perfumes containing it

for (const r of rows) {
  // Accords
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

  // Centered accord vector
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

  // Notes
  const topNotes = (r.notes_top || '').split('|').map(normalizeNote).filter(Boolean);
  const midNotes = (r.notes_middle || '').split('|').map(normalizeNote).filter(Boolean);
  const baseNotes = (r.notes_base || '').split('|').map(normalizeNote).filter(Boolean);
  const flatNotes = (r.notes_flat || '').split('|').map(normalizeNote).filter(Boolean);

  const isFlatOnly = (topNotes.length + midNotes.length + baseNotes.length === 0) && flatNotes.length > 0;
  const isNoNotes = (topNotes.length + midNotes.length + baseNotes.length + flatNotes.length === 0);

  // Note weights: Pyramid: top 1.0, mid 1.2, base 1.4. Flat: 1.0.
  const noteWeights = new Map();
  if (isFlatOnly) {
    for (const n of flatNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.0));
  } else {
    for (const n of topNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.0));
    for (const n of midNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.2));
    for (const n of baseNotes) noteWeights.set(n, Math.max(noteWeights.get(n) || 0, 1.4));
  }

  // Update doc frequencies
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

console.log(`Parsed ${perfumes.size} perfumes, ${noteDocFreq.size} unique notes.`);

// 3. Compute note IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
const N = perfumes.size;
const noteIDF = new Map();
for (const [n, df] of noteDocFreq) {
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  noteIDF.set(n, idf);
}

// 4. Compute note vector norm for each perfume
// Inverted index for fast candidate retrieval: note -> array of perfume IDs
const noteIndex = new Map();

for (const [id, p] of perfumes) {
  let norm = 0;
  for (const [n, w] of p.noteWeights) {
    const idf = noteIDF.get(n) || 1.0;
    const tfidf = w * idf;
    norm += tfidf * tfidf;

    // Add to inverted index if IDF is reasonable (skip top 5 absolute filler notes if any)
    if (!noteIndex.has(n)) noteIndex.set(n, []);
    noteIndex.get(n).push(id);
  }
  p.noteNorm = Math.sqrt(norm);
}

console.log(`Inverted note index built. Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`);

// 5. Query function
function getUntunedRecommendations(targetId, topK = 10) {
  const target = perfumes.get(targetId);
  if (!target) return [];

  // Candidate generation via inverted index:
  // Gather perfumes that share at least 2 notes (or 1 rare note with IDF >= 4.0)
  const candidateScores = new Map(); // candId -> dotProduct
  
  for (const [n, w] of target.noteWeights) {
    const idf = noteIDF.get(n) || 1.0;
    const targetVal = w * idf;
    const postings = noteIndex.get(n);
    if (!postings) continue;

    // If note is ultra-frequent (e.g. df > 25,000 like musk/bergamot), still process but with lower impact
    for (let i = 0; i < postings.length; i++) {
      const candId = postings[i];
      if (candId === targetId) continue;
      candidateScores.set(candId, (candidateScores.get(candId) || 0) + targetVal);
    }
  }

  // Filter candidates with sufficient overlap (e.g. top 500 candidate pool)
  const candidatePool = [];
  for (const [candId, dot] of candidateScores) {
    candidatePool.push({ id: candId, roughScore: dot });
  }
  candidatePool.sort((a, b) => b.roughScore - a.roughScore);
  const topCandidates = candidatePool.slice(0, 400);

  // Detailed scoring
  const results = [];
  const targetAccords = target.centeredAccords;
  const targetAccNorm = target.accordNorm;
  const targetNoteNorm = target.noteNorm;

  for (const c of topCandidates) {
    const cand = perfumes.get(c.id);

    // 1. Note Cosine Similarity
    let noteDot = 0;
    for (const [n, w] of target.noteWeights) {
      if (cand.noteWeights.has(n)) {
        const idf = noteIDF.get(n) || 1.0;
        const candW = cand.noteWeights.get(n);
        noteDot += (w * idf) * (candW * idf);
      }
    }
    const noteSim = (targetNoteNorm > 0 && cand.noteNorm > 0) ? (noteDot / (targetNoteNorm * cand.noteNorm)) : 0;

    // 2. Centered Accord Cosine Similarity
    let accordSim = 0;
    if (target.hasAccords && cand.hasAccords && targetAccNorm > 0 && cand.accordNorm > 0) {
      let accDot = 0;
      for (const [acc, zVal] of targetAccords) {
        if (cand.centeredAccords.has(acc)) {
          accDot += zVal * cand.centeredAccords.get(acc);
        }
      }
      accordSim = accDot / (targetAccNorm * cand.accordNorm);
      // Bound to [-1, 1], then normalize to [0, 1]
      accordSim = Math.max(0, (accordSim + 1) / 2);
    } else {
      accordSim = noteSim; // fallback when accords are absent
    }

    // 3. Combined Content Score
    const contentScore = (target.hasAccords && cand.hasAccords)
      ? (0.55 * noteSim + 0.45 * accordSim)
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

  // Apply brand diversity cap: max 2 per brand in top 10
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

// Test target checks:
// 1. Supremacy Not Only Intense (68271)
// 2. Turathi Electric (108244)
// 3. Creed Aventus (9828)
// 4. Blue Talisman (84224)
console.log('\n--- TEST ACCEPTANCE TARGETS (UNTUNED) ---');
const snoiRecs = getUntunedRecommendations(68271, 20);
console.log('Query: Afnan Supremacy Not Only Intense (68271)');
snoiRecs.slice(0, 10).forEach((r, i) => console.log(`  ${i+1}. ${r.name} (${r.brand}) [ID: ${r.id}] score: ${r.score.toFixed(4)}`));
console.log('  -> Contains Creed Aventus (9828)?', snoiRecs.some(r => r.id === 9828));
console.log('  -> Contains Nishane Hacivat (44174)?', snoiRecs.some(r => r.id === 44174));

const teRecs = getUntunedRecommendations(108244, 20);
console.log('\nQuery: Afnan Turathi Electric (108244)');
teRecs.slice(0, 10).forEach((r, i) => console.log(`  ${i+1}. ${r.name} (${r.brand}) [ID: ${r.id}] score: ${r.score.toFixed(4)}`));
console.log('  -> Contains Ex Nihilo Blue Talisman (84224)?', teRecs.some(r => r.id === 84224));

const avRecs = getUntunedRecommendations(9828, 20);
console.log('\nQuery: Creed Aventus (9828) Top 20');
console.log('  -> Contains Supremacy Not Only Intense (68271) in Top 20?', avRecs.some(r => r.id === 68271));

const btRecs = getUntunedRecommendations(84224, 20);
console.log('\nQuery: Ex Nihilo Blue Talisman (84224) Top 20');
console.log('  -> Contains Turathi Electric (108244) in Top 20?', btRecs.some(r => r.id === 108244));
