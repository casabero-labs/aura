import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');
const screenshotDir = path.resolve(__dirname, '../../docs/qa');
const regressionDir = path.resolve(__dirname, '../../docs/qa/ui-regression-2026-06-15');
const aestheticDir = path.resolve(__dirname, '../../docs/qa/casabero-aesthetic-reset-2026-06-15');

test.describe('AURA QA — Human-first screenshots', () => {
  test('Desktop 1280x900 — flujo completo con screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await page.screenshot({ path: path.join(screenshotDir, '01-aura-home-desktop.png'), fullPage: false });

    // Upload
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '02-aura-profile-desktop.png'), fullPage: false });

    // Profile → expand technical details
    const profileTech = page.locator('details.technical-details');
    if (await profileTech.count() > 0) {
      await profileTech.first().locator('> summary.technical-details-summary').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotDir, '02b-profile-tech-open-desktop.png'), fullPage: false });
      await profileTech.first().locator('> summary.technical-details-summary').click();
    }

    // Go to Diagnosis
    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '03-aura-diagnosis-desktop.png'), fullPage: false });

    // Go to Script → generate fallback
    await page.getByRole('button', { name: /Generar script/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Generar script/i }).click();
    await expect(page.locator('.script-review')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '04-aura-script-desktop.png'), fullPage: false });

    // Go to Review → approve
    await page.getByRole('button', { name: /Revisar script/i }).click();
    await page.waitForTimeout(300);
    const scriptScroll = page.locator('.script-scroll');
    await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Aprobar script/i }).click();
    await expect(page.locator('.review-delta')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '05-aura-review-desktop.png'), fullPage: false });

    // Go to Export
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '06-aura-export-desktop.png'), fullPage: false });

    // Go to Lab
    const navMenu = page.locator('.nav-center-menu');
    await navMenu.getByRole('button', { name: 'Laboratorio' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '07-aura-lab-desktop.png'), fullPage: false });

    // Back to Auditoría
    await navMenu.getByRole('button', { name: 'Auditoría' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '08-aura-auditoria-return-desktop.png'), fullPage: false });
  });

  test('Mobile 390x844 — upload, perfil, Lab nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await page.screenshot({ path: path.join(screenshotDir, '09-aura-home-mobile.png'), fullPage: false });

    // Upload on mobile
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '10-aura-profile-mobile.png'), fullPage: false });

    // Lab on mobile
    const navMenu = page.locator('.nav-center-menu');
    const mobileHamburger = page.locator('.mobile-nav-toggle');
    const hamburgerVisible = await mobileHamburger.isVisible().catch(() => false);
    if (hamburgerVisible) {
      await mobileHamburger.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(screenshotDir, '11-aura-lab-nav-mobile.png'), fullPage: false });
  });

  test('Visual regression — Loop 04 screenshots', async ({ page }) => {
    fs.mkdirSync(regressionDir, { recursive: true });

    // Desktop 1280x900 — home
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(regressionDir, 'desktop-home-after.png'), fullPage: false });

    // Mobile 390x844 — home (menu closed)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(regressionDir, 'mobile-home-after.png'), fullPage: false });

    // Mobile 390x844 — menu open
    const hamburger = page.locator('.mobile-nav-toggle');
    await hamburger.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(regressionDir, 'mobile-nav-open-after.png'), fullPage: false });
  });

  test('Casabero aesthetic reset — Loop 05B screenshots', async ({ page }) => {
    fs.mkdirSync(aestheticDir, { recursive: true });

    // 01 — Desktop home
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(aestheticDir, '01-home-desktop.png'), fullPage: false });

    // 02 — Upload → Profile
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(aestheticDir, '02-profile-desktop.png'), fullPage: false });

    // 03 — Diagnosis (go to diagnosis)
    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(aestheticDir, '03-diagnosis-desktop.png'), fullPage: false });

    // 04 — Script (generate fallback)
    await page.getByRole('button', { name: /Generar script/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Generar script/i }).click();
    await expect(page.locator('.script-review')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '04-script-desktop.png'), fullPage: false });

    // 05 — Review (approve)
    await page.getByRole('button', { name: /Revisar script/i }).click();
    await page.waitForTimeout(300);
    const scriptScroll = page.locator('.script-scroll');
    await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Aprobar script/i }).click();
    await expect(page.locator('.review-delta')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '05-review-desktop.png'), fullPage: false });

    // 06 — Export
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '06-export-desktop.png'), fullPage: false });

    // 07 — Lab
    const navMenu = page.locator('.nav-center-menu');
    await navMenu.getByRole('button', { name: 'Laboratorio' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '07-lab-desktop.png'), fullPage: false });

    // 08 — Mobile home
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(aestheticDir, '08-home-mobile.png'), fullPage: false });

    // 09 — Mobile profile
    await page.setInputFiles('input[type="file"]', fixtureCsv);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(aestheticDir, '09-profile-mobile.png'), fullPage: false });

    // 10 — Mobile nav open
    const hamburger = page.locator('.mobile-nav-toggle');
    await hamburger.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(aestheticDir, '10-mobile-nav-open.png'), fullPage: false });
  });
});
