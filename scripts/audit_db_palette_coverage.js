const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

// Extract PAL and ACCORD_ALIASES from lib/palette.ts
const paletteContent = fs.readFileSync(path.join(__dirname, "../lib/palette.ts"), "utf-8");

const palMatch = paletteContent.match(/export const PAL: Record<string, \[string, string\]> = ({[\s\S]*?});/);
const aliasMatch = paletteContent.match(/export const ACCORD_ALIASES: Record<string, string> = ({[\s\S]*?});/);

const PAL = eval(`(${palMatch[1]})`);
const ACCORD_ALIASES = eval(`(${aliasMatch[1]})`);

const db = new DatabaseSync(path.join(__dirname, "../data/perfumes.db"));
const rows = db.prepare("SELECT accords FROM perfumes WHERE accords IS NOT NULL AND accords != ''").all();

let totalAccords = 0;
let paletteHits = 0;
let aliasHits = 0;
let fallbackHits = 0;

for (const r of rows) {
  const parts = r.accords.split("|");
  for (const part of parts) {
    if (!part) continue;
    const name = part.split(":")[0]?.trim().toLowerCase();
    if (!name) continue;
    totalAccords++;
    if (PAL[name]) {
      paletteHits++;
    } else if (ACCORD_ALIASES[name]) {
      aliasHits++;
    } else {
      fallbackHits++;
    }
  }
}

const directCoverage = (paletteHits / totalAccords) * 100;
const totalCoverage = ((paletteHits + aliasHits) / totalAccords) * 100;
const fallbackPct = (fallbackHits / totalAccords) * 100;

console.log("==========================================");
console.log(" Database Accord Palette Coverage Audit");
console.log("==========================================");
console.log(`Total database accord occurrences : ${totalAccords.toLocaleString()}`);
console.log(`Direct 24-palette matches         : ${paletteHits.toLocaleString()} (${directCoverage.toFixed(2)}%)`);
console.log(`Aliased matches (16 aliases)      : ${aliasHits.toLocaleString()} (${(aliasHits / totalAccords * 100).toFixed(2)}%)`);
console.log(`Total Palette Coverage            : ${(paletteHits + aliasHits).toLocaleString()} (${totalCoverage.toFixed(2)}%)`);
console.log(`DEF Neutral Fallback              : ${fallbackHits.toLocaleString()} (${fallbackPct.toFixed(2)}%)`);
