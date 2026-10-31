const fs = require("fs");
const path = require("path");

const chunksDir = path.join(__dirname, "../.next/static/chunks");
const files = fs.readdirSync(chunksDir).filter((f) => f.endsWith(".js"));

for (const file of files) {
  const content = fs.readFileSync(path.join(chunksDir, file), "utf8");
  // Check modules in chunk
  const matches = [...content.matchAll(/\"([^\"]+\.(?:tsx|ts|js|json))\"/g)].map(
    (m) => m[1]
  );
  console.log(`\n=== ${file} (${(content.length / 1024).toFixed(1)} KB) ===`);
  const unique = [...new Set(matches)].slice(0, 10);
  console.log("Modules:", unique);
}
