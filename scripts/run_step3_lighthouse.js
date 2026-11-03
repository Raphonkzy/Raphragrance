const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function measureInteractions(baseUrl) {
  console.log('\n=============================================================');
  console.log('   MEASURING INTERACTION LATENCY (4x CPU SLOWDOWN)');
  console.log('=============================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  // Apply 4x CPU slowdown
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  console.log('Applied 4x CPU slowdown via Chrome DevTools Protocol.');

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

  // 1. Measure typeahead interaction latency
  const searchInput = page.locator('input.q');
  await searchInput.waitFor({ state: 'visible' });

  const typeaheadLatencies = [];
  const testChars = ['a', 'v', 'e', 'n', 't', 'u', 's'];
  for (const char of testChars) {
    const t0 = performance.now();
    await searchInput.pressSequentially(char, { delay: 10 });
    // Wait for input value change
    await page.waitForFunction(
      ({ val }) => document.querySelector('input.q')?.value.endsWith(val),
      { val: char }
    );
    const dur = performance.now() - t0;
    typeaheadLatencies.push(dur);
  }

  // Wait for typeahead dropdown
  await page.waitForTimeout(300);
  const typeaheadOpen = await page.locator('#typeahead-listbox').isVisible().catch(() => false);

  const avgTypeahead = typeaheadLatencies.reduce((a, b) => a + b, 0) / typeaheadLatencies.length;
  console.log(`Typeahead Keypress Interaction Latency (4x CPU):`);
  console.log(`  Average: ${avgTypeahead.toFixed(2)} ms`);
  console.log(`  Max:     ${Math.max(...typeaheadLatencies).toFixed(2)} ms`);
  console.log(`  Typeahead dropdown visible: ${typeaheadOpen}`);

  // Dismiss typeahead dropdown and clear search input so it does not intercept chip clicks
  await page.keyboard.press('Escape');
  await searchInput.fill('');
  await searchInput.blur();
  await page.waitForTimeout(300);

  // 2. Measure filter chips interaction latency
  const chipLatencies = [];

  // Click Women chip
  const womenBtn = page.getByRole('button', { name: 'Women', exact: true });
  if (await womenBtn.count() > 0) {
    const t0 = performance.now();
    await womenBtn.click();
    await page.waitForFunction(() => {
      const el = Array.from(document.querySelectorAll('button.chip')).find(c => c.textContent.trim() === 'Women');
      return el && el.classList.contains('on');
    });
    const dur = performance.now() - t0;
    chipLatencies.push({ name: 'Gender: Women', durationMs: dur });
  }

  // Click Men chip
  const menBtn = page.getByRole('button', { name: 'Men', exact: true });
  if (await menBtn.count() > 0) {
    const t0 = performance.now();
    await menBtn.click();
    await page.waitForFunction(() => {
      const el = Array.from(document.querySelectorAll('button.chip')).find(c => c.textContent.trim() === 'Men');
      return el && el.classList.contains('on');
    });
    const dur = performance.now() - t0;
    chipLatencies.push({ name: 'Gender: Men', durationMs: dur });
  }

  // Click Rating sort chip
  const ratingBtn = page.getByRole('button', { name: 'Rating', exact: true });
  if (await ratingBtn.count() > 0) {
    const t0 = performance.now();
    await ratingBtn.click();
    await page.waitForFunction(() => {
      const el = Array.from(document.querySelectorAll('button.chip')).find(c => c.textContent.trim() === 'Rating');
      return el && el.classList.contains('on');
    });
    const dur = performance.now() - t0;
    chipLatencies.push({ name: 'Sort: Rating', durationMs: dur });
  }

  console.log(`Filter Chip Interaction Latency (4x CPU):`);
  for (const c of chipLatencies) {
    console.log(`  ${c.name}: ${c.durationMs.toFixed(2)} ms`);
  }

  await browser.close();

  return {
    cpu_slowdown: '4x',
    typeahead_avg_ms: Number(avgTypeahead.toFixed(2)),
    typeahead_max_ms: Number(Math.max(...typeaheadLatencies).toFixed(2)),
    typeahead_dropdown_appeared: typeaheadOpen,
    filter_chips: chipLatencies.map(c => ({
      name: c.name,
      latency_ms: Number(c.durationMs.toFixed(2))
    }))
  };
}

async function runLighthouseSuite() {
  process.env.CHROME_PATH = chromium.executablePath();
  const lighthouse = (await import('lighthouse')).default;
  const chromeLauncher = await import('chrome-launcher');

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
  });

  const options = {
    logLevel: 'error',
    output: 'json',
    port: chrome.port,
    formFactor: 'mobile',
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
    },
  };

  const pages = [
    { id: 'catalog_home', name: 'Catalog Home (/)', path: '/' },
    { id: 'catalog_filtered', name: 'Catalog Filtered (/?gender=men)', path: '/?gender=men' },
    { id: 'fragrance_detail', name: 'Detail Page (/fragrance/Creed/Aventus)', path: '/fragrance/Creed/Aventus' },
    { id: 'brand_page', name: 'Brand Page (/brand/Creed)', path: '/brand/Creed' }
  ];

  const pageResults = {};

  for (const p of pages) {
    const url = `http://localhost:3000${p.path}`;
    console.log(`\n=============================================================`);
    console.log(`LIGHTHOUSE 5-RUN AUDIT: ${p.name}`);
    console.log(`URL: ${url}`);
    console.log(`=============================================================`);

    // Warm up
    try {
      console.log('Warming route...');
      await lighthouse(url, options);
    } catch {}

    const runs = [];
    for (let r = 1; r <= 5; r++) {
      console.log(`Running iteration ${r}/5...`);
      const runnerResult = await lighthouse(url, options);
      const rep = JSON.parse(runnerResult.report);

      const perfScore = Math.round((rep.categories.performance?.score || 0) * 100);
      const a11yScore = Math.round((rep.categories.accessibility?.score || 0) * 100);
      const bpScore = Math.round((rep.categories['best-practices']?.score || 0) * 100);
      const seoScore = Math.round((rep.categories.seo?.score || 0) * 100);

      const fcp = rep.audits['first-contentful-paint']?.numericValue || 0;
      const lcp = rep.audits['largest-contentful-paint']?.numericValue || 0;
      const tbt = rep.audits['total-blocking-time']?.numericValue || 0;
      const cls = rep.audits['cumulative-layout-shift']?.numericValue || 0;

      // Extract LCP selector and breakdown
      const breakdownInsight = rep.audits['lcp-breakdown-insight'];
      let lcpSelector = 'unknown';
      let ttfb = 0;
      let loadDelay = 0;
      let loadDuration = 0;
      let renderDelay = 0;

      if (breakdownInsight?.details?.items) {
        for (const item of breakdownInsight.details.items) {
          if (item.type === 'node' && item.selector) {
            lcpSelector = item.selector;
          }
          if (item.type === 'table' && Array.isArray(item.items)) {
            for (const row of item.items) {
              if (row.subpart === 'timeToFirstByte') ttfb = row.duration;
              if (row.subpart === 'resourceLoadDelay') loadDelay = row.duration;
              if (row.subpart === 'resourceLoadDuration') loadDuration = row.duration;
              if (row.subpart === 'elementRenderDelay') renderDelay = row.duration;
            }
          }
        }
      }

      runs.push({
        run: r,
        perf: perfScore,
        a11y: a11yScore,
        bp: bpScore,
        seo: seoScore,
        fcp_ms: Number(fcp.toFixed(1)),
        lcp_ms: Number(lcp.toFixed(1)),
        tbt_ms: Number(tbt.toFixed(1)),
        cls: Number(cls.toFixed(3)),
        lcp_selector: lcpSelector,
        lcp_breakdown: {
          ttfb_ms: Number(ttfb.toFixed(1)),
          load_delay_ms: Number(loadDelay.toFixed(1)),
          load_duration_ms: Number(loadDuration.toFixed(1)),
          render_delay_ms: Number(renderDelay.toFixed(1))
        }
      });

      console.log(`  Run ${r}: Perf=${perfScore} | LCP=${(lcp/1000).toFixed(2)}s | CLS=${cls.toFixed(3)} | TBT=${tbt.toFixed(0)}ms | FCP=${(fcp/1000).toFixed(2)}s`);
    }

    // Compute medians
    const lcpValues = runs.map(r => r.lcp_ms);
    const medianLcp = median(lcpValues);
    const sortedRuns = [...runs].sort((a, b) => a.lcp_ms - b.lcp_ms);
    const medianRun = sortedRuns[Math.floor(sortedRuns.length / 2)];

    const medianPerf = median(runs.map(r => r.perf));
    const medianA11y = median(runs.map(r => r.a11y));
    const medianBp = median(runs.map(r => r.bp));
    const medianSeo = median(runs.map(r => r.seo));
    const medianFcp = median(runs.map(r => r.fcp_ms));
    const medianTbt = median(runs.map(r => r.tbt_ms));
    const medianCls = median(runs.map(r => r.cls));

    console.log(`\n>>> ${p.name} MEDIAN OF 5 RUNS <<<`);
    console.log(`  Performance:  ${medianPerf}`);
    console.log(`  LCP:          ${(medianLcp / 1000).toFixed(2)}s (Gate: <= 2.5s ${medianLcp <= 2500 ? 'PASS' : 'FAIL'})`);
    console.log(`  CLS:          ${medianCls.toFixed(3)} (Gate: <= 0.05 ${medianCls <= 0.05 ? 'PASS' : 'FAIL'})`);
    console.log(`  TBT:          ${medianTbt.toFixed(0)} ms (Gate: <= 200ms ${medianTbt <= 200 ? 'PASS' : 'FAIL'})`);
    console.log(`  LCP Selector: ${medianRun.lcp_selector}`);
    console.log(`  LCP Breakdown: TTFB=${medianRun.lcp_breakdown.ttfb_ms}ms, LoadDelay=${medianRun.lcp_breakdown.load_delay_ms}ms, LoadDuration=${medianRun.lcp_breakdown.load_duration_ms}ms, RenderDelay=${medianRun.lcp_breakdown.render_delay_ms}ms`);

    pageResults[p.id] = {
      name: p.name,
      path: p.path,
      gate: {
        lcp_required_pass: medianLcp <= 2500,
        lcp_stretch_pass: medianLcp <= 2000,
        cls_pass: medianCls <= 0.05,
        tbt_pass: medianTbt <= 200
      },
      median: {
        performance_score: medianPerf,
        accessibility_score: medianA11y,
        best_practices_score: medianBp,
        seo_score: medianSeo,
        lcp_s: Number((medianLcp / 1000).toFixed(2)),
        lcp_ms: Number(medianLcp.toFixed(1)),
        fcp_s: Number((medianFcp / 1000).toFixed(2)),
        fcp_ms: Number(medianFcp.toFixed(1)),
        tbt_ms: Number(medianTbt.toFixed(1)),
        cls: Number(medianCls.toFixed(3)),
        lcp_element_selector: medianRun.lcp_selector,
        lcp_breakdown: medianRun.lcp_breakdown
      },
      all_5_runs: runs
    };
  }

  await chrome.kill();

  // Run interaction latency measurements
  const interactionResults = await measureInteractions('http://localhost:3000');

  // Update canonical perf report
  const perfReportPath = path.join(__dirname, '..', 'reports', 'perf-results.json');
  let currentReport = {};
  if (fs.existsSync(perfReportPath)) {
    try {
      currentReport = JSON.parse(fs.readFileSync(perfReportPath, 'utf8'));
    } catch {}
  }

  currentReport.lighthouse_mobile_5runs = pageResults;
  currentReport.interaction_latency_4x_cpu = interactionResults;

  fs.writeFileSync(perfReportPath, JSON.stringify(currentReport, null, 2), 'utf8');
  console.log(`\n✓ Successfully saved Step 3 results to reports/perf-results.json`);
}

runLighthouseSuite().catch(err => {
  console.error('Lighthouse suite fatal error:', err);
  process.exit(1);
});
