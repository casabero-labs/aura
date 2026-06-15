import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/titanic.csv');
const screenshotDir = path.resolve(__dirname, '../../../docs/qa/profile-casabero-reset-2026-06-15');

test.describe('Profile Casabero Reset Screenshots', () => {
  test('Desktop: profile summary', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    // Upload Titanic dataset
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(1000);

    // Take screenshot of profile summary
    await page.screenshot({ 
      path: path.join(screenshotDir, '01-profile-desktop-summary.png'), 
      fullPage: false 
    });

    // Verify main elements are visible
    await expect(page.locator('.profile-editorial-header')).toBeVisible();
    await expect(page.locator('.profile-decision-summary')).toBeVisible();
    await expect(page.locator('.profile-priorities')).toBeVisible();
    await expect(page.locator('.profile-actions')).toBeVisible();
  });

  test('Desktop: technical closed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    // Upload Titanic dataset
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(1000);

    // Take screenshot with technical details closed
    await page.screenshot({ 
      path: path.join(screenshotDir, '02-profile-technical-closed.png'), 
      fullPage: true 
    });

    // Verify technical details is closed
    const techDetails = page.locator('details.technical-details');
    await expect(techDetails).not.toHaveAttribute('open');
  });

  test('Desktop: technical open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    // Upload Titanic dataset
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(1000);

    // Open technical details using the button
    await page.getByRole('button', { name: /Ver evidencia técnica/i }).click();
    await page.waitForTimeout(500);

    // Take screenshot with technical details open
    await page.screenshot({ 
      path: path.join(screenshotDir, '03-profile-technical-open.png'), 
      fullPage: true 
    });

    // Verify technical details is open
    const techDetails = page.locator('details.technical-details');
    await expect(techDetails).toHaveAttribute('open');
  });

  test('Mobile: profile summary', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    // Upload Titanic dataset
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(1000);

    // Take screenshot of mobile profile
    await page.screenshot({ 
      path: path.join(screenshotDir, '04-profile-mobile-summary.png'), 
      fullPage: false 
    });

    // Verify no horizontal overflow
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    expect(overflowX).toBe(false);
  });
});