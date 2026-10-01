/**
 * Phase 7 Loop 4 — No-Regression Suite.
 *
 * Verifies that the improvement run panel (Health Delta) does NOT break:
 * - MainPipeline / Auditoría
 * - Settings / Configuración
 * - Global chrome (nav + footer)
 *
 * The panel no longer has a nav entry; it is reached through ReviewStep's
 * technical details (see helpers/improvementRunPanel.ts).
 *
 * IMPORTANT:
 * - Does NOT use dataset real.
 * - Does NOT execute Python in AURA.
 * - Does NOT use Chrome AI or Gemini Nano.
 * - Does NOT trigger real AI providers.
 */

import { test, expect, type Page } from '@playwright/test';
import { openImprovementRunPanel } from './helpers/improvementRunPanel';

// Network failures are not app regressions: Configuración probes the local
// Ollama endpoint on open and it is refused when Ollama is not running.
function collectAppErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
  });
  return errors;
}

test.describe('Phase 7 L4 — No-Regression Suite', () => {

  // ── E2E-REG-001: MainPipeline no se rompe ──

  test('E2E-REG-001 — MainPipeline intact after Health Delta round-trip', async ({ page }) => {
    const consoleErrors = collectAppErrors(page);

    await openImprovementRunPanel(page);

    await page.getByTestId('remediation-back-diagnostic-report').click();
    await expect(page.getByTestId('improvement-run-panel')).toHaveCount(0);
    await expect(page.getByTestId('review-stage')).toHaveCount(0);
    await expect(page.locator('.sys-main').first()).toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  // ── E2E-REG-003: Settings no se rompe ──

  test('E2E-REG-003 — Settings intact after visiting Health Delta', async ({ page }) => {
    const consoleErrors = collectAppErrors(page);

    await openImprovementRunPanel(page);

    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Configuración' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('improvement-run-panel')).not.toBeVisible();

    expect(consoleErrors).toHaveLength(0);
  });

  // ── E2E-REG-004: Global chrome ──
  // The footer used to hide while Health Delta was a workspace of its own.
  // That condition was retired with the nav entry (decision 2026-07-11); the
  // panel now lives inside Auditoría and must leave nav and footer in place.

  test('E2E-REG-004 — nav and footer stay in place with the panel open', async ({ page }) => {
    await openImprovementRunPanel(page);

    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    await expect(page.locator('.sys-footer')).toBeVisible();
  });

});
