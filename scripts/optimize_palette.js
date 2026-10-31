const { hexToLab, ciede2000, hexToRgb } = require("./ciede2000");
const { srgbLuminance, contrast, colorMix, TOKENS } = require("./verify-palette");

const BASE_17 = {
  aromatic: ["#3F6F4A", "#F4F7F2"],
  "fresh spicy": ["#1F5D50", "#F2EFE6"],
  woody: ["#7B4B2A", "#F7EFE6"],
  leather: ["#4A2E22", "#F3E8DF"],
  coffee: ["#3A2418", "#F3E6DA"],
  fruity: ["#E4572E", "#140A05"],
  "warm spicy": ["#A8401F", "#FBF0E8"],
  citrus: ["#F0C419", "#1E1800"],
  amber: ["#E0A030", "#1C1406"],
  vanilla: ["#EFE0BC", "#2A2012"],
  floral: ["#E58FA8", "#2A0F18"],
  "white floral": ["#F0DDE4", "#2B1A21"],
  sweet: ["#D9577A", "#1A0710"],
  powdery: ["#D5C8E0", "#221A2C"],
  aldehydic: ["#CFDBE0", "#14232B"],
  musky: ["#B8A9A0", "#1F1915"],
  smoky: ["#4A4A52", "#F0F0F2"],
  DEF: ["#D9D9D4", "#161614"],
};

function verifyContrast(fill, ink) {
  const cRgb = hexToRgb(fill);
  const iRgb = hexToRgb(ink);

  const crInk = contrast(iRgb, cRgb);
  const crTopL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 18));
  const crHrtL = contrast(hexToRgb(TOKENS.light.tx), colorMix(fill, TOKENS.light.bg, 36));
  const crTopD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 18));
  const crHrtD = contrast(hexToRgb(TOKENS.dark.tx), colorMix(fill, TOKENS.dark.bg, 36));

  return (
    crInk >= 4.5 &&
    crTopL >= 4.5 &&
    crHrtL >= 4.5 &&
    crTopD >= 4.5 &&
    crHrtD >= 4.5
  );
}

function evaluatePalette(new7) {
  const full = { ...BASE_17, ...new7 };
  const names = Object.keys(full);
  const conflicts = [];
  let minDistanceNew = 999;

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const n1 = names[i];
      const n2 = names[j];
      const c1 = full[n1][0];
      const c2 = full[n2][0];
      const de = ciede2000(hexToLab(c1), hexToLab(c2));

      // Check if this pair involves at least one of the 7 new accords
      const isNewPair = (n1 in new7) || (n2 in new7);
      if (isNewPair && de < minDistanceNew) {
        minDistanceNew = de;
      }

      if (de < 12) {
        conflicts.push({ n1, n2, c1, c2, de, isNewPair });
      }
    }
  }

  // Also verify contrast for each new accord
  for (const [name, [fill, ink]] of Object.entries(new7)) {
    if (!verifyContrast(fill, ink)) {
      return { ok: false, reason: `Contrast failed for ${name} (${fill}, ${ink})` };
    }
  }

  return { ok: true, conflicts, minDistanceNew };
}

// Let's test a candidate set of 7 new accords:
// 1. rose: rich velvet damask rose/crimson (e.g. #8C1D40 or #941B3C)
// 2. green: vivid leaf green (e.g. #5B8C32 or #52822B)
// 3. oud: dark smoky balsamic resin wood (e.g. #3D2633 - agarwood with smoky dark violet undertone, or #38242A)
// 4. lavender: clear medium herbal lavender (e.g. #6F5E8E)
// 5. marine: deep sea ocean blue (e.g. #1E5C77)
// 6. fresh: crisp vibrant cyan / aqua (e.g. #1B8E9B or #228D9E)
// 7. patchouli: earthy dried-leaf khaki olive brown (e.g. #635A36 or #5E5632)

const candidates = {
  rose: ["#961C3C", "#FCF0F3"],
  green: ["#57852E", "#F4F8EE"],
  oud: ["#3B2530", "#F6EAEF"],
  lavender: ["#6F5C8C", "#F8F5FD"],
  marine: ["#1B5B75", "#EDF6F9"],
  fresh: ["#188698", "#EEF8FA"],
  patchouli: ["#635832", "#FBF7EB"],
};

const res = evaluatePalette(candidates);
console.log("Evaluation result:", res.ok ? "CONTRAST PASS" : res.reason);
if (res.ok) {
  console.log(`Min DeltaE involving new accords: ${res.minDistanceNew.toFixed(2)}`);
  console.log(`Conflicts involving new accords (< 12):`);
  const newConflicts = res.conflicts.filter(c => c.isNewPair);
  if (newConflicts.length === 0) {
    console.log("  NONE! All new accords have DeltaE >= 12 against ALL other colors!");
  } else {
    for (const c of newConflicts) {
      console.log(`  ΔE = ${c.de.toFixed(2).padStart(5)} : ${c.n1} (${c.c1}) vs ${c.n2} (${c.c2})`);
    }
  }
}
