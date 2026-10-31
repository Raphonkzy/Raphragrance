const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "../data/perfumes.db"));
console.log("Creating idx_slug...");
const t0 = performance.now();
db.exec("CREATE INDEX IF NOT EXISTS idx_slug ON perfumes(slug);");
console.log(`Index created in ${(performance.now() - t0).toFixed(2)}ms`);

// Test slug lookup now
const t1 = performance.now();
const row = db.prepare("SELECT id, name, brand FROM perfumes WHERE slug = ?").get("Dior/Sauvage");
console.log(`Indexed slug lookup: ${(performance.now() - t1).toFixed(3)}ms, found: ${row?.brand} ${row?.name}`);
