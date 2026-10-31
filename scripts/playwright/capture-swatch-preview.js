const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const url = require("url");

const OUT = path.join(__dirname, "../../reports/screenshots-swatch-preview");
fs.mkdirSync(OUT, { recursive: true });

const PREVIEW = path.resolve(__dirname, "../../reports/preview-gilroy-swatch.html");
const PREVIEW_URL = url.pathToFileURL(PREVIEW).href;

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

      // 1. Catalog
      {
        const page = await ctx.newPage();
        await page.goto(PREVIEW_URL);
        await page.click(`button[data-t="${theme}"]`);
        await page.click('button[data-v="catalog"]');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const name = `preview-swatch-catalog-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        console.log("Saved", name);
        await page.close();
      }

      // 2. Detail (Record 2 in F: Baccarat Rouge 540)
      {
        const page = await ctx.newPage();
        await page.goto(PREVIEW_URL);
        await page.click(`button[data-t="${theme}"]`);
        await page.evaluate(() => {
          // Baccarat Rouge 540 is index 2 in F
          pick(2);
        });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const name = `preview-swatch-detail-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        console.log("Saved", name);
        await page.close();
      }

      await ctx.close();
    }
  }

  await browser.close();
  console.log("All swatch preview screenshots captured successfully!");
})();
