const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "../../reports/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const PAGES = [
  { name: "catalog", url: "http://localhost:3000/?fixture=golden" },
  { name: "detail", url: "http://localhost:3000/fragrance/Dior/Sauvage?fixture=golden" },
];

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  saved", file);
}

(async () => {
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme === "dark" ? "dark" : "light",
      });

      for (const pg of PAGES) {
        const p = await ctx.newPage();
        // Set theme cookie / localStorage before navigate
        await p.addInitScript((t) => {
          localStorage.setItem("rph-theme", t);
        }, theme);
        await p.goto(pg.url, { waitUntil: "networkidle", timeout: 20000 });
        // Ensure theme attribute is set
        await p.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
        }, theme);
        await p.waitForTimeout(400);

        const name = `app-${pg.name}-${theme}-${vp.name}`;
        console.log(`Capturing ${name}…`);
        await shot(p, name);
        await p.close();
      }

      await ctx.close();
    }
  }

  await browser.close();
  console.log("Done.");
})();
