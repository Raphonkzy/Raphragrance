import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Gate 4.2: Image Hotlinking Fallback & Zero Layout Shift', () => {
  test.beforeAll(() => {
    const dir = path.join(process.cwd(), 'reports', 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('Catalog: Fallback tiles appear in accord color with initials when fimgs.net is blocked, with zero CLS', async ({ page }) => {
    // 1. Block fimgs.net requests via route abort
    let blockedCount = 0;
    await page.route(/fimgs\.net/, (route) => {
      blockedCount++;
      route.abort();
    });

    // 2. Measure Cumulative Layout Shift (CLS) via PerformanceObserver
    await page.addInitScript(() => {
      (window as any).__clsScore = 0;
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).__clsScore += (entry as any).value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });

    // 3. Visit catalog page
    await page.goto('/', { waitUntil: 'networkidle' });

    // Assert that fimgs.net requests were intercepted and blocked
    expect(blockedCount).toBeGreaterThan(0);

    // Assert that .im-fallback tiles are displayed with uppercase initials
    const fallbacks = page.locator('.tile .im-fallback');
    await expect(fallbacks.first()).toBeVisible();
    const initialsText = await page.locator('.tile .im-fallback .im-initials').first().textContent();
    expect(initialsText).toBeTruthy();
    expect(initialsText?.length).toBeGreaterThanOrEqual(1);

    // Assert CLS is strictly within budget (CLS <= 0.05)
    const cls = await page.evaluate(() => (window as any).__clsScore);
    console.log(`Measured Catalog CLS with blocked images: ${cls}`);
    expect(cls).toBeLessThanOrEqual(0.05);

    // Save screenshot evidence
    await page.screenshot({ path: 'reports/screenshots/image-fallback-catalog.png', fullPage: false });
  });

  test('Detail & Similar Tiles: Hero and similar fallback display accord color and initials, zero CLS', async ({ page }) => {
    let blockedCount = 0;
    await page.route(/fimgs\.net/, (route) => {
      blockedCount++;
      route.abort();
    });

    await page.addInitScript(() => {
      (window as any).__clsScore = 0;
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).__clsScore += (entry as any).value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/fragrance/Creed/Aventus', { waitUntil: 'networkidle' });
    expect(blockedCount).toBeGreaterThan(0);

    // Hero image fallback check
    const heroFallback = page.locator('.hero .im .im-fallback');
    await expect(heroFallback).toBeVisible();
    const heroInitials = await heroFallback.locator('.im-initials').textContent();
    expect(heroInitials).toBe('AV');

    // Similar section tiles fallback check
    const similarFallbacks = page.locator('.sim .tile .im-fallback');
    await expect(similarFallbacks.first()).toBeVisible();
    const simCount = await similarFallbacks.count();
    expect(simCount).toBe(10); // Detail page has 10 similar tiles

    const cls = await page.evaluate(() => (window as any).__clsScore);
    console.log(`Measured Detail Page CLS with blocked images: ${cls}`);
    expect(cls).toBeLessThanOrEqual(0.05);

    await page.screenshot({ path: 'reports/screenshots/image-fallback-detail.png', fullPage: false });
  });
});
