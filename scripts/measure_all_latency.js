const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 5000,
});

const dbPath = path.join(__dirname, '..', 'data', 'perfumes.public.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

// Stratified sample of 25 fragrance IDs and Slugs
const sampleRows = db.prepare(`
  SELECT id, slug FROM perfumes 
  WHERE vote_count >= 10 
  ORDER BY RANDOM() 
  LIMIT 25
`).all();
db.close();

const sampleIds = sampleRows.map(r => r.id);
const sampleSlugs = sampleRows.map(r => r.slug);

function sendRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const req = http.get(
      {
        host: HOST,
        port: PORT,
        path: urlPath,
        agent,
        headers: {
          'Connection': 'keep-alive',
          'User-Agent': 'Perf-Benchmark/1.0',
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          const t1 = performance.now();
          const latency = t1 - t0;
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${urlPath}`));
          } else {
            resolve({
              latency,
              statusCode: res.statusCode,
              headers: res.headers,
              bytes: Buffer.byteLength(body, 'utf8')
            });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout for ${urlPath}`));
    });
  });
}

async function benchmarkSequential(name, getPathFn, count = 500) {
  console.log(`\n--- [Concurrency 1] 500 Sequential Requests: ${name} ---`);
  // Warmup 25 requests
  for (let i = 0; i < 25; i++) {
    await sendRequest(getPathFn(i));
  }

  const latencies = [];
  let errors = 0;
  for (let i = 0; i < count; i++) {
    try {
      const res = await sendRequest(getPathFn(i));
      latencies.push(res.latency);
    } catch (e) {
      errors++;
    }
  }

  latencies.sort((a, b) => a - b);
  const N = latencies.length;
  const p50 = latencies[Math.floor(N * 0.50)] || 0;
  const p95 = latencies[Math.floor(N * 0.95)] || 0;
  const p99 = latencies[Math.floor(N * 0.99)] || 0;
  const mean = latencies.reduce((a, b) => a + b, 0) / N;

  console.log(`  Requests: ${N} ok, ${errors} err`);
  console.log(`  p50:  ${p50.toFixed(2)} ms`);
  console.log(`  p95:  ${p95.toFixed(2)} ms`);
  console.log(`  p99:  ${p99.toFixed(2)} ms`);
  console.log(`  Mean: ${mean.toFixed(2)} ms`);

  return { N, errors, p50, p95, p99, mean };
}

async function benchmarkConcurrent(name, getPathFn, count = 1000, concurrency = 20) {
  console.log(`\n--- [Concurrency 20] 1000 Requests: ${name} ---`);
  // Warmup 25 requests
  for (let i = 0; i < 25; i++) {
    await sendRequest(getPathFn(i));
  }

  const latencies = [];
  let errors = 0;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < count) {
      const idx = currentIndex++;
      try {
        const res = await sendRequest(getPathFn(idx));
        latencies.push(res.latency);
      } catch (e) {
        errors++;
      }
    }
  }

  const tStart = performance.now();
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const wallClock = performance.now() - tStart;

  latencies.sort((a, b) => a - b);
  const N = latencies.length;
  const p50 = latencies[Math.floor(N * 0.50)] || 0;
  const p95 = latencies[Math.floor(N * 0.95)] || 0;
  const p99 = latencies[Math.floor(N * 0.99)] || 0;
  const mean = latencies.reduce((a, b) => a + b, 0) / N;
  const rps = N / (wallClock / 1000);
  const serviceTimeMs = (1 / rps) * 1000;

  console.log(`  Wall clock: ${(wallClock / 1000).toFixed(2)} s`);
  console.log(`  Requests:   ${N} ok, ${errors} err`);
  console.log(`  Throughput: ${rps.toFixed(1)} req/sec`);
  console.log(`  Service time (1/rps): ${serviceTimeMs.toFixed(2)} ms`);
  console.log(`  p50:  ${p50.toFixed(2)} ms`);
  console.log(`  p95:  ${p95.toFixed(2)} ms`);
  console.log(`  p99:  ${p99.toFixed(2)} ms`);

  return { N, errors, wallClockMs: wallClock, rps, serviceTimeMs, p50, p95, p99, mean };
}

async function verifyCaching(urlPath) {
  console.log(`\n--- Cache Verification: ${urlPath} ---`);
  const r1 = await sendRequest(urlPath);
  const r2 = await sendRequest(urlPath);
  console.log(`  Run 1: ${r1.latency.toFixed(2)} ms, status: ${r1.statusCode}`);
  console.log(`  Run 2: ${r2.latency.toFixed(2)} ms, status: ${r2.statusCode}`);
  console.log(`  Cache-Control: ${r2.headers['cache-control'] || 'none'}`);
  return {
    path: urlPath,
    run1Ms: Number(r1.latency.toFixed(2)),
    run2Ms: Number(r2.latency.toFixed(2)),
    cacheControl: r2.headers['cache-control'] || null
  };
}

async function runAllBenchmarks() {
  console.log('=============================================================');
  console.log('   RAPHRAGRANCE PRODUCTION LATENCY BENCHMARK (STEP 2)');
  console.log('=============================================================');
  console.log(`Host: http://${HOST}:${PORT}`);
  console.log(`Node: ${process.version}`);
  console.log(`Date: ${new Date().toISOString()}`);

  const endpoints = [
    {
      id: 'similar_api',
      name: '/api/fragrances/[id]/similar',
      type: 'api',
      gateP95: 20,
      pathFn: (i) => `/api/fragrances/${sampleIds[i % sampleIds.length]}/similar?limit=10`
    },
    {
      id: 'search_api',
      name: '/api/search?q=...',
      type: 'api',
      gateP95: 20,
      pathFn: (i) => {
        const queries = ['aventus', 'sauvage', 'bleu', 'hacivat', 'cedrat'];
        return `/api/search?q=${queries[i % queries.length]}&limit=20`;
      }
    },
    {
      id: 'detail_ssr',
      name: '/fragrance/[slug]',
      type: 'ssr',
      gateP95: 60,
      pathFn: (i) => `/fragrance/${sampleSlugs[i % sampleSlugs.length]}`
    },
    {
      id: 'home_ssr',
      name: '/',
      type: 'ssr',
      gateP95: 60,
      pathFn: () => '/'
    }
  ];

  const results = {};

  for (const ep of endpoints) {
    console.log(`\n=============================================================`);
    console.log(`Target: ${ep.name} (${ep.type.toUpperCase()}) | Gate: c=1 p95 <= ${ep.gateP95}ms`);
    console.log(`=============================================================`);

    const c1 = await benchmarkSequential(ep.name, ep.pathFn, 500);
    const c20 = await benchmarkConcurrent(ep.name, ep.pathFn, 1000, 20);

    const c1Pass = c1.p95 <= ep.gateP95;
    const c20Pass = c20.errors === 0;

    results[ep.id] = {
      name: ep.name,
      type: ep.type,
      gate: {
        c1_p95_limit_ms: ep.gateP95,
        c1_p95_actual_ms: Number(c1.p95.toFixed(2)),
        c1_pass: c1Pass,
        c20_errors: c20.errors,
        c20_pass: c20Pass
      },
      concurrency_1: {
        requests: c1.N,
        errors: c1.errors,
        p50_ms: Number(c1.p50.toFixed(2)),
        p95_ms: Number(c1.p95.toFixed(2)),
        p99_ms: Number(c1.p99.toFixed(2)),
        mean_ms: Number(c1.mean.toFixed(2))
      },
      concurrency_20: {
        requests: c20.N,
        errors: c20.errors,
        rps: Number(c20.rps.toFixed(1)),
        service_time_ms: Number(c20.serviceTimeMs.toFixed(2)),
        p50_ms: Number(c20.p50.toFixed(2)),
        p95_ms: Number(c20.p95.toFixed(2)),
        p99_ms: Number(c20.p99.toFixed(2)),
        mean_ms: Number(c20.mean.toFixed(2))
      }
    };
  }

  // Cache checks
  const cacheChecks = [
    await verifyCaching(`/fragrance/${sampleSlugs[0]}`),
    await verifyCaching(`/brand/Creed`),
    await verifyCaching(`/api/fragrances/${sampleIds[0]}/similar?limit=10`)
  ];

  const perfReportPath = path.join(__dirname, '..', 'reports', 'perf-results.json');
  let existingReport = {};
  if (fs.existsSync(perfReportPath)) {
    try {
      existingReport = JSON.parse(fs.readFileSync(perfReportPath, 'utf8'));
    } catch {}
  }

  const updatedReport = {
    ...existingReport,
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV || 'production',
    server_cmd: 'next build && next start -p 3000',
    latency: results,
    caching_verification: cacheChecks
  };

  fs.writeFileSync(perfReportPath, JSON.stringify(updatedReport, null, 2), 'utf8');
  console.log(`\n✓ Successfully saved Step 2 benchmark to reports/perf-results.json`);
}

runAllBenchmarks().catch(err => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
