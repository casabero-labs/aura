import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = path.resolve(__dirname, './fixtures/aura_l9_dataset_control.csv');

test.describe('P1-04 UX enhancements', () => {

  test('Benchmark Lab uses "experimento" not "campaña" in visible text', async ({ page }) => {
    await page.goto('/');
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Laboratorio' }).click();
    await expect(page.getByTestId('oe4-campaign-lab')).toBeVisible({ timeout: 10000 });

    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText.toLowerCase()).toContain('experimento');
    expect(bodyText.toLowerCase()).not.toContain('campaña');
  });

  test('Nueva sesión cancel preserves state', async ({ page }) => {
    await page.goto('/');
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Auditoría' }).click();

    const fileInput = page.getByTestId('csv-file-input');
    await fileInput.setInputFiles(FIXTURE_CSV);

    await page.getByTestId('profile-hero').waitFor({ state: 'visible', timeout: 30000 });

    const resetBtn = page.getByTestId('nav-new-analysis');
    await expect(resetBtn).toBeVisible({ timeout: 5000 });
    await resetBtn.click();

    await expect(page.getByTestId('new-analysis-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('new-analysis-dialog')).toBeHidden({ timeout: 5000 });

    await expect(page.getByTestId('profile-hero')).toBeVisible();
  });

  test('Nueva sesión confirm clears state and shows success message', async ({ page }) => {
    await page.goto('/');
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('.nav-center-menu').getByRole('button', { name: 'Auditoría' }).click();

    const fileInput = page.getByTestId('csv-file-input');
    await fileInput.setInputFiles(FIXTURE_CSV);

    await page.getByTestId('profile-hero').waitFor({ state: 'visible', timeout: 30000 });

    const resetBtn = page.getByTestId('nav-new-analysis');
    await expect(resetBtn).toBeVisible({ timeout: 5000 });
    await resetBtn.click();

    await expect(page.getByTestId('new-analysis-dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('new-analysis-confirm').click();

    await expect(page.getByTestId('new-session-msg')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('new-session-msg')).toContainText('Nueva sesión iniciada');
  });

});
