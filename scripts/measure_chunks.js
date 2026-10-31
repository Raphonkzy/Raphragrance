const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const staticDir = path.join(__dirname, "../.next/static/chunks");

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}

const files = getFiles(staticDir);
console.log("Chunk sizes (raw vs gzip):\n");

let totalRaw = 0;
let totalGzip = 0;
let modernGzip = 0;

for (const f of files) {
  const content = fs.readFileSync(f);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content).length;
  const rel = path.relative(staticDir, f);
  const isPolyfill = rel.includes("0cz1d0mv5g_q7");

  totalRaw += rawSize;
  totalGzip += gzipSize;
  if (!isPolyfill) {
    modernGzip += gzipSize;
  }

  console.log(`${rel.padEnd(45, " ")} | raw: ${(rawSize / 1024).toFixed(1).padStart(6, " ")} KB | gzip: ${(gzipSize / 1024).toFixed(1).padStart(5, " ")} KB ${isPolyfill ? "(nomodule polyfill)" : ""}`);
}

console.log("\n-----------------------------------------------------------");
console.log(`Modern JS (excluding polyfill): ${(modernGzip / 1024).toFixed(2)} KB gzip (Budget: <= 150 KB)`);
console.log(`Total JS (including polyfill) : ${(totalGzip / 1024).toFixed(2)} KB gzip`);
console.log(`Budget Status                  : ${modernGzip / 1024 <= 150 ? "PASS" : "FAIL"}`);
