const { hexToLab, ciede2000 } = require("./ciede2000");
const { PAL, DEF } = require("./verify-palette");

const allPairs = { ...PAL, DEF };
const names = Object.keys(allPairs);

console.log(`Checking CIEDE2000 distance for ${names.length} colors (${(names.length * (names.length - 1)) / 2} pairs)...`);

const below12 = [];

for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const n1 = names[i];
    const n2 = names[j];
    const c1 = allPairs[n1][0];
    const c2 = allPairs[n2][0];
    const lab1 = hexToLab(c1);
    const lab2 = hexToLab(c2);
    const de = ciede2000(lab1, lab2);

    if (de < 12) {
      below12.push({
        pair: `${n1} (${c1}) vs ${n2} (${c2})`,
        de: de.toFixed(2),
        n1,
        n2,
        val: de,
      });
    }
  }
}

below12.sort((a, b) => a.val - b.val);

console.log(`\nFound ${below12.length} pairs below DeltaE 12:`);
for (const item of below12) {
  console.log(`  ΔE = ${item.de.padStart(5)} : ${item.pair}`);
}
