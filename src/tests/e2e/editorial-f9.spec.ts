import { test, expect } from '@playwright/test';

test.describe('F9 — exclusividad Editorial', () => {
  test('canvas, tipo y tema no son Ink ni Warm', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await expect(page.locator('html')).toHaveAttribute('data-casabero-theme', 'editorial');
    await expect(page.locator('.editorial-pilot')).toHaveCount(0);

    const tokens = await page.locator('html').evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.getPropertyValue('--bg').trim().toLowerCase(),
        ink: s.getPropertyValue('--ink').trim().toLowerCase(),
        fontSans: s.getPropertyValue('--font-sans'),
        fontSerif: s.getPropertyValue('--font-serif'),
        shadow: s.getPropertyValue('--shadow-card-subtle').trim(),
      };
    });

    expect(tokens.bg).toBe('#ffffff');
    expect(tokens.ink).toBe('#191919');
    expect(tokens.fontSans).toContain('Source Sans 3');
    expect(tokens.fontSerif).toContain('Source Serif 4');
    expect(tokens.fontSans).not.toContain('Inter');
    expect(tokens.fontSerif).not.toContain('Inter');
    expect(tokens.shadow === 'none' || tokens.shadow === '').toBeTruthy();
  });
});
