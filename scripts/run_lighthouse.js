const fs = require("fs");
const path = require("path");

async function runAudit() {
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
    { name: "catalog", url: "http://localhost:3001/" },
    { name: "detail", url: "http://localhost:3001/fragrance/Dior/Sauvage" },
  ];

  for (const pg of pages) {
    console.log(`Running mobile Lighthouse on ${pg.name} (${pg.url})...`);
    const runnerResult = await lighthouse(pg.url, options);
    const reportJson = runnerResult.report;
    const dest = path.join(__dirname, `../reports/lighthouse-swatch-${pg.name}.json`);
    fs.writeFileSync(dest, reportJson);

    const report = JSON.parse(reportJson);
    console.log(`\n=== Results for ${pg.name} ===`);
    for (const [key, cat] of Object.entries(report.categories)) {
      console.log(`  ${cat.title}: ${Math.round(cat.score * 100)}`);
    }
    console.log(`  FCP: ${report.audits["first-contentful-paint"]?.displayValue}`);
    console.log(`  LCP: ${report.audits["largest-contentful-paint"]?.displayValue}`);
    console.log(`  TBT: ${report.audits["total-blocking-time"]?.displayValue}`);
    console.log(`  CLS: ${report.audits["cumulative-layout-shift"]?.displayValue}`);
    console.log("-------------------------------------------\n");
  }

  await chrome.kill();
  console.log("Lighthouse audits complete.");
}

runAudit().catch(console.error);
