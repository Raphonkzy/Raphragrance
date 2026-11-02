const fs = require("fs");
const path = require("path");

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function runAudits() {
  const { chromium } = require("playwright");
  process.env.CHROME_PATH = chromium.executablePath();
  const lighthouse = (await import("lighthouse")).default;
  const chromeLauncher = await import("chrome-launcher");

  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox"] });
  const options = {
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    port: chrome.port,
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  };

  const pages = [
    { name: "catalog", url: "http://localhost:3000/" },
    { name: "detail", url: "http://localhost:3000/fragrance/Creed/Aventus" },
  ];

  const results = {};

  for (const pg of pages) {
    results[pg.name] = {
      perf: [],
      a11y: [],
      bp: [],
      seo: [],
      fcp: [],
      lcp: [],
      tbt: [],
      cls: [],
      reports: [],
    };

    console.log(`\n================== ${pg.name.toUpperCase()} (5 RUNS) ==================`);
    // Warm up Chrome and the server route
    try {
      console.log(`Warming up ${pg.name}...`);
      await lighthouse(pg.url, options);
    } catch (err) {
      console.warn("Warmup error (non-fatal):", err.message);
    }

    for (let run = 1; run <= 5; run++) {
      console.log(`Running iteration ${run}/5 on ${pg.name}...`);
      const runnerResult = await lighthouse(pg.url, options);
      const rep = JSON.parse(runnerResult.report);

      const perfScore = Math.round(rep.categories.performance.score * 100);
      const a11yScore = Math.round(rep.categories.accessibility.score * 100);
      const bpScore = Math.round(rep.categories["best-practices"].score * 100);
      const seoScore = Math.round(rep.categories.seo.score * 100);

      const fcp = rep.audits["first-contentful-paint"]?.numericValue;
      const lcp = rep.audits["largest-contentful-paint"]?.numericValue;
      const tbt = rep.audits["total-blocking-time"]?.numericValue;
      const cls = rep.audits["cumulative-layout-shift"]?.numericValue;

      results[pg.name].perf.push(perfScore);
      results[pg.name].a11y.push(a11yScore);
      results[pg.name].bp.push(bpScore);
      results[pg.name].seo.push(seoScore);
      results[pg.name].fcp.push(fcp);
      results[pg.name].lcp.push(lcp);
      results[pg.name].tbt.push(tbt);
      results[pg.name].cls.push(cls);
      results[pg.name].reports.push(rep);

      console.log(`  Run ${run}: Perf=${perfScore}, A11y=${a11yScore}, BP=${bpScore}, SEO=${seoScore} | LCP=${(lcp / 1000).toFixed(2)}s, FCP=${(fcp / 1000).toFixed(2)}s, TBT=${tbt.toFixed(0)}ms, CLS=${cls.toFixed(3)}`);
    }

    // Select and save median report based on LCP
    const medianLcp = median(results[pg.name].lcp);
    const medianIdx = results[pg.name].lcp.indexOf(medianLcp);
    const medianRep = results[pg.name].reports[medianIdx >= 0 ? medianIdx : 0];
    fs.writeFileSync(
      path.join(__dirname, `../reports/lighthouse-${pg.name}.json`),
      JSON.stringify(medianRep, null, 2)
    );
  }

  await chrome.kill();

  const summary = {
    timestamp: new Date().toISOString(),
    runs: 5,
    formFactor: "mobile",
    catalog: {
      performance: median(results.catalog.perf),
      accessibility: median(results.catalog.a11y),
      bestPractices: median(results.catalog.bp),
      seo: median(results.catalog.seo),
      fcpMs: median(results.catalog.fcp),
      lcpMs: median(results.catalog.lcp),
      tbtMs: median(results.catalog.tbt),
      cls: median(results.catalog.cls),
      rawRuns: {
        perf: results.catalog.perf,
        lcp: results.catalog.lcp,
        cls: results.catalog.cls,
      },
    },
    detail: {
      performance: median(results.detail.perf),
      accessibility: median(results.detail.a11y),
      bestPractices: median(results.detail.bp),
      seo: median(results.detail.seo),
      fcpMs: median(results.detail.fcp),
      lcpMs: median(results.detail.lcp),
      tbtMs: median(results.detail.tbt),
      cls: median(results.detail.cls),
      rawRuns: {
        perf: results.detail.perf,
        lcp: results.detail.lcp,
        cls: results.detail.cls,
      },
    },
  };

  fs.writeFileSync(
    path.join(__dirname, "../reports/lighthouse-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("\n\n=======================================================");
  console.log("FINAL 5-RUN MEDIAN LIGHTHOUSE SUMMARY (MOBILE THROTTLED)");
  console.log("=======================================================");
  for (const pg of pages) {
    const data = results[pg.name];
    console.log(`\nPage: ${pg.name.toUpperCase()}`);
    console.log(`  Performance   : ${median(data.perf)} (runs: ${data.perf.join(", ")})`);
    console.log(`  Accessibility : ${median(data.a11y)} (runs: ${data.a11y.join(", ")})`);
    console.log(`  Best Practices: ${median(data.bp)} (runs: ${data.bp.join(", ")})`);
    console.log(`  SEO           : ${median(data.seo)} (runs: ${data.seo.join(", ")})`);
    console.log(`  FCP (median)  : ${(median(data.fcp) / 1000).toFixed(2)}s`);
    console.log(`  LCP (median)  : ${(median(data.lcp) / 1000).toFixed(2)}s`);
    console.log(`  TBT (median)  : ${median(data.tbt).toFixed(0)}ms`);
    console.log(`  CLS (median)  : ${median(data.cls).toFixed(3)}`);
  }
}

runAudits().catch(console.error);
