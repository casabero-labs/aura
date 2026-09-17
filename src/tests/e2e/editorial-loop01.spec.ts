import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const validCsv = path.join(here, 'fixtures', 'titanic-mini.csv');

test.describe('LOOP-01 Editorial — Inicio y carga', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.dataset.casaberoTheme = 'editorial';
    });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('J01 — Inicio → Auditoría → identidad de carga', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-casabero-theme', 'editorial');
    await expect(page.getByRole('heading', { name: 'Auditar un CSV' })).toBeVisible();
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await expect(page.getByRole('heading', { name: 'Cargar CSV' })).toBeVisible();
    await expect(page.getByTestId('csv-file-input')).toBeAttached();
  });

  test('J02 — CSV con extensión incorrecta muestra causa y reintento', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    const bogus = path.join(here, 'editorial-loop01.spec.ts');
    await page.getByTestId('csv-file-input').setInputFiles(bogus);
    await expect(page.getByRole('alert')).toContainText('.csv');
    await expect(page.getByTestId('csv-file-input')).toBeEnabled();
  });

  test('J14 — Configuración abre drawer y Escape restaura el origen', async ({ page }) => {
    const config = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Configuración' });
    await config.click();
    await expect(page.getByTestId('utility-drawer')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Auditar un CSV' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('utility-drawer')).toHaveCount(0);
    await expect(config).toBeFocused();
  });

  test('J15 — Empezar otra pide confirmación cuando hay datos', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar auditoría' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(validCsv);
    const nuevo = page.getByTestId('nav-new-analysis');
    await expect(nuevo).toBeVisible({ timeout: 20_000 });
    await nuevo.click();
    await expect(page.getByTestId('new-analysis-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('new-analysis-dialog')).toHaveCount(0);
    await expect(nuevo).toBeVisible();
  });

  test('tema Editorial claro y oscuro sin Ink en el canvas del shell', async ({ page }) => {
    const canvas = await page.locator('html').evaluate((el) => getComputedStyle(el).getPropertyValue('--bg').trim());
    expect(canvas.toLowerCase()).toBe('#ffffff');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Configuración' }).click();
    await expect(page.getByTestId('utility-drawer')).toBeVisible();
    await page.getByRole('switch', { name: 'Usar tema oscuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const dark = await page.locator('html').evaluate((el) => getComputedStyle(el).getPropertyValue('--bg').trim());
    expect(dark.toLowerCase()).toBe('#161614');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('utility-drawer')).toHaveCount(0);
  });

  test('J11 — recarga con sesión declara reimportación sin fingir el File', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('aura_pipeline_session_v1', JSON.stringify({
        state: 'profile',
        file: null,
        fileMeta: { name: 'titanic-mini.csv', size: 1234, type: 'text/csv', lastModified: 1726000000000 },
        report: { rowCount: 5, colCount: 12, issues: [], score: 90, duplicateRows: 0 },
        auditEvidence: { fileName: 'titanic-mini.csv' },
        rawData: [],
        csvFields: [],
        csvDelimiter: ',',
        cleaningScript: '',
        approvedScript: '',
        healthDelta: null,
        aiAnalysis: '',
        savedAt: new Date().toISOString(),
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reanudar el análisis' })).toBeVisible();
    await expect(page.getByTestId('home-resume-meta')).toContainText('titanic-mini.csv');
    const notice = page.getByTestId('home-reimport-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('reimportá el archivo');
    await expect(page.getByText('El archivo original no se guarda en el navegador')).toBeVisible();
  });
});
