/**
 * Phase 7 Loop 2B — Visual Evidence: Running & Error State Fix.
 *
 * Uses a minimal visual testability harness in ImprovementRunPanel:
 * - ?phase7Visual=running  → forces running state for 3s, then done (visual mock)
 * - ?phase7Visual=error   → forces error state immediately (visual mock)
 *
 * MOCK VISUAL NOTE:
 * Both running and error states use the VISUAL HARNESS (query param).
 * These are VISUAL MOCKS — NOT real execution failures.
 * The harness does NOT:
 *   - Execute Python in AURA
 *   - Use real datasets
 *   - Make external network calls
 *   - Depend on Gemini Nano or Chrome AI
 *
 * For real execution screenshots (idle, done), see L2 tests.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase_07');

async function takeScreenshot(page: any, filename: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: false,
  });
}

test.describe('Phase 7 L2B — Visual Evidence: Running & Error State', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('E2E-HD-SS-002 — healthdelta_running.png (visual harness)', async ({ page }) => {
    // Navigate with visual harness query param
    await page.goto('/?phase7Visual=running', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    const navCenterMenu = page.locator('.nav-center-menu');
    await navCenterMenu.getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);

    const runningState = page.locator('[data-testid="running-state"]');
    await expect(runningState).toBeVisible({ timeout: 5000 });

    // Take screenshot while in running state (harness keeps it for 3 seconds)
    await takeScreenshot(page, 'healthdelta_running.png');
  });

  test('E2E-HD-SS-006 — healthdelta_error.png (visual harness)', async ({ page }) => {
    // Navigate with visual harness query param
    await page.goto('/?phase7Visual=error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    const navCenterMenu = page.locator('.nav-center-menu');
    await navCenterMenu.getByRole('button', { name: 'Health Delta' }).click();
    await page.waitForTimeout(300);

    const errorState = page.locator('[data-testid="error-state"]');
    await expect(errorState).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'healthdelta_error.png');
  });

});
