const fs = require("fs");
const path = require("path");

function printScores(reportName) {
  const p = path.join(__dirname, `../reports/${reportName}`);
  const report = JSON.parse(fs.readFileSync(p, "utf8"));
  console.log(`\n=== ${reportName} ===`);
  for (const [key, cat] of Object.entries(report.categories)) {
    console.log(`  ${cat.title}: Math.round(${cat.score * 100}) = ${Math.round(cat.score * 100)}`);
  }
  const fcp = report.audits["first-contentful-paint"]?.displayValue;
  const lcp = report.audits["largest-contentful-paint"]?.displayValue;
  const tbt = report.audits["total-blocking-time"]?.displayValue;
  const cls = report.audits["cumulative-layout-shift"]?.displayValue;
  console.log(`  FCP: ${fcp}, LCP: ${lcp}, TBT: ${tbt}, CLS: ${cls}`);
}

printScores("lighthouse-d2-prod-catalog.json");
printScores("lighthouse-d2-prod-detail.json");
