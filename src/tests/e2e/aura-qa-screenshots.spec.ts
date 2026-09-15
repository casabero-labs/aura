import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');
const screenshotDir = path.resolve(__dirname, '../../../docs/qa');
const regressionDir = path.resolve(__dirname, '../../../docs/qa/ui-regression-2026-06-15');
const aestheticDir = path.resolve(__dirname, '../../../docs/qa/casabero-aesthetic-reset-2026-06-15');
const brandDir = path.resolve(__dirname, '../../../docs/qa/aura-ux-brand-issue-40');

test.describe('AURA QA — Human-first screenshots', () => {
  test('Issue #40 — Home brand and CTA in light/dark desktop/mobile', async ({ page }) => {
    fs.mkdirSync(brandDir, { recursive: true });
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const cases = [
      { name: 'light-desktop', theme: 'light', width: 1440, height: 900 },
      { name: 'dark-desktop', theme: 'dark', width: 1440, height: 900 },
      { name: 'light-mobile', theme: 'light', width: 390, height: 844 },
      { name: 'dark-mobile', theme: 'dark', width: 390, height: 844 },
    ] as const;

    for (const scenario of cases) {
      consoleErrors.length = 0;
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.evaluate((theme) => {
        localStorage.setItem('aura_theme', theme);
      }, scenario.theme);
      await page.reload({ waitUntil: 'domcontentloaded' });

      const mark = page.locator('.nav-brand .aura-mark');
      const cta = page.getByRole('button', { name: 'Empezar auditoría' });
      await expect(mark).toBeVisible();
      await expect(cta).toBeVisible();
      await expect(mark.locator('ellipse')).toHaveCount(3);
      await expect(mark.locator('rect, path, circle, polygon, polyline, line')).toHaveCount(0);

      const styles = await cta.evaluate((element) => {
        const computed = getComputedStyle(element);
        const inkProbe = document.createElement('span');
        inkProbe.style.color = 'var(--ink)';
        document.body.appendChild(inkProbe);
        const ink = getComputedStyle(inkProbe).color;
        inkProbe.remove();
        return {
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderTopColor,
          borderRadius: computed.borderRadius,
          color: computed.color,
          height: computed.height,
          ink,
          minWidth: computed.minWidth,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(styles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(styles.color).toBe(styles.ink);
      expect(styles.borderColor).toBe(styles.ink);
      expect(styles.borderRadius).toBe('6px');
      expect(styles.height).toBe('44px');
      expect(styles.minWidth).toBe('120px');
      expect(styles.overflow).toBeLessThanOrEqual(0);
      expect(consoleErrors).toEqual([]);

      await page.screenshot({
        path: path.join(brandDir, `${scenario.name}.png`),
        fullPage: false,
      });
    }
  });

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
    await page.locator('.profile-actions').getByRole('button', { name: /al diagnóstico/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '03-aura-diagnosis-desktop.png'), fullPage: false });

    // Generate diagnosis (may be disabled if no AI provider in headless Playwright)
    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await page.waitForTimeout(500);
    const diagnosisGenBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const diagnosisBtnEnabled = await diagnosisGenBtn.isEnabled().catch(() => false);

    const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar al reporte diagnóstico/i });
    const skipBtn = diagnosisStage.getByRole('button', { name: /Continuar sin diagnóstico/i });

    if (diagnosisBtnEnabled) {
      await diagnosisGenBtn.click();
      await page.waitForTimeout(5000);

      const hasContinue = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const hasSkip = await skipBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasContinue) {
        await continueBtn.click();
      } else if (hasSkip) {
        await skipBtn.click();
      } else {
        await page.waitForTimeout(2000);
        const hasSkipNow = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSkipNow) {
          await skipBtn.click();
        } else {
          throw new Error('Neither "Continuar al reporte diagnóstico" nor "Continuar sin diagnóstico" appeared');
        }
      }
    } else {
      const hasSkip = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSkip) {
        await skipBtn.click();
      } else {
        throw new Error('Diagnosis button disabled and "Continuar sin diagnóstico" not available');
      }
    }
    await page.waitForTimeout(300);

    // Generate script
    const scriptStage = page.locator('[data-testid="script-stage"]');
    await scriptStage.getByRole('button', { name: /Generar propuesta/i }).click();
    await page.waitForTimeout(8000);
    await expect(scriptStage.locator('.script-preview-section')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '04-aura-script-desktop.png'), fullPage: false });

    // Go to Review → approve
    await scriptStage.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Revisar propuesta/i }).click();
    await page.waitForTimeout(300);
    const scriptScroll = page.locator('.script-scroll');
    await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Aprobar script/i }).click();
    await expect(page.locator('.review-delta')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '05-aura-review-desktop.png'), fullPage: false });

    // Go to Export
    await page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '06-aura-export-desktop.png'), fullPage: false });

    await expect(page.getByRole('button', { name: 'Laboratorio' })).toHaveCount(0);
  });

  test('Mobile 390x844 — upload y perfil', async ({ page }) => {
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
    await page.locator('.profile-actions').getByRole('button', { name: /al diagnóstico/i }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(aestheticDir, '03-diagnosis-desktop.png'), fullPage: false });

    // 04 — Script (generate script, handle diagnosis fallback)
    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await page.waitForTimeout(500);
    const diagnosisGenBtn4 = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const diagnosisBtnEnabled4 = await diagnosisGenBtn4.isEnabled().catch(() => false);

    const continueBtn4 = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar al reporte diagnóstico/i });
    const skipBtn4 = diagnosisStage.getByRole('button', { name: /Continuar sin diagnóstico/i });

    if (diagnosisBtnEnabled4) {
      await diagnosisGenBtn4.click();
      await page.waitForTimeout(5000);

      const hasContinue4 = await continueBtn4.isVisible({ timeout: 5000 }).catch(() => false);
      const hasSkip4 = await skipBtn4.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasContinue4) {
        await continueBtn4.click();
      } else if (hasSkip4) {
        await skipBtn4.click();
      } else {
        await page.waitForTimeout(2000);
        const hasSkipNow4 = await skipBtn4.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSkipNow4) {
          await skipBtn4.click();
        } else {
          throw new Error('Neither "Continuar al reporte diagnóstico" nor "Continuar sin diagnóstico" appeared');
        }
      }
    } else {
      const hasSkip4 = await skipBtn4.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSkip4) {
        await skipBtn4.click();
      } else {
        throw new Error('Diagnosis button disabled and "Continuar sin diagnóstico" not available');
      }
    }
    await page.waitForTimeout(300);

    const scriptStage = page.locator('[data-testid="script-stage"]');
    await scriptStage.getByRole('button', { name: /Generar propuesta/i }).click();
    await page.waitForTimeout(8000);
    await expect(scriptStage.locator('.script-preview-section')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '04-script-desktop.png'), fullPage: false });

    // 05 — Review (approve)
    await scriptStage.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Revisar propuesta/i }).click();
    await page.waitForTimeout(300);
    const scriptScroll = page.locator('.script-scroll');
    await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Aprobar script/i }).click();
    await expect(page.locator('.review-delta')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '05-review-desktop.png'), fullPage: false });

    // 06 — Export
    await page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(aestheticDir, '06-export-desktop.png'), fullPage: false });

    // 07 — Mobile home
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
