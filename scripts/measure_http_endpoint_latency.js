const { spawn } = require('child_process');

async function waitForServer(port, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Server did not become ready on port ${port}`);
}

async function benchmarkMode(modeName, envVars, port) {
  console.log(`\n======================================================`);
  console.log(`Starting Next.js for ${modeName} on port ${port}...`);
  console.log(`======================================================`);

  const server = spawn('cmd.exe', ['/c', 'npx', 'next', 'start', '-p', String(port)], {
    env: { ...process.env, ...envVars, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForServer(port);
    console.log(`Server is ready on port ${port}. Running warm-up...`);

    const testIds = [
      9828, 68271, 44174, 84224, 108244, 31861, 39314, 33519, 51411, 62615,
      1825, 50384, 53, 43632, 1418, 73176, 119201, 280, 678, 490
    ];

    for (const id of testIds) {
      await fetch(`http://localhost:${port}/api/fragrances/${id}/similar?limit=6`);
    }

    console.log(`Executing 200 HTTP GET requests to /api/fragrances/[id]/similar...`);
    const latencies = [];
    const N = 200;

    for (let i = 0; i < N; i++) {
      const qid = testIds[i % testIds.length];
      const t0 = performance.now();
      const res = await fetch(`http://localhost:${port}/api/fragrances/${qid}/similar?limit=6`);
      const t1 = performance.now();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      latencies.push(t1 - t0);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(N * 0.50)];
    const p95 = latencies[Math.floor(N * 0.95)];
    const p99 = latencies[Math.floor(N * 0.99)];
    const min = latencies[0];
    const max = latencies[N - 1];
    const avg = latencies.reduce((a, b) => a + b, 0) / N;

    console.log(`\nResults for ${modeName}:`);
    console.log(`  Requests: ${N}`);
    console.log(`  Min:      ${min.toFixed(2)} ms`);
    console.log(`  p50:      ${p50.toFixed(2)} ms`);
    console.log(`  p95:      ${p95.toFixed(2)} ms`);
    console.log(`  p99:      ${p99.toFixed(2)} ms`);
    console.log(`  Max:      ${max.toFixed(2)} ms`);
    console.log(`  Mean:     ${avg.toFixed(2)} ms`);

    if (p95 > 20) {
      throw new Error(`FAIL: HTTP p95 latency for ${modeName} is ${p95.toFixed(2)}ms (> 20ms threshold)!`);
    }

    return {
      mode: modeName,
      requests: N,
      min: Number(min.toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
      max: Number(max.toFixed(2)),
      mean: Number(avg.toFixed(2))
    };
  } finally {
    // Kill tree on Windows
    spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1200));
  }
}

async function runBenchmarks() {
  const contentResults = await benchmarkMode(
    'Content-Only Mode (INCLUDE_COMMUNITY_EDGES=false)',
    { INCLUDE_COMMUNITY_EDGES: 'false' },
    3005
  );

  const hybridResults = await benchmarkMode(
    'Hybrid Mode (INCLUDE_COMMUNITY_EDGES=true)',
    { INCLUDE_COMMUNITY_EDGES: 'true' },
    3006
  );

  const fs = require('fs');
  fs.writeFileSync('reports/http_latency_results.json', JSON.stringify({ contentResults, hybridResults }, null, 2));
  console.log('\n✓ Saved latency benchmark results to reports/http_latency_results.json');
}

runBenchmarks().catch(console.error);
