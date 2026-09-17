import { test, expect } from '@playwright/test';

test.describe('LOOP-03 Editorial — Laboratorio', () => {
  test('J12 — Laboratorio vacío muestra insumos, no un dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Laboratorio' }).click();
    const lab = page.getByTestId('oe4-campaign-lab');
    await expect(lab).toBeVisible({ timeout: 15_000 });
    await expect(lab).toHaveAttribute('data-lab-view', 'setup');
    await expect(page.getByRole('heading', { name: 'Laboratorio de evaluación LLM' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Crear experimento/i })).toBeVisible();
  });

  test('J17 — standalone Ollama es Editorial y ofrece volver', async ({ page }) => {
    await page.goto('/?view=ollama-setup', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-casabero-theme', 'editorial');
    await expect(page.getByTestId('ollama-standalone-view')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cerrar y volver a AURA/i })).toBeVisible();
  });

  // J13 vive en `src/__tests__/CampaignResultsExplorer.test.tsx` (teclado
  // determinista sobre fixture). La campaña controlada E2E exige modelos
  // instalados (`formalModelsInstalled`); sin ellos ni este spec ni
  // `oe4-p1-04-ux` pueden crear el experimento en este entorno.
});
