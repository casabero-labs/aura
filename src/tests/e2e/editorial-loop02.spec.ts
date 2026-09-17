import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const validCsv = path.join(here, 'fixtures', 'titanic-mini.csv');

test.describe('LOOP-02 Editorial — Informe y exportar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('J03 — perfil concluye y la tabla de columnas es visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(validCsv);
    await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('profile-hero').locator('h1')).toBeVisible();
    await expect(page.getByTestId('profile-column-table')).toBeVisible();
    await expect(page.getByTestId('profile-continue-diagnosis')).toHaveText(/Ir al diagnóstico/);
    // Prioridades: una tabla (regla, columna, N/M, clasificación), no tarjetas.
    const priorities = page.getByTestId('profile-priorities').locator('table');
    await expect(priorities).toBeVisible();
    await expect(priorities.getByRole('columnheader', { name: 'Evidencia' })).toBeVisible();
    await expect(priorities.getByRole('columnheader', { name: 'Clasificación' })).toBeVisible();
  });

  test('J04 — diagnóstico: informe determinista y config en drawer', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(validCsv);
    await page.getByTestId('profile-continue-diagnosis').click({ timeout: 20_000 });
    await expect(page.getByTestId('diagnosis-hero-panel')).toBeVisible();
    await page.getByTestId('diagnosis-config-toggle').click();
    await expect(page.getByTestId('diagnosis-quick-config-modal')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('diagnosis-quick-config-modal')).toHaveCount(0);
    await expect(page.getByTestId('diagnosis-config-toggle')).toBeFocused();
    const deterministic = page.getByRole('button', { name: /informe determinista|Continuar sin diagnóstico/i });
    await expect(deterministic.first()).toBeVisible();
    await deterministic.first().click();
    await expect(page.getByTestId('diagnostic-report-executive-summary')).toBeVisible({ timeout: 20_000 });
  });

  test('J07 — la conclusión del informe precede a la invocación', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(validCsv);
    await page.getByTestId('profile-continue-diagnosis').click({ timeout: 20_000 });
    const deterministic = page.getByRole('button', { name: /informe determinista|Continuar sin diagnóstico/i });
    await deterministic.first().click();
    const conclusion = page.getByTestId('diagnostic-report-executive-summary');
    await expect(conclusion).toBeVisible({ timeout: 20_000 });
    const invocation = page.getByTestId('diagnostic-invocation-disclosure');
    const conclusionBox = await conclusion.boundingBox();
    const invocationBox = await invocation.boundingBox();
    expect(conclusionBox && invocationBox && conclusionBox.y < invocationBox.y).toBeTruthy();
    await page.getByTestId('diagnostic-report-export-main').click();
    await expect(page.getByTestId('export-stage')).toBeVisible();
    // Una zona de acción: el cierre inferior orienta sin duplicar el botón.
    await expect(page.getByTestId('diagnostic-report-export-choice').getByRole('button')).toHaveCount(0);
    // Exportación: una recomendada frente a alternativas.
    await expect(page.getByText('Recomendado · expediente completo')).toBeVisible();
  });
});
