import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const validCsv = path.join(here, 'fixtures', 'titanic-mini.csv');

test.describe('LOOP-02 U06 — corregir una copia', () => {
  test('informe determinista: exportar no exige script; corregir lo declara', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(validCsv);
    await page.getByTestId('profile-continue-diagnosis').click({ timeout: 20_000 });
    await page.getByRole('button', { name: /informe determinista|Continuar sin diagnóstico/i }).first().click();
    await expect(page.getByTestId('diagnostic-report-executive-summary')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('diagnostic-report-generate-script-top')).toBeDisabled();
    await page.getByTestId('diagnostic-report-export-main').click();
    await expect(page.getByTestId('export-stage')).toBeVisible();
  });

  test('el informe explica que la corrección verificada no está en la ruta determinista', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(validCsv);
    await page.getByTestId('profile-continue-diagnosis').click({ timeout: 20_000 });
    await page.getByRole('button', { name: /informe determinista|Continuar sin diagnóstico/i }).first().click();
    await expect(page.getByTestId('diagnostic-report-executive-summary')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#remediation-availability')).toContainText(/corrección/i);
  });
});
