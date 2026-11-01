const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/perfumes.db');

const stmtComm = db.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'community'
  ORDER BY s.rank ASC
  LIMIT ?
`);

const stmtContent = db.prepare(`
  SELECT s.similar_id, s.score, s.source, p.*
  FROM similar s
  JOIN perfumes p ON p.id = s.similar_id
  WHERE s.fragrance_id = ? AND s.source = 'content'
  ORDER BY s.rank ASC
  LIMIT ?
`);

console.log('Testing getSimilarFragrances database query latency across 1,000 random queries...');

// Warmup
for (let i = 1; i <= 20; i++) {
  stmtComm.all(i, 8);
  stmtContent.all(i, 8);
}

const timesContentOnly = [];
const timesHybrid = [];

for (let i = 0; i < 1000; i++) {
  const randomId = Math.floor(Math.random() * 120000) + 1;

  // 1. Content-Only
  const t0 = performance.now();
  const resContent = stmtContent.all(randomId, 8);
  timesContentOnly.push(performance.now() - t0);

  // 2. Hybrid
  const t1 = performance.now();
  const resComm = stmtComm.all(randomId, 8);
  if (resComm.length < 8) {
    stmtContent.all(randomId, 16);
  }
  timesHybrid.push(performance.now() - t1);
}

function printStats(label, times) {
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.50)];
  const p90 = times[Math.floor(times.length * 0.90)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];

  console.log(`\n=== ${label} (N = ${times.length}) ===`);
  console.log(`p50 latency: ${p50.toFixed(3)} ms`);
  console.log(`p90 latency: ${p90.toFixed(3)} ms`);
  console.log(`p95 latency: ${p95.toFixed(3)} ms (Target < 20.00 ms: ${p95 < 20 ? 'PASS ✓' : 'FAIL ✗'})`);
  console.log(`p99 latency: ${p99.toFixed(3)} ms`);
  console.log(`Max latency: ${max.toFixed(3)} ms`);
}

printStats('CONTENT-ONLY MODE (INCLUDE_COMMUNITY_EDGES=false)', timesContentOnly);
printStats('HYBRID MODE (INCLUDE_COMMUNITY_EDGES=true)', timesHybrid);
