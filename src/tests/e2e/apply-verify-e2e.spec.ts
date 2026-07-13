/**
 * E2E integration test for the Apply & Verify step.
 * Uses the dev fixture harness (real component, realistic data, real styling).
 * Verifies all 4 states render with proper testids and key elements.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/apply-verify');

test.describe('Apply & Verify E2E', () => {
  test('fixture ready state shows bundle download and command', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?av-fixture=ready', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('[data-testid="apply-verify-ready"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-download-bundle"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-download-source"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-command"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-copy-command"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-await-files"]')).toBeVisible();
  });

  test('fixture awaiting_external_output shows file upload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?av-fixture=awaiting_external_output', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('[data-testid="apply-verify-import"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-after-file"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-receipt-file"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-validate"]')).toBeVisible();
  });

  test('fixture verified shows execution receipt and continue', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?av-fixture=verified', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('[data-testid="apply-verify-verified"]')).toBeVisible();
    await expect(page.getByText('Python3.12.1')).toBeVisible();
    await expect(page.getByText('Pandas2.2.0')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-continue"]')).toBeVisible();
  });

  test('fixture invalid shows validation error', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?av-fixture=invalid', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('[data-testid="apply-verify-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="apply-verify-error"]')).toContainText('approvedScriptHash');
  });
});
