const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const chunksDir = path.join(__dirname, "../.next/static/chunks");

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = getFiles(chunksDir);

let totalRaw = 0;
let totalGzip = 0;

console.log("Chunk Breakdown:");
for (const file of jsFiles) {
  const content = fs.readFileSync(file);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content).length;
  totalRaw += rawSize;
  totalGzip += gzipSize;
  const rel = path.relative(path.join(__dirname, "../.next/static"), file);
  console.log(`  ${rel}: raw ${(rawSize / 1024).toFixed(1)} KB, gzip ${(gzipSize / 1024).toFixed(1)} KB`);
}

console.log(`\nTOTAL JS: raw ${(totalRaw / 1024).toFixed(1)} KB, gzip ${(totalGzip / 1024).toFixed(1)} KB`);
