const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

async function waitForServer(port, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error(`Server not ready on port ${port}`);
}

async function capture() {
  const outDir = path.resolve(__dirname, '..', 'reports', 'ui-verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Starting Next.js server on port 3008 for Content/Curated screenshots...');
  const server = spawn('cmd.exe', ['/c', 'npx', 'next', 'start', '-p', '3008'], {
    env: { ...process.env, PORT: '3008', INCLUDE_COMMUNITY_EDGES: 'false' },
    stdio: 'ignore'
  });

  try {
    await waitForServer(3008);
    console.log('Server ready on port 3008. Launching Chromium...');

    const browser = await chromium.launch({ headless: true });

    // 1. Desktop Light (Aventus: shows Curated pick SNOI and Shares: notes)
    console.log('Capturing Desktop Light...');
    const ctxDesktopLight = await browser.newContext({
      viewport: { width: 1280, height: 950 },
      colorScheme: 'light'
    });
    const page1 = await ctxDesktopLight.newPage();
    await page1.goto('http://localhost:3008/fragrance/Creed/Aventus', { waitUntil: 'networkidle' });
    const simSection1 = page1.locator('section.sec:has(#similar-title)');
    await simSection1.scrollIntoViewIfNeeded();
    await page1.waitForTimeout(500);
    await simSection1.screenshot({ path: path.join(outDir, 'similar-desktop-light.png') });

    // 2. Desktop Dark
    console.log('Capturing Desktop Dark...');
    const ctxDesktopDark = await browser.newContext({
      viewport: { width: 1280, height: 950 },
      colorScheme: 'dark'
    });
    const page2 = await ctxDesktopDark.newPage();
    await page2.goto('http://localhost:3008/fragrance/Creed/Aventus', { waitUntil: 'networkidle' });
    await page2.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const simSection2 = page2.locator('section.sec:has(#similar-title)');
    await simSection2.scrollIntoViewIfNeeded();
    await page2.waitForTimeout(500);
    await simSection2.screenshot({ path: path.join(outDir, 'similar-desktop-dark.png') });

    // 3. Mobile Light
    console.log('Capturing Mobile Light...');
    const ctxMobileLight = await browser.newContext({
      viewport: { width: 375, height: 812 },
      colorScheme: 'light',
      isMobile: true
    });
    const page3 = await ctxMobileLight.newPage();
    await page3.goto('http://localhost:3008/fragrance/Creed/Aventus', { waitUntil: 'networkidle' });
    const simSection3 = page3.locator('section.sec:has(#similar-title)');
    await simSection3.scrollIntoViewIfNeeded();
    await page3.waitForTimeout(500);
    await simSection3.screenshot({ path: path.join(outDir, 'similar-mobile-light.png') });

    // 4. Mobile Dark
    console.log('Capturing Mobile Dark...');
    const ctxMobileDark = await browser.newContext({
      viewport: { width: 375, height: 812 },
      colorScheme: 'dark',
      isMobile: true
    });
    const page4 = await ctxMobileDark.newPage();
    await page4.goto('http://localhost:3008/fragrance/Creed/Aventus', { waitUntil: 'networkidle' });
    await page4.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const simSection4 = page4.locator('section.sec:has(#similar-title)');
    await simSection4.scrollIntoViewIfNeeded();
    await page4.waitForTimeout(500);
    await simSection4.screenshot({ path: path.join(outDir, 'similar-mobile-dark.png') });

    await browser.close();
  } finally {
    spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1000));
  }

  // Next, capture Hybrid mode showing "Community pick"
  console.log('\nStarting Next.js server on port 3009 for Hybrid mode screenshots...');
  const serverHybrid = spawn('cmd.exe', ['/c', 'npx', 'next', 'start', '-p', '3009'], {
    env: { ...process.env, PORT: '3009', INCLUDE_COMMUNITY_EDGES: 'true' },
    stdio: 'ignore'
  });

  try {
    await waitForServer(3009);
    console.log('Hybrid Server ready on port 3009. Launching Chromium...');

    const browser = await chromium.launch({ headless: true });

    // Desktop Hybrid Light
    console.log('Capturing Hybrid Desktop Light...');
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 950 }, colorScheme: 'light' });
    const p1 = await ctx1.newPage();
    await p1.goto('http://localhost:3009/fragrance/Dior/Sauvage', { waitUntil: 'networkidle' });
    const simSectionH1 = p1.locator('section.sec:has(#similar-title)');
    await simSectionH1.scrollIntoViewIfNeeded();
    await p1.waitForTimeout(500);
    await simSectionH1.screenshot({ path: path.join(outDir, 'similar-hybrid-desktop-light.png') });

    // Desktop Hybrid Dark
    console.log('Capturing Hybrid Desktop Dark...');
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 950 }, colorScheme: 'dark' });
    const p2 = await ctx2.newPage();
    await p2.goto('http://localhost:3009/fragrance/Dior/Sauvage', { waitUntil: 'networkidle' });
    await p2.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const simSectionH2 = p2.locator('section.sec:has(#similar-title)');
    await simSectionH2.scrollIntoViewIfNeeded();
    await p2.waitForTimeout(500);
    await simSectionH2.screenshot({ path: path.join(outDir, 'similar-hybrid-desktop-dark.png') });

    await browser.close();
  } finally {
    spawn('taskkill', ['/pid', String(serverHybrid.pid), '/f', '/t'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✓ All screenshots successfully captured to reports/ui-verification/');
}

capture().catch(console.error);
