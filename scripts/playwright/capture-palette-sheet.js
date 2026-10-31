const { chromium } = require("playwright");
const path = require("path");
const url = require("url");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const p = path.resolve(__dirname, "../../reports/swatch-palette.html");
  await page.goto(url.pathToFileURL(p).href);
  await page.screenshot({ path: path.join(__dirname, "../../reports/swatch-palette-light.png"), fullPage: true });
  console.log("Saved swatch-palette-light.png");

  await page.evaluate(() => toggleTheme());
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, "../../reports/swatch-palette-dark.png"), fullPage: true });
  console.log("Saved swatch-palette-dark.png");

  await browser.close();
})();
