const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

// Let's find descriptions where the text specifically mentions other perfume brands or perfume names!
// e.g., houses like The Dua Brand, Alexandria Fragrances, Oakcha, Dossier, Lattafa, Armaf, Afnan, Chez Pierre, Milton Lloyd, Zara, etc.
// or phrases like "inspired by Aventus", "impression of Baccarat Rouge", "alternative to Tom Ford", "clone of", "dupe of"

const cloneKeywords = [
  "inspired by", "alternative to", "similar to", "smells like", "reminiscent of",
  "clone", "dupe", "if you like", "impression of", "rendition of", "version of",
  "take on", "twist on", "interpretation of"
];

// Let's search across all rows
console.log("Searching for clone/dupe descriptions that reference other fragrances...");

const cloneHouses = [
  "The Dua Brand", "Alexandria Fragrances", "Oakcha", "Dossier", "Montagne Parfums",
  "Alt Fragrances", "Chez Pierre", "Julianna's Perfumes", "Baruti", "Be Layered",
  "Divain", "Perfume Parlour", "Eden Perfumes", "La Rive", "Maison Alhambra",
  "Fragrance World", "Paris Corner", "Afnan", "Armaf", "Lattafa Perfumes"
];

const found = [];

// First check known clone brands
for (const ch of cloneHouses) {
  const rows = db.prepare("SELECT id, slug, name, brand, description FROM perfumes WHERE brand LIKE ? AND description != ''").all(`%${ch}%`);
  for (const r of rows) {
    const d = r.description;
    for (const kw of cloneKeywords) {
      const idx = d.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        // Check if there is a capitalized word or perfume reference near it
        const slice = d.slice(idx, idx + 100);
        found.push({ ...r, kw, slice });
        break;
      }
    }
    if (found.length >= 30) break;
  }
  if (found.length >= 30) break;
}

// Also check general mentions of iconic perfumes like Aventus, Baccarat, Sauvage, Lost Cherry, Angels' Share, etc. in any perfume's description
const iconicNames = ["Aventus", "Baccarat Rouge", "Sauvage", "Lost Cherry", "Angels' Share", "Tuscan Leather", "Layton", "Blue Talisman", "Hacivat", "Green Irish Tweed", "Black Phantom", "Tobacco Vanille", "Delina"];
for (const icon of iconicNames) {
  const rows = db.prepare("SELECT id, slug, name, brand, description FROM perfumes WHERE description LIKE ? AND brand NOT LIKE ?").all(`%${icon}%`, `%${icon.split(' ')[0]}%`);
  for (const r of rows) {
    if (found.find(f => f.id === r.id)) continue;
    found.push({ ...r, kw: `mentions ${icon}`, slice: r.description.slice(0, 150) });
  }
}

console.log(`Total found references: ${found.length}`);

for (let i = 0; i < Math.min(found.length, 30); i++) {
  const f = found[i];
  console.log(`\n[#${i+1}] ${f.name} (${f.brand}) [ID: ${f.id}]`);
  console.log(`Keyword: ${f.kw}`);
  console.log(`Description: ${f.description.slice(0, 200)}...`);
}
