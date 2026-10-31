const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../.next/static/chunks");
const modernChunks = [
  "310vm2bl3xxpt.js",
  "19mx3mg6lkumu.js",
  "turbopack-30koqklv8_-oi.js",
  "3fntmmi971322.js",
  "2-rtuqsgzmno4.js",
  "1ynxn45eoospl.js",
  "00t4s12d6xwn0.js",
  "1mh6a-0e61pyc.js",
];

let totalGzip = 0;
let totalRaw = 0;

console.log("=== Modern Browser JS Chunks (Gzip Compressed) ===");
for (const file of modernChunks) {
  const buf = fs.readFileSync(path.join(dir, file));
  const gz = zlib.gzipSync(buf);
  totalRaw += buf.length;
  totalGzip += gz.length;
  console.log(`  ${file}: ${(gz.length / 1024).toFixed(1)} KB gzip (${(buf.length / 1024).toFixed(1)} KB raw)`);
}

console.log("--------------------------------------------------");
console.log(`Total Modern Raw : ${(totalRaw / 1024).toFixed(1)} KB`);
console.log(`Total Modern Gzip: ${(totalGzip / 1024).toFixed(1)} KB (Budget: <= 150 KB)`);
