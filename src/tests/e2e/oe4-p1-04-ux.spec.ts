import { expect, test } from '@playwright/test';
import { AURA_EXPERIMENT_DATABASE_NAME } from '../../services/benchmark/indexedDbExperimentStore';

const openLab = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.getByRole('button', { name: 'Laboratorio', exact: true }).first().click();
  await expect(page.getByTestId('oe4-campaign-lab')).toBeVisible();
};

const finishControlledCampaign = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.getByRole('button', { name: 'Crear experimento' }).click();
  await expect(page.getByText('25 / 27')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Reanudar experimento' }).click();
  await expect.poll(() => page.evaluate(() => window.__OE4_E2E_WAITING__ === true)).toBe(true);
  await page.evaluate(() => window.__OE4_E2E_RELEASE__?.());
  await expect(page.getByRole('status')).toContainText('Ejecución terminada', { timeout: 30_000 });
};

test.describe('Laboratorio — alcance diagnóstico y decisión automática', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async (databaseName) => {
      localStorage.removeItem('aura_oe4_e2e_first_call_released');
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();
      });
    }, AURA_EXPERIMENT_DATABASE_NAME);
    await page.reload();
  });

  test('califica automáticamente y mantiene script, HITL y remediación fuera del Laboratorio', async ({ page }) => {
    await openLab(page);
    await finishControlledCampaign(page);

    await expect(page.getByRole('heading', { name: 'Reporte listo' })).toBeVisible();
    await expect(page.getByText('Cómo califica AURA')).toBeVisible();
    await expect(page.getByText('Mejor equilibrio para AURA')).toBeVisible();
    await expect(page.getByText(/No es un juicio de otro LLM/)).toBeVisible();
    await expect(page.getByText(/La revisión humana, el script, HITL y la remediación pertenecen al pipeline normal/)).toBeVisible();
    await expect(page.getByText('Guardar evaluación humana')).toHaveCount(0);
    await expect(page.getByText('Evidencia Python')).toHaveCount(0);
    await expect(page.getByText('Aprobar representante')).toHaveCount(0);
  });

  test('muestra estados de matriz y explica los cinco artefactos del diagnóstico', async ({ page }) => {
    await openLab(page);
    await finishControlledCampaign(page);

    await expect(page.getByLabel('Leyenda de estados')).toBeVisible();
    await expect(page.locator('.oe4-matrix-cell--success')).toHaveCount(9);
    await expect(page.locator('.oe4-run-dot--success')).toHaveCount(27);

    const artifacts = page.getByRole('list', { name: 'Artefactos disponibles' });
    for (const filename of ['campaign.json', 'runs.csv', 'report.md', 'report.pdf', 'manifest.json']) {
      await expect(artifacts.getByText(filename, { exact: true })).toBeVisible();
    }
  });

  test('no ejecuta modelos antes del inicio explícito', async ({ page }) => {
    await openLab(page);
    expect(await page.evaluate(() => window.__OE4_E2E_GENERATE_CALL_COUNT__ ?? 0)).toBe(0);
    await page.getByRole('button', { name: 'Crear experimento' }).click();
    await expect(page.getByText('25 / 27')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.__OE4_E2E_GENERATE_CALL_COUNT__ ?? 0)).toBe(0);
  });
});
