const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (item.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const chunksDir = path.join(__dirname, '..', '.next', 'static', 'chunks');
if (!fs.existsSync(chunksDir)) {
  console.error('Chunks dir does not exist! Run npm run build first.');
  process.exit(1);
}

const files = getAllJsFiles(chunksDir);
const chunkSizes = [];

for (const file of files) {
  const content = fs.readFileSync(file);
  const gz = zlib.gzipSync(content);
  const relPath = path.relative(path.join(__dirname, '..', '.next'), file);
  chunkSizes.push({
    file: relPath.replace(/\\/g, '/'),
    rawBytes: content.length,
    rawKb: Number((content.length / 1024).toFixed(2)),
    gzipBytes: gz.length,
    gzipKb: Number((gz.length / 1024).toFixed(2))
  });
}

chunkSizes.sort((a, b) => b.gzipBytes - a.gzipBytes);

console.log('=== 10 LARGEST CLIENT CHUNKS (GZIP) ===');
console.table(chunkSizes.slice(0, 10));

// Check if any chunk contains catalog-sized data (> 500 KB or 131k records)
console.log('\n--- Catalog Hydration Safety Check ---');
const largeChunks = chunkSizes.filter(c => c.gzipKb > 150);
if (largeChunks.length === 0) {
  console.log('✓ PASS: Zero client chunks exceed 150 KB gzip. No catalog-sized data ships to client.');
} else {
  console.log('⚠ Found chunks > 150 KB:', largeChunks);
}

// Check initial entrypoints for home page
const manifestPath = path.join(__dirname, '..', '.next', 'build-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('\n--- Entrypoint / Client JS for "/" ---');
  const homeFiles = manifest.pages?.['/'] || [];
  let homeGzipTotal = 0;
  for (const hf of homeFiles) {
    const hp = path.join(__dirname, '..', '.next', hf);
    if (fs.existsSync(hp)) {
      const gz = zlib.gzipSync(fs.readFileSync(hp));
      homeGzipTotal += gz.length;
      console.log(`  ${hf}: ${(gz.length / 1024).toFixed(2)} KB gzip`);
    }
  }
  console.log(`Total Initial JS for home: ${(homeGzipTotal / 1024).toFixed(2)} KB gzip (Gate: <= 150 KB)`);
}
