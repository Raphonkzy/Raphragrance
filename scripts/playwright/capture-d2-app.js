const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "../../reports/screenshots-d2-app");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });

      // 1. Catalog (golden fixture)
      {
        const page = await ctx.newPage();
        await page.goto("http://localhost:3000/?fixture=golden", { waitUntil: "networkidle" });
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
          localStorage.setItem("rph-theme", t);
        }, theme);
        await page.waitForTimeout(300);
        const name = `app-d2-catalog-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        console.log("Saved", name);
        await page.close();
      }

      // 2. Detail (Baccarat Rouge 540)
      {
        const page = await ctx.newPage();
        await page.goto(
          "http://localhost:3000/fragrance/Maison-Francis-Kurkdjian/Baccarat-Rouge-540?fixture=golden",
          { waitUntil: "networkidle" }
        );
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
          localStorage.setItem("rph-theme", t);
        }, theme);
        await page.waitForTimeout(300);
        const name = `app-d2-detail-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        console.log("Saved", name);
        await page.close();
      }

      await ctx.close();
    }
  }

  // 3. Contrast Evidence: Stacked bar and card strip in light & dark
  {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    
    // Light
    await page.goto(
      "http://localhost:3000/fragrance/Maison-Francis-Kurkdjian/Baccarat-Rouge-540?fixture=golden",
      { waitUntil: "networkidle" }
    );
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });
    await page.waitForTimeout(200);
    const stackLight = page.locator(".stack");
    await stackLight.screenshot({ path: path.join(OUT, "contrast-stacked-bar-light.png") });
    console.log("Saved contrast-stacked-bar-light.png");

    // Dark
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.waitForTimeout(200);
    const stackDark = page.locator(".stack");
    await stackDark.screenshot({ path: path.join(OUT, "contrast-stacked-bar-dark.png") });
    console.log("Saved contrast-stacked-bar-dark.png");

    // Catalog card strip Light
    await page.goto("http://localhost:3000/?fixture=golden", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });
    await page.waitForTimeout(200);
    const cardLight = page.locator(".card").first();
    await cardLight.screenshot({ path: path.join(OUT, "contrast-card-strip-light.png") });
    console.log("Saved contrast-card-strip-light.png");

    // Catalog card strip Dark
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.waitForTimeout(200);
    const cardDark = page.locator(".card").first();
    await cardDark.screenshot({ path: path.join(OUT, "contrast-card-strip-dark.png") });
    console.log("Saved contrast-card-strip-dark.png");

    await page.close();
  }

  // 4. Real-fixture edge case captures (301-row catalog)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "app-real-fixture-catalog.png") });
    console.log("Saved app-real-fixture-catalog.png");

    // Test a fragrance with flat notes only
    // Let's find one in fixtures/fragrances.json
    const fixtureData = JSON.parse(fs.readFileSync(path.join(__dirname, "../../fixtures/fragrances.json"), "utf8"));
    const flatOnly = fixtureData.find(f => f.notes.flat && f.notes.flat.length > 0 && f.notes.top.length === 0);
    if (flatOnly) {
      await page.goto(`http://localhost:3000/fragrance/${flatOnly.slug}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(OUT, "app-edge-flat-notes.png") });
      console.log("Saved app-edge-flat-notes.png");
    }

    // Test a fragrance with missing year
    const noYear = fixtureData.find(f => !f.year);
    if (noYear) {
      await page.goto(`http://localhost:3000/fragrance/${noYear.slug}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(OUT, "app-edge-missing-year.png") });
      console.log("Saved app-edge-missing-year.png");
    }

    // Test a brand with slash
    const slashBrand = fixtureData.find(f => f.brand.includes("/"));
    if (slashBrand) {
      console.log("Testing brand with slash:", slashBrand.brand);
      await page.goto(`http://localhost:3000/brand/${slashBrand.brand}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(OUT, "app-edge-brand-with-slash.png") });
      console.log("Saved app-edge-brand-with-slash.png");
    }

    await page.close();
  }

  await browser.close();
  console.log("All app captures completed!");
})();
