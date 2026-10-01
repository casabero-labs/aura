/**
 * Reaches ImprovementRunPanel through its only remaining mount point.
 *
 * The "Health Delta" nav entry was retired (decision 2026-07-11). The panel
 * now renders inside ReviewStep's technical details, and only after a script
 * on the historical (non-V2) route is approved and simulated. That route has
 * no stepper entry, so the walk jumps to `script` through the Phase 4 E2E
 * harness, generates the deterministic proposal, reviews and approves it.
 *
 * `query` is appended to `/` so demo flags (`?demoMode=1`,
 * `?phase7Visual=running|error`) are read when the panel mounts.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(here, '../fixtures/titanic-mini.csv');

export async function openImprovementRunPanel(page: Page, query = ''): Promise<Locator> {
  await page.goto(`/${query}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('button', { name: 'Empezar auditoría' }).click();
  await page.getByTestId('csv-file-input').setInputFiles(fixtureCsv);
  await page.getByTestId('profile-continue-diagnosis').waitFor({ state: 'visible', timeout: 20_000 });

  await page.waitForFunction(() => typeof (window as any).__PHASE4_SET_STATE__ === 'function');
  await page.evaluate(() => (window as any).__PHASE4_SET_STATE__('script'));

  const scriptStage = page.getByTestId('script-stage');
  await scriptStage.getByRole('button', { name: /Generar propuesta/i }).click();
  await expect(scriptStage.locator('.script-preview-section')).toBeVisible({ timeout: 20_000 });
  await scriptStage.getByTestId('primary-stage-action').getByRole('button', { name: /Revisar propuesta/i }).click();

  const review = page.getByTestId('review-stage');
  await review.locator('.script-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await review.getByRole('button', { name: /Aprobar script/i }).click();
  await expect(review.locator('.review-delta')).toBeVisible({ timeout: 15_000 });

  await review.getByTestId('technical-details').locator('summary').click();
  const panel = page.getByTestId('improvement-run-panel');
  await expect(panel).toBeVisible();
  return panel;
}
