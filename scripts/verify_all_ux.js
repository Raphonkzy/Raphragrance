const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "../reports/ux-verification");
fs.mkdirSync(OUT, { recursive: true });

async function run() {
  const browser = await chromium.launch();
  let failed = false;

  console.log("=========================================");
  console.log(" Running Comprehensive UI/UX Verification");
  console.log("=========================================\n");

  // 1. Mobile Catalog Check
  {
    console.log("1. Checking Mobile Catalog (390x844)...");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

    // Verify 2 columns in grid
    const gridCols = await page.evaluate(() => {
      const grid = document.querySelector(".grid");
      if (!grid) return null;
      return window.getComputedStyle(grid).gridTemplateColumns;
    });
    console.log("   Mobile .grid grid-template-columns:", gridCols);

    const cards = await page.$$(".tile");
    console.log(`   Found ${cards.length} fragrance cards in catalog.`);
    if (cards.length >= 2) {
      const box1 = await cards[0].boundingBox();
      const box2 = await cards[1].boundingBox();
      const sideBySide = Math.abs(box1.y - box2.y) < 20 && box2.x > box1.x;
      console.log(`   Cards 1 & 2 side-by-side: ${sideBySide} (card1.x=${box1?.x.toFixed(0)}, card2.x=${box2?.x.toFixed(0)})`);
      if (!sideBySide) {
        console.error("   [FAIL] Expected 2 cards per row on mobile!");
        failed = true;
      } else {
        console.log("   [PASS] 2 cards per row confirmed on mobile.");
      }
    }

    // Verify Search Bar components
    const searchInput = await page.$('input.q');
    const searchIcon = await page.$('.search-icon');
    console.log("   Search input exists:", !!searchInput);
    console.log("   Search icon exists:", !!searchIcon);

    // Test Search input and clear
    await searchInput.fill("Dior");
    await page.waitForTimeout(300);
    const clearBtn = await page.$('.search-clear-btn');
    console.log("   Clear button appears when query filled:", !!clearBtn);
    if (!clearBtn) {
      console.error("   [FAIL] Clear button should be visible when search is not empty");
      failed = true;
    } else {
      await clearBtn.click();
      const valAfterClear = await searchInput.inputValue();
      console.log("   Search input value after clear:", JSON.stringify(valAfterClear));
      if (valAfterClear !== "") {
        console.error("   [FAIL] Search input should be empty after clear click");
        failed = true;
      } else {
        console.log("   [PASS] Search clear button successfully clears the query.");
      }
    }

    await page.screenshot({ path: path.join(OUT, "mobile-catalog.png") });
    await page.close();
  }

  // 2. Mobile Detail Page Check
  {
    console.log("\n2. Checking Mobile Detail Page (390x844)...");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:3000/fragrance/Dior/Sauvage", { waitUntil: "networkidle" });

    // Hero vitrine centering
    const heroMetrics = await page.evaluate(() => {
      const hero = document.querySelector(".hero");
      const im = hero?.querySelector(".im");
      if (!hero || !im) return null;
      const heroRect = hero.getBoundingClientRect();
      const imRect = im.getBoundingClientRect();
      const style = window.getComputedStyle(im);
      return {
        heroWidth: heroRect.width,
        imWidth: imRect.width,
        imLeft: imRect.left - heroRect.left,
        imRight: heroRect.right - imRect.right,
        margin: style.margin,
        backgroundColor: style.backgroundColor
      };
    });

    console.log("   Mobile hero .im metrics:", heroMetrics);
    if (heroMetrics) {
      const diff = Math.abs(heroMetrics.imLeft - heroMetrics.imRight);
      console.log(`   Centering offset difference: ${diff.toFixed(1)}px`);
      if (diff > 5) {
        console.error("   [FAIL] Hero image not horizontally centered on mobile!");
        failed = true;
      } else {
        console.log("   [PASS] Hero vitrine is horizontally centered on mobile.");
      }
    }

    // Stats checks: Sillage and Longevity clean score display (no "/ 5" space-wasting suffix)
    const statsText = await page.evaluate(() => {
      const stats = document.querySelector(".stats");
      if (!stats) return null;
      return stats.textContent;
    });
    console.log("   Stats content:", statsText?.replace(/\s+/g, " "));

    const hasCleanLongevity = statsText && /Longevity\s*[\d.]+\s*(?!.*\/\s*5)/.test(statsText);
    const hasSlash5 = statsText && /\/\s*5/.test(statsText);

    console.log("   Has redundant '/ 5' in stats:", hasSlash5);
    if (hasSlash5) {
      console.error("   [FAIL] Found redundant '/ 5' suffix in score display!");
      failed = true;
    } else {
      console.log("   [PASS] Clean compact score format verified (no '/ 5').");
    }

    // Check rendered Similar Fragrances section
    const similarTitles = await page.evaluate(() => {
      const tiles = document.querySelectorAll(".sim .tile .tn");
      return Array.from(tiles).map(t => t.textContent?.trim()).filter(Boolean);
    });
    console.log("   Rendered Similar Fragrances on Sauvage page:", similarTitles);

    await page.screenshot({ path: path.join(OUT, "mobile-detail.png") });
    await page.close();
  }

  // 3. Desktop Detail Page Check
  {
    console.log("\n3. Checking Desktop Detail Page (1440x900)...");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000/fragrance/Dior/Sauvage", { waitUntil: "networkidle" });

    // Check Vitrine styling (no tint / clean background)
    const vitrineStyle = await page.evaluate(() => {
      const im = document.querySelector(".hero .im");
      const img = im?.querySelector("img");
      if (!im || !img) return null;
      return {
        imBg: window.getComputedStyle(im).backgroundColor,
        imgBlend: window.getComputedStyle(img).mixBlendMode,
        imgFilter: window.getComputedStyle(img).filter
      };
    });
    console.log("   Vitrine styling:", vitrineStyle);

    await page.screenshot({ path: path.join(OUT, "desktop-detail.png") });
    await page.close();
  }

  // 4. Similarity / Clone Twin Check via API
  {
    console.log("\n4. Checking Fragrance Twin / Similarity Algorithm...");
    const page = await browser.newPage();
    // Search for supremacy collector
    const searchRes = await page.goto("http://localhost:3000/api/fragrances?q=Supremacy", { waitUntil: "networkidle" });
    const searchJson = await searchRes.json();
    console.log(`   Found ${searchJson.data?.length} fragrances matching 'Supremacy':`);
    const collector = searchJson.data?.find(f => f.name.toLowerCase().includes("collector") || f.name.toLowerCase().includes("not only intense"));
    if (collector) {
      console.log(`   Testing similarity for: ${collector.name} (${collector.brand}, id=${collector.id})`);
      const simRes = await page.goto(`http://localhost:3000/api/fragrances/${collector.id}/similar`, { waitUntil: "networkidle" });
      const simJson = await simRes.json();
      console.log("   Similar fragrances returned:", simJson.data?.map(s => `${s.name} (${s.brand})`));
      const hasAventus = simJson.data?.some(s => s.name.toLowerCase().includes("aventus") || s.name.toLowerCase().includes("club de nuit"));
      console.log("   Matches Aventus / Club De Nuit DNA family:", hasAventus);
      if (!hasAventus) {
        console.warn("   [WARN] Aventus DNA not detected in top similar matches");
      } else {
        console.log("   [PASS] Correctly matched iconic olfactory cluster twin.");
      }
    }
    await page.close();
  }

  // 5. Performance / Latency Benchmarks (No lag, fast query, fast page load)
  {
    console.log("\n5. Benchmarking Page Load & Query Latencies...");
    const page = await browser.newPage();

    const targets = [
      { name: "Catalog (Home)", url: "http://localhost:3000/" },
      { name: "Detail: Sauvage", url: "http://localhost:3000/fragrance/Dior/Sauvage" },
      { name: "Detail: Baccarat Rouge 540", url: "http://localhost:3000/fragrance/Maison-Francis-Kurkdjian/Baccarat-Rouge-540" },
      { name: "Detail: Light Blue", url: "http://localhost:3000/fragrance/Dolce-Gabbana/Light-Blue" },
      { name: "API: /api/fragrances?limit=30", url: "http://localhost:3000/api/fragrances?limit=30" },
      { name: "API: Search 'Aventus'", url: "http://localhost:3000/api/fragrances?q=Aventus" },
      { name: "API: Similar for Sauvage", url: "http://localhost:3000/api/fragrances/31861/similar" }
    ];

    for (const t of targets) {
      const t0 = Date.now();
      const res = await page.goto(t.url, { waitUntil: "domcontentloaded" });
      const elapsed = Date.now() - t0;
      console.log(`   ${t.name.padEnd(35)}: ${elapsed}ms (HTTP ${res?.status()})`);
      if (elapsed > 1000) {
        console.warn(`   [WARN] Latency exceeded 1000ms: ${elapsed}ms`);
      }
    }
    await page.close();
  }

  await browser.close();

  console.log("\n=========================================");
  if (failed) {
    console.error("❌ Verification failed with errors.");
    process.exit(1);
  } else {
    console.log("✅ All UI/UX verifications PASSED successfully!");
    console.log(`Screenshots saved to ${OUT}`);
  }
}

run().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
