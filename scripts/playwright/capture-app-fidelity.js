const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT_APP = path.join(__dirname, "../../reports/screenshots-swatch-app");
const OUT_EDGE = path.join(__dirname, "../../reports/screenshots-edge-cases");
fs.mkdirSync(OUT_APP, { recursive: true });
fs.mkdirSync(OUT_EDGE, { recursive: true });

const BASE_URL = "http://localhost:3001";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch();

  // 1. Capture 8 App Golden Screenshots
  for (const vp of VIEWPORTS) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });

      // A. Catalog
      {
        const page = await ctx.newPage();
        await page.addInitScript((t) => {
          localStorage.setItem("rph-theme", t);
        }, theme);
        await page.goto(`${BASE_URL}/?fixture=golden`, { waitUntil: "networkidle" });
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
        }, theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);

        const name = `app-swatch-catalog-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT_APP, name) });
        console.log("Saved golden app shot:", name);
        await page.close();
      }

      // B. Detail (Baccarat Rouge 540)
      {
        const page = await ctx.newPage();
        await page.addInitScript((t) => {
          localStorage.setItem("rph-theme", t);
        }, theme);
        await page.goto(`${BASE_URL}/fragrance/Maison-Francis-Kurkdjian/Baccarat-Rouge-540?fixture=golden`, {
          waitUntil: "networkidle",
        });
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
        }, theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);

        const name = `app-swatch-detail-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT_APP, name) });
        console.log("Saved golden app shot:", name);
        await page.close();
      }

      await ctx.close();
    }
  }

  // 2. Capture Edge Cases from the 301-Row Catalog
  const edgeCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });

  // Edge 1: 301-Row Real Catalog Grid with Search / Typeahead
  {
    const page = await edgeCtx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_EDGE, "edge-301-catalog-grid.png") });
    console.log("Saved edge-301-catalog-grid.png");

    // Typeahead active
    await page.fill(".q", "Dior");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_EDGE, "edge-search-typeahead.png") });
    console.log("Saved edge-search-typeahead.png");
    await page.close();
  }

  // Edge 2: Missing image bottle SVG fallback + Accord filter
  {
    const page = await edgeCtx.newPage();
    await page.goto(`${BASE_URL}/?accord=green`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_EDGE, "edge-accord-filtered-green.png") });
    console.log("Saved edge-accord-filtered-green.png");
    await page.close();
  }

  // Edge 3: Brand page with stats and brand catalog
  {
    const page = await edgeCtx.newPage();
    await page.goto(`${BASE_URL}/brand/Dior`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_EDGE, "edge-brand-page-dior.png") });
    console.log("Saved edge-brand-page-dior.png");
    await page.close();
  }

  // Edge 4: All Brands directory
  {
    const page = await edgeCtx.newPage();
    await page.goto(`${BASE_URL}/brands`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_EDGE, "edge-brands-directory.png") });
    console.log("Saved edge-brands-directory.png");
    await page.close();
  }

  // Edge 5: All Accords directory
  {
    const page = await edgeCtx.newPage();
    await page.goto(`${BASE_URL}/accords`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_EDGE, "edge-accords-directory.png") });
    console.log("Saved edge-accords-directory.png");
    await page.close();
  }

  await edgeCtx.close();
  await browser.close();
  console.log("All app screenshots and edge cases captured successfully!");
})();
