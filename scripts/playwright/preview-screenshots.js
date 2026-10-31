const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const url = require("url");

const OUT = path.join(__dirname, "../../reports/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const PREVIEW = path.resolve(__dirname, "../../reference/raphragrance-design-preview.html");
const PREVIEW_URL = url.pathToFileURL(PREVIEW).href;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const THEMES = ["light", "dark"];

// The preview has direction buttons; we need to click d3 and set theme
async function setPreviewTheme(page, theme) {
  // Click the d3 direction button if not already active
  try {
    const d3btn = page.locator("button", { hasText: "Direction 3" }).first();
    if (await d3btn.count() > 0) await d3btn.click();
  } catch (_) {}
  // Click the theme toggle in the preview
  if (theme === "dark") {
    try {
      const darkBtn = page.locator("[onclick*='dark'], button:has-text('Dark'), button:has-text('dark')").first();
      if (await darkBtn.count() > 0) await darkBtn.click();
    } catch (_) {}
  } else {
    try {
      const lightBtn = page.locator("[onclick*='light'], button:has-text('Light'), button:has-text('light')").first();
      if (await lightBtn.count() > 0) await lightBtn.click();
    } catch (_) {}
  }
  // Also set data-theme on html
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    // Try the preview's own theme functions
    if (typeof window.setTheme === "function") window.setTheme(t);
    if (typeof window.r3 === "function") window.r3();
  }, theme);
  await page.waitForTimeout(300);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  saved", file);
}

(async () => {
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme === "dark" ? "dark" : "light",
      });

      // Catalog view
      {
        const p = await ctx.newPage();
        await p.goto(PREVIEW_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
        await setPreviewTheme(p, theme);
        const name = `preview-catalog-${theme}-${vp.name}`;
        console.log(`Capturing ${name}…`);
        await shot(p, name);
        await p.close();
      }

      // Detail view — scroll to detail section or click a card
      {
        const p = await ctx.newPage();
        await p.goto(PREVIEW_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
        await setPreviewTheme(p, theme);
        // Try clicking first card to open detail
        try {
          const card = p.locator(".d3-card, .card, [class*='card']").first();
          if (await card.count() > 0) {
            await card.click();
            await p.waitForTimeout(600);
          } else {
            // Scroll to detail section if exists
            await p.evaluate(() => {
              const det = document.querySelector(".d3-det, .det, [class*='det']");
              if (det) det.scrollIntoView();
            });
          }
        } catch (_) {}
        const name = `preview-detail-${theme}-${vp.name}`;
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
