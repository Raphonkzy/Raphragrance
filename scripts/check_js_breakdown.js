const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const dir = path.join(__dirname, "../.next/static/chunks");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));

console.log("=== ALL STATIC CHUNKS GZIP SIZES ===");
let totalAllGzip = 0;
let totalInitialGzip = 0;

for (const file of files) {
  const buf = fs.readFileSync(path.join(dir, file));
  const rawKb = buf.length / 1024;
  const gzipKb = zlib.gzipSync(buf).length / 1024;
  totalAllGzip += gzipKb;

  const isNoModule = file === "0cz1d0mv5g_q7.js";
  if (!isNoModule) {
    totalInitialGzip += gzipKb;
  }
  console.log(`  ${file.padEnd(30)} : raw ${rawKb.toFixed(1).padStart(5)} KB | gzip ${gzipKb.toFixed(1).padStart(5)} KB ${isNoModule ? "[noModule polyfill]" : ""}`);
}

console.log(`\nTotal of all JS chunks (gzip): ${totalAllGzip.toFixed(1)} KB`);
console.log(`Total of initial modern JS (excluding noModule): ${totalInitialGzip.toFixed(1)} KB`);
