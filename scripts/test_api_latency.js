const { getSimilarFragrances, getFragranceById } = require('../lib/data');

console.log('Testing getSimilarFragrances latency across 1,000 random queries...');

// 1. Warm-up
const testIds = [9828, 1418, 31861, 39314, 68271, 84224, 108244, 44174];
for (const id of testIds) {
  const f = getFragranceById(id);
  if (f) getSimilarFragrances(f, 8);
}

// 2. Measure 1,000 queries
const times = [];
for (let i = 0; i < 1000; i++) {
  // random fragrance ID between 1 and 130000
  const randomId = Math.floor(Math.random() * 120000) + 1;
  const f = getFragranceById(randomId);
  if (!f) continue;

  const t0 = performance.now();
  getSimilarFragrances(f, 8);
  const elapsed = performance.now() - t0;
  times.push(elapsed);
}

times.sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.50)];
const p90 = times[Math.floor(times.length * 0.90)];
const p95 = times[Math.floor(times.length * 0.95)];
const p99 = times[Math.floor(times.length * 0.99)];
const max = times[times.length - 1];

console.log('\n=== API / DATABASE LATENCY BENCHMARK (N = ' + times.length + ' QUERIES) ===');
console.log(`p50 latency: ${p50.toFixed(3)} ms`);
console.log(`p90 latency: ${p90.toFixed(3)} ms`);
console.log(`p95 latency: ${p95.toFixed(3)} ms (Requirement: < 20.00 ms -> ${p95 < 20 ? 'PASS ✓' : 'FAIL ✗'})`);
console.log(`p99 latency: ${p99.toFixed(3)} ms`);
console.log(`Max latency: ${max.toFixed(3)} ms`);
