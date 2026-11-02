const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('data/perfumes.public.db');

// List of required anchor IDs
const anchorIds = [
  9828,   // Aventus
  31861,  // Sauvage
  33519,  // Baccarat Rouge 540
  12201,  // Santal 33
  1825,   // Tobacco Vanille
  17,     // Terre d'Hermes
  43871,  // Delina
  39314,  // Layton
  51411,  // Lost Cherry
  44174,  // Hacivat
  62615,  // Angels' Share
  50757,  // Y Eau de Parfum
  68271,  // Supremacy Not Only Intense
  108244, // Turathi Electric
  84224,  // Blue Talisman
  9099,   // Bleu de Chanel
  50384,  // Cloud
  735,    // Kouros
  43632   // Black Phantom
];

const stmt = db.prepare("SELECT id, slug, name, brand FROM perfumes WHERE id = ?");
const anchors = [];

console.log("=== VERIFYING ANCHOR IDS AGAINST DATABASE ===");
for (const id of anchorIds) {
  const row = stmt.get(id);
  if (!row) {
    throw new Error(`Anchor ID ${id} not found in database!`);
  }
  if (!row.slug || !row.name || !row.brand) {
    throw new Error(`Anchor ID ${id} has incomplete data: ${JSON.stringify(row)}`);
  }
  console.log(`[SQL VERIFIED] ID: ${row.id.toString().padEnd(6)} | Slug: ${row.slug.padEnd(42)} | Brand: ${row.brand.padEnd(25)} | Name: ${row.name}`);
  anchors.push({
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand
  });
}

fs.writeFileSync('data/anchors.json', JSON.stringify(anchors, null, 2), 'utf8');
console.log(`\n✓ Successfully wrote ${anchors.length} anchors to data/anchors.json`);
