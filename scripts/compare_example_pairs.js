const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

function parseAccords(accStr) {
  if (!accStr) return new Map();
  const m = new Map();
  for (const part of accStr.split('|')) {
    const [name, val] = part.split(':');
    if (name) m.set(name.trim().toLowerCase(), Number(val) || 0);
  }
  return m;
}

function parseNotes(r) {
  return {
    top: (r.notes_top || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean),
    middle: (r.notes_middle || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean),
    base: (r.notes_base || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean),
    flat: (r.notes_flat || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean),
    all: [r.notes_top, r.notes_middle, r.notes_base, r.notes_flat].filter(Boolean).join('|').split('|').map(s => s.trim().toLowerCase()).filter(Boolean)
  };
}

function computeNoteJaccard(notesA, notesB) {
  const setA = new Set(notesA);
  const setB = new Set(notesB);
  const inter = [...setA].filter(n => setB.has(n));
  const union = new Set([...setA, ...setB]);
  return {
    shared: inter,
    uniqueA: [...setA].filter(n => !setB.has(n)),
    uniqueB: [...setB].filter(n => !setA.has(n)),
    jaccard: union.size > 0 ? (inter.length / union.size) : 0,
    interCount: inter.length,
    unionCount: union.size
  };
}

function computeAccordCosineAndWJaccard(mapA, mapB) {
  const allAccords = new Set([...mapA.keys(), ...mapB.keys()]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  let inter = 0;
  let uni = 0;

  for (const acc of allAccords) {
    const vA = mapA.get(acc) || 0;
    const vB = mapB.get(acc) || 0;
    dot += vA * vB;
    magA += vA * vA;
    magB += vB * vB;
    inter += Math.min(vA, vB);
    uni += Math.max(vA, vB);
  }

  const cosine = (magA > 0 && magB > 0) ? (dot / (Math.sqrt(magA) * Math.sqrt(magB))) : 0;
  const weightedJaccard = uni > 0 ? (inter / uni) : 0;
  return { cosine, weightedJaccard, sharedAccords: [...allAccords].filter(a => mapA.has(a) && mapB.has(a)) };
}

function compare(idA, idB) {
  const pA = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(idA);
  const pB = db.prepare("SELECT * FROM perfumes WHERE id = ?").get(idB);

  const notesA = parseNotes(pA);
  const notesB = parseNotes(pB);
  const accordsA = parseAccords(pA.accords);
  const accordsB = parseAccords(pB.accords);

  const noteComp = computeNoteJaccard(notesA.all, notesB.all);
  const accComp = computeAccordCosineAndWJaccard(accordsA, accordsB);

  return {
    a: { id: pA.id, name: pA.name, brand: pA.brand, notes: notesA, accords: pA.accords },
    b: { id: pB.id, name: pB.name, brand: pB.brand, notes: notesB, accords: pB.accords },
    noteComp,
    accComp
  };
}

console.log("=================================================");
console.log("PAIR 1: Afnan Supremacy NOI (68271) vs Creed Aventus (9828)");
console.log("=================================================");
const c1 = compare(68271, 9828);
console.log("Supremacy NOI Notes:", c1.a.notes);
console.log("Creed Aventus Notes:", c1.b.notes);
console.log("Shared Notes:", c1.noteComp.shared);
console.log("Supremacy Only:", c1.noteComp.uniqueA);
console.log("Aventus Only:", c1.noteComp.uniqueB);
console.log(`Note Jaccard: ${(c1.noteComp.jaccard * 100).toFixed(1)}% (${c1.noteComp.interCount} / ${c1.noteComp.unionCount})`);
console.log(`Accord Weighted Jaccard: ${(c1.accComp.weightedJaccard * 100).toFixed(1)}%`);
console.log(`Accord Cosine: ${(c1.accComp.cosine * 100).toFixed(1)}%`);
console.log("Shared Accords:", c1.accComp.sharedAccords);

console.log("\n=================================================");
console.log("PAIR 2: Afnan Supremacy NOI (68271) vs Nishane Hacivat (44174)");
console.log("=================================================");
const c2 = compare(68271, 44174);
console.log("Supremacy NOI Notes:", c2.a.notes);
console.log("Nishane Hacivat Notes:", c2.b.notes);
console.log("Shared Notes:", c2.noteComp.shared);
console.log("Supremacy Only:", c2.noteComp.uniqueA);
console.log("Hacivat Only:", c2.noteComp.uniqueB);
console.log(`Note Jaccard: ${(c2.noteComp.jaccard * 100).toFixed(1)}% (${c2.noteComp.interCount} / ${c2.noteComp.unionCount})`);
console.log(`Accord Weighted Jaccard: ${(c2.accComp.weightedJaccard * 100).toFixed(1)}%`);
console.log(`Accord Cosine: ${(c2.accComp.cosine * 100).toFixed(1)}%`);
console.log("Shared Accords:", c2.accComp.sharedAccords);

console.log("\n=================================================");
console.log("PAIR 3: Afnan Turathi Electric (108244) vs Ex Nihilo Blue Talisman (84224)");
console.log("=================================================");
const c3 = compare(108244, 84224);
console.log("Turathi Electric Notes:", c3.a.notes);
console.log("Blue Talisman Notes:", c3.b.notes);
console.log("Shared Notes:", c3.noteComp.shared);
console.log("Turathi Electric Only:", c3.noteComp.uniqueA);
console.log("Blue Talisman Only:", c3.noteComp.uniqueB);
console.log(`Note Jaccard: ${(c3.noteComp.jaccard * 100).toFixed(1)}% (${c3.noteComp.interCount} / ${c3.noteComp.unionCount})`);
console.log(`Accord Weighted Jaccard: ${(c3.accComp.weightedJaccard * 100).toFixed(1)}%`);
console.log(`Accord Cosine: ${(c3.accComp.cosine * 100).toFixed(1)}%`);
console.log("Shared Accords:", c3.accComp.sharedAccords);
