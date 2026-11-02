const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const parsedBase = new URL(BASE_URL);
const HOST = parsedBase.hostname;
const PORT = parsedBase.port || (parsedBase.protocol === 'https:' ? 443 : 80);

const dbPath = path.join(__dirname, '..', 'data', 'perfumes.public.db');
const db = new DatabaseSync(dbPath, { open: true, readOnly: true });

// Build stratified pool of URLs
console.log('Building stratified URL test target pool...');

const popular = db.prepare('SELECT slug FROM perfumes WHERE vote_count >= 500 ORDER BY vote_count DESC LIMIT 500').all();
const mid = db.prepare('SELECT slug FROM perfumes WHERE vote_count >= 50 AND vote_count < 500 LIMIT 500').all();
const longTail = db.prepare('SELECT slug FROM perfumes WHERE vote_count >= 1 AND vote_count < 50 LIMIT 500').all();
const clones = db.prepare("SELECT slug FROM perfumes WHERE brand IN ('Afnan', 'Armaf', 'Lattafa Perfumes', 'Maison Alhambra', 'Rasasi', 'Paris Corner', 'Al Haramain Perfumes') LIMIT 500").all();
const brands = db.prepare('SELECT DISTINCT brand FROM perfumes WHERE vote_count >= 50 LIMIT 150').all();
const notes = [
  'Vanilla', 'Bergamot', 'Amber', 'Musk', 'Rose', 'Oud', 'Cedar', 'Patchouli', 'Lavender', 'Vetiver',
  'Sandalwood', 'Cardamom', 'Iris', 'Tonka Bean', 'Leather', 'Lemon', 'Neroli', 'Jasmine', 'Tobacco', 'Pink Pepper',
  'Cinnamon', 'Apple', 'Grapefruit', 'Mint', 'Ginger', 'Incense', 'Mandarin Orange', 'Violet', 'Orange Blossom', 'Benzoin',
  'Cacao', 'Coffee', 'Saffron', 'Nutmeg', 'Labdanum', 'Pine', 'Myrrh', 'Elemi', 'Basil', 'Black Pepper',
  'Ylang-Ylang', 'Peach', 'Plum', 'Coconut', 'Raspberry', 'Fig', 'Almond', 'Caramel', 'Honey', 'Oakmoss'
];
const accords = [
  'woody', 'citrus', 'aromatic', 'sweet', 'amber', 'floral', 'fresh spicy', 'warm spicy', 'powdery', 'vanilla',
  'musky', 'fruity', 'white floral', 'earthy', 'green', 'balsamic', 'leather', 'aquatic', 'animalic', 'smoky',
  'rose', 'aldehydic', 'mossy', 'patchouli', 'herbal', 'cinnamon', 'fresh', 'oud', 'tropical', 'iris'
];

const testUrls = [];

// Static & Core endpoints
testUrls.push({ url: '/', expectedStatus: 200, category: 'Core Page' });
testUrls.push({ url: '/brands', expectedStatus: 200, category: 'Core Page' });
testUrls.push({ url: '/notes', expectedStatus: 200, category: 'Core Page' });
testUrls.push({ url: '/accords', expectedStatus: 200, category: 'Core Page' });
testUrls.push({ url: '/healthz', expectedStatus: 200, category: 'Health & System' });
testUrls.push({ url: '/api/health', expectedStatus: 200, category: 'Health & System' });
testUrls.push({ url: '/robots.txt', expectedStatus: 200, category: 'SEO' });
testUrls.push({ url: '/sitemap.xml', expectedStatus: 200, category: 'SEO' });

// 404 Tests
testUrls.push({ url: '/fragrance/nonexistent-brand/nonexistent-perfume-404-test', expectedStatus: 404, category: '404 Edge Case' });
testUrls.push({ url: '/brand/NonexistentBrandXYZ123456', expectedStatus: 404, category: '404 Edge Case' });

// Detail Fragrance Pages (800 total)
popular.forEach(r => testUrls.push({ url: `/fragrance/${r.slug}`, expectedStatus: 200, category: 'Detail Popular' }));
mid.forEach(r => testUrls.push({ url: `/fragrance/${r.slug}`, expectedStatus: 200, category: 'Detail Mid' }));
longTail.forEach(r => testUrls.push({ url: `/fragrance/${r.slug}`, expectedStatus: 200, category: 'Detail Long-Tail' }));
clones.forEach(r => testUrls.push({ url: `/fragrance/${r.slug}`, expectedStatus: 200, category: 'Detail Clone Houses' }));

// Brand Pages (50)
brands.forEach(r => testUrls.push({ url: `/brand/${encodeURIComponent(r.brand)}`, expectedStatus: 200, category: 'Brand Page' }));

// Search & Filter queries (40)
notes.forEach(n => testUrls.push({ url: `/?q=${encodeURIComponent(n)}`, expectedStatus: 200, category: 'Search Query' }));
accords.forEach(a => testUrls.push({ url: `/?accord=${encodeURIComponent(a)}`, expectedStatus: 200, category: 'Accord Filter' }));

db.close();

console.log(`Generated ${testUrls.length} total URLs for QA crawl.`);

function fetchUrl(target) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.get(
      {
        host: HOST,
        port: PORT,
        path: target.url,
        headers: {
          'User-Agent': 'Raphragrance-QA-Crawler/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml,application/json,*/*'
        },
        timeout: 10000
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          const duration = performance.now() - start;
          resolve({
            url: target.url,
            category: target.category,
            expected: target.expectedStatus,
            status: res.statusCode,
            duration,
            bodyLength: body.length,
            success: res.statusCode === target.expectedStatus
          });
        });
      }
    );

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        url: target.url,
        category: target.category,
        expected: target.expectedStatus,
        status: 0,
        error: err.message,
        duration,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        url: target.url,
        category: target.category,
        expected: target.expectedStatus,
        status: 408,
        error: 'Timeout',
        duration,
        success: false
      });
    });
  });
}

async function runCrawl() {
  console.log(`\nStarting HTTP Crawl across ${testUrls.length} URLs with concurrency 15...\n`);
  const concurrency = 15;
  const results = [];
  let index = 0;
  const startTime = Date.now();

  async function worker() {
    while (index < testUrls.length) {
      const current = testUrls[index++];
      const res = await fetchUrl(current);
      results.push(res);
      if (results.length % 100 === 0 || results.length === testUrls.length) {
        process.stdout.write(`\rProgress: ${results.length} / ${testUrls.length} checked...`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTime = Date.now() - startTime;
  console.log('\n\n=== GATE 6.2: HTTP CRAWL QA RESULTS ===');

  const errors500 = results.filter(r => r.status >= 500);
  const statusMismatches = results.filter(r => !r.success);
  const networkErrors = results.filter(r => r.status === 0);

  const latencies = results.map(r => r.duration).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(1);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(1);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(1);
  const max = latencies[latencies.length - 1].toFixed(1);

  console.log(`Total URLs Crawled:     ${results.length}`);
  console.log(`Successful Responses:   ${results.filter(r => r.success).length}`);
  console.log(`Unhandled 500 Errors:   ${errors500.length}`);
  console.log(`Network / Timeout Err:  ${networkErrors.length}`);
  console.log(`Status Mismatches:      ${statusMismatches.length}`);
  console.log(`Latency p50:            ${p50} ms`);
  console.log(`Latency p95:            ${p95} ms`);
  console.log(`Latency p99:            ${p99} ms`);
  console.log(`Max Latency:            ${max} ms`);
  console.log(`Total Wall Clock Time:  ${(totalTime / 1000).toFixed(2)}s`);
  console.log('=======================================\n');

  if (statusMismatches.length > 0) {
    console.error(`FAIL: ${statusMismatches.length} URLs did not match expected status!`);
    console.table(statusMismatches.slice(0, 10));
    process.exit(1);
  } else {
    console.log('✓ Gate 6.2 PASSED: 0 unhandled 500 errors, valid 404s, valid 200s across all test targets.');
    process.exit(0);
  }
}

runCrawl().catch(console.error);
