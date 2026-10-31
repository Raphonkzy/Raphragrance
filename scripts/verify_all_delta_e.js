const { hexToLab, ciede2000 } = require("./ciede2000");

const PAL = {
  // Greens
  aromatic: ["#3F6F4A", "#F4F7F2"],
  "fresh spicy": ["#1F5D50", "#F2EFE6"],
  green: ["#769E26", "#121A04"],

  // Browns / Resins
  woody: ["#7B4B2A", "#F7EFE6"],
  leather: ["#4A2E22", "#F3E8DF"],
  oud: ["#412635", "#F7EDF3"],
  patchouli: ["#5F572E", "#F9F6EA"],

  // Reds / Oranges
  fruity: ["#E4572E", "#140A05"],
  "warm spicy": ["#A8401F", "#FBF0E8"],

  // Yellows / Golds
  citrus: ["#F0C419", "#1E1800"],
  amber: ["#E0A030", "#1C1406"],
  vanilla: ["#EFE0BC", "#2A2012"],

  // Pinks / Floral
  floral: ["#E58FA8", "#2A0F18"],
  "white floral": ["#F0DDE4", "#2B1A21"],
  sweet: ["#D9577A", "#1A0710"],
  rose: ["#961A3C", "#FCF0F3"],

  // Purples
  powdery: ["#D5C8E0", "#221A2C"],
  lavender: ["#6E5B8E", "#F7F4FC"],

  // Blue-Greys / Aquatics
  aldehydic: ["#CFDBE0", "#14232B"],
  marine: ["#1D5F7C", "#EDF6F9"],
  fresh: ["#62C0D0", "#081F26"],

  // Neutrals & Fallback
  musky: ["#B8A9A0", "#1F1915"],
  smoky: ["#4A4A52", "#F0F0F2"],
  DEF: ["#7E8284", "#0E0E0E"],
};

const NEW_ACCORDS = new Set(["rose", "green", "oud", "lavender", "marine", "fresh", "patchouli"]);

const names = Object.keys(PAL);
const allPairs = [];

for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const n1 = names[i];
    const n2 = names[j];
    const c1 = PAL[n1][0];
    const c2 = PAL[n2][0];
    const de = ciede2000(hexToLab(c1), hexToLab(c2));
    const isNew = NEW_ACCORDS.has(n1) || NEW_ACCORDS.has(n2);
    allPairs.push({ n1, n2, c1, c2, de, isNew });
  }
}

allPairs.sort((a, b) => a.de - b.de);

console.log("=== PAIRS BELOW DeltaE 12 ===");
const below12 = allPairs.filter((p) => p.de < 12);
for (const p of below12) {
  const flag = p.isNew ? "[INVOLVES NEW ACCORD]" : "[PREVIEW BASE PAIR]";
  console.log(`  ΔE = ${p.de.toFixed(2).padStart(5)} : ${p.n1.padEnd(14)} vs ${p.n2.padEnd(14)} ${flag}`);
}

console.log("\n=== MINIMUM DISTANCES FOR EACH NEW ACCORD ===");
for (const newName of NEW_ACCORDS) {
  const pairsForNew = allPairs.filter((p) => p.n1 === newName || p.n2 === newName);
  const closest = pairsForNew[0];
  const other = closest.n1 === newName ? closest.n2 : closest.n1;
  console.log(`  ${newName.padEnd(12)} : min ΔE = ${closest.de.toFixed(2)} (closest to ${other})`);
}
