const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const url = require("url");

const OUT = path.join(__dirname, "../../reports/screenshots-d2-preview");
fs.mkdirSync(OUT, { recursive: true });

const PREVIEW = path.resolve(__dirname, "../../reference/raphragrance-design-preview.html");
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
        await page.click('button[data-d="2"]');
        await page.click(`button[data-t="${theme}"]`);
        await page.click('button[data-v="catalog"]');
        await page.waitForTimeout(300);
        const name = `preview-d2-catalog-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        console.log("Saved", name);
        await page.close();
      }

      // 2. Detail (Record 3: Baccarat Rouge 540 -> click 3rd card or pick(2))
      {
        const page = await ctx.newPage();
        await page.goto(PREVIEW_URL);
        await page.click('button[data-d="2"]');
        await page.click(`button[data-t="${theme}"]`);
        // In catalog, click the 3rd card to trigger pick(2)
        const cards = page.locator('.d2 .card');
        await cards.nth(2).click();
        await page.waitForTimeout(300);
        const name = `preview-d2-detail-${theme}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        console.log("Saved", name);
        await page.close();
      }

      await ctx.close();
    }
  }

  await browser.close();
  console.log("All preview d2 screenshots captured successfully!");
})();
