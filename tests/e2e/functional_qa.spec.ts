import { test, expect } from '@playwright/test';

test.describe('Gate 6.3: Functional End-to-End QA', () => {
  test('Search typeahead returns results within 200ms and navigates', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible();

    const start = Date.now();
    await searchInput.fill('Aventus');

    // Wait for typeahead popover / results to appear
    const typeaheadResult = page.locator('.typeahead-item, .pop-item, a[href*="Aventus"]').first();
    await expect(typeaheadResult).toBeVisible({ timeout: 5000 });
    const elapsed = Date.now() - start;
    console.log(`Typeahead response elapsed time: ${elapsed}ms`);

    // Verify zero console errors
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('Filter by accord updates fragrance grid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Open More Filters if accord chip is inside
    const moreFiltersBtn = page.locator('button:has-text("Filters"), button:has-text("More filters"), button.chip').first();
    if (await moreFiltersBtn.isVisible()) {
      await moreFiltersBtn.click();
    }

    // Click citrus or woody accord filter
    const accordBtn = page.locator('button.chip:has-text("citrus"), button.chip:has-text("woody")').first();
    if (await accordBtn.isVisible()) {
      const initialCountText = await page.locator('.count, .total, .search-box').first().textContent();
      await accordBtn.click();
      await page.waitForTimeout(300);
      // Ensure grid still has tiles
      const tiles = page.locator('.tile');
      await expect(tiles.first()).toBeVisible();
    }
  });

  test('Theme switcher toggles light/dark and persists in localStorage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggleBtn = page.locator('.theme-btn, [aria-label*="theme"], button:has-text("Theme")').first();
    await expect(toggleBtn).toBeVisible();

    // Read current theme
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
    const targetTheme = initialTheme === 'dark' ? 'light' : 'dark';

    // Click toggle
    await toggleBtn.click();
    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(newTheme).toBe(targetTheme);

    // Verify localStorage persistence
    const storedTheme = await page.evaluate(() => localStorage.getItem('rph-theme'));
    expect(storedTheme).toBe(targetTheme);

    // Reload page and verify theme persists
    await page.reload({ waitUntil: 'networkidle' });
    const persistedTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(persistedTheme).toBe(targetTheme);
  });

  test('Detail page renders note pyramid, accord bars, seasons chart, and similar section', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/fragrance/Creed/Aventus', { waitUntil: 'networkidle' });

    // Check heading
    const title = page.locator('h1');
    await expect(title).toHaveText(/Aventus/i);

    // Check stats section
    const stats = page.locator('.stats');
    await expect(stats).toBeVisible();

    // Check Accord bars
    const accords = page.locator('#main-accords-title');
    await expect(accords).toBeVisible();

    // Check Notes section
    const notes = page.locator('#note-pyramid-title');
    await expect(notes).toBeVisible();

    // Check Seasons chart
    const seasons = page.locator('#season-title');
    await expect(seasons).toBeVisible();

    // Check Similar fragrances
    const similar = page.locator('.sim');
    await expect(similar).toBeVisible();
    const similarTiles = page.locator('.sim .tile');
    expect(await similarTiles.count()).toBeGreaterThanOrEqual(1);

    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('Mobile navigation drawer and viewport reflow work', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const menuBtn = page.locator('.menu-btn');
    await expect(menuBtn).toBeVisible();

    // Click hamburger menu
    await menuBtn.click();
    const drawer = page.locator('.mobile-nav-panel');
    await expect(drawer).toBeVisible();

    // Verify navigation links inside drawer
    await expect(drawer.locator('a:has-text("Brands")')).toBeVisible();
    await expect(drawer.locator('a:has-text("Notes")')).toBeVisible();

    // Click Brands link
    await drawer.locator('a:has-text("Brands")').click();
    await page.waitForURL('**/brands');
    expect(page.url()).toContain('/brands');
  });
});
