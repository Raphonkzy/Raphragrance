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

// Find best colors for a specific accord given a target description
function findBest(targetName, candidates) {
  console.log(`\nEvaluating candidates for ${targetName}:`);
  const valid = [];
  for (const [fill, ink, note] of candidates) {
    if (!verifyContrast(fill, ink)) continue;
    // find min distance to any base color
    let minDe = 999;
    let closestName = "";
    for (const [bName, [bFill]] of Object.entries(BASE_17)) {
      const de = ciede2000(hexToLab(fill), hexToLab(bFill));
      if (de < minDe) {
        minDe = de;
        closestName = bName;
      }
    }
    valid.push({ fill, ink, note, minDe, closestName });
  }

  valid.sort((a, b) => b.minDe - a.minDe);
  for (const v of valid.slice(0, 5)) {
    console.log(
      `  ${v.fill} / ${v.ink} | min ΔE = ${v.minDe.toFixed(2)} (closest to ${v.closestName}) - ${v.note}`
    );
  }
  return valid[0];
}

// 1. Green
findBest("green", [
  ["#4A7822", "#F6FBF0", "olive leaf"],
  ["#44721D", "#F6FAF0", "deep grass olive"],
  ["#3E6B19", "#F6FAF0", "deep leaf"],
  ["#2D6A28", "#F2FAF0", "true forest"],
  ["#1B663E", "#F0FAF4", "emerald pine"],
  ["#417028", "#F5FAF0", "herbal leaf"],
  ["#4E7D1B", "#F7FAF2", "sharp olive leaf"],
  ["#92BA35", "#141D05", "light lime/chartreuse dark ink"],
  ["#8AB32E", "#151F04", "lime leaf dark ink"],
  ["#7EA726", "#151F04", "vivid olive dark ink"],
]);

// 2. Oud
findBest("oud", [
  ["#38242E", "#F6EDF2", "balsamic smoked agarwood purple undertone"],
  ["#3C2226", "#F7ECEE", "dark resin plum"],
  ["#332520", "#F5EEEB", "blackened agarwood"],
  ["#412635", "#F7EDF3", "deep agarwood"],
  ["#34221A", "#F6EDE8", "smoked dark resin"],
  ["#2F2228", "#F4ECEF", "dark violet wood"],
]);

// 3. Patchouli
findBest("patchouli", [
  ["#5F572E", "#F9F6EA", "dried leaf khaki moss"],
  ["#58522A", "#F8F5E9", "dark earthy khaki"],
  ["#665E32", "#FAF6EA", "earthy mossy herb"],
  ["#5B5127", "#F7F4E7", "warm herbal earth"],
  ["#61572C", "#FAF6EB", "mossy root"],
  ["#6D5D2C", "#FAF5E6", "amber moss"],
]);

// 4. Rose
findBest("rose", [
  ["#961A3C", "#FCF0F3", "rich damask rose"],
  ["#8C1836", "#FCF0F3", "deep velvet wine rose"],
  ["#9B1C38", "#FCF0F2", "crimson ruby rose"],
  ["#A41B37", "#FDF0F2", "vibrant deep rose"],
  ["#8F1434", "#FCF0F3", "dark carmine rose"],
  ["#821631", "#FCF0F3", "burgundy rose"],
]);

// 5. Fresh
findBest("fresh", [
  ["#158597", "#EFF9FA", "crisp aqua cyan"],
  ["#188E9B", "#F0FAFC", "vivid arctic cyan"],
  ["#1A94A0", "#F1FBFC", "bright turquoise aqua"],
  ["#127D8F", "#EDF8F9", "deep ocean cyan"],
  ["#197E96", "#EDF8FA", "clear sea cyan"],
]);

// 6. Lavender
findBest("lavender", [
  ["#6E5B8E", "#F7F4FC", "medium herbal lavender"],
  ["#675587", "#F6F3FB", "deep slate lavender"],
  ["#756196", "#F8F5FD", "clear violet lavender"],
  ["#624F80", "#F5F2FA", "dark lavender"],
]);

// 7. Marine
findBest("marine", [
  ["#185873", "#ECF5F8", "deep sea blue"],
  ["#1D5F7C", "#EDF6F9", "ocean navy cyan"],
  ["#16506B", "#EAF3F7", "abyssal blue"],
  ["#1F6684", "#EEF7FA", "deep coastal blue"],
]);
