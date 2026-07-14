import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { AURA_EXPERIMENT_DATABASE_NAME } from '../../services/benchmark/indexedDbExperimentStore';
import { createExperimentEvidenceFixture } from '../../__tests__/fixtures/experimentEvidenceFixture';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AFTER_CSV = path.resolve(__dirname, './fixtures/oe4-after-approved.csv');
const source = createExperimentEvidenceFixture();
const TARGET_RUN_ID = source.runs.find((run) => run.sequence === 3)!.runId;
const RECOVERY_RUN_ID = source.runs.find((run) => run.sequence === 6)!.runId;

const openLab = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.getByRole('button', { name: 'Laboratorio', exact: true }).first().click();
  await expect(page.getByTestId('oe4-campaign-lab')).toBeVisible();
};

const reviewRun = async (page: import('@playwright/test').Page, runId: string, notes: string): Promise<void> => {
  await page.getByRole('button', { name: `Abrir ${runId}` }).click();
  await page.getByLabel('Claridad').selectOption('4');
  await page.getByLabel('Trazabilidad').selectOption('3');
  await page.getByLabel('Accionabilidad').selectOption('3');
  await page.getByLabel('Notas de revisión').fill(notes);
  await page.getByRole('button', { name: 'Guardar evaluación humana' }).click();
  await expect(page.getByRole('status')).toContainText('Revisión humana guardada');
};

const completeExperimentAndReviewBoth = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.getByRole('button', { name: 'Crear experimento' }).click();
  await expect(page.getByText('25 / 27')).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: 'Reanudar experimento' }).click();
  await expect.poll(() => page.evaluate(() => window.__OE4_E2E_WAITING__ === true)).toBe(true);
  await page.getByRole('button', { name: 'Pausar de forma segura' }).click();
  await page.evaluate(() => window.__OE4_E2E_RELEASE__?.());
  await expect(page.getByRole('status')).toContainText('Experimento pausado');

  await page.reload();
  await openLab(page);

  await page.getByRole('button', { name: 'Reanudar experimento' }).click();
  await expect(page.getByRole('status')).toContainText('Ejecución terminada', { timeout: 30000 });
  await expect(page.getByText('2 pendientes de revisión')).toBeVisible({ timeout: 10000 });

  await reviewRun(page, TARGET_RUN_ID, 'Representante claro, trazable y accionable.');
  await reviewRun(page, RECOVERY_RUN_ID, 'Corrida recuperada controlada.');
  await expect(page.getByText('0 pendientes de revisión')).toBeVisible({ timeout: 10000 });
};

const approvePrepareAndImport = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.getByRole('button', { name: `Abrir ${TARGET_RUN_ID}` }).click();
  await page.getByRole('button', { name: 'Aprobar representante' }).click();
  await expect(page.getByRole('status')).toContainText('Representante aprobado', { timeout: 10000 });
  await page.getByRole('button', { name: 'Preparar ejecución externa' }).click();
  await expect(page.getByRole('status')).toContainText('Ejecución externa preparada', { timeout: 10000 });

  await page.getByLabel('CSV resultante').setInputFiles(AFTER_CSV);
  await page.getByLabel('Recibo de ejecución JSON').setInputFiles({
    name: 'receipt.json', mimeType: 'application/json', buffer: Buffer.from('{}'),
  });
  await page.getByRole('button', { name: 'Verificar, importar y reauditar' }).click();
  await expect(page.getByRole('status')).toContainText('CSV importado y reauditoría registrada', { timeout: 10000 });
};

test.describe('P1-04R1 adversarial closure', () => {
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

  test('1. Reporte normal sin evidencia formal muestra "No medido" para campos formales', async ({ page }) => {
    await openLab(page);
    await completeExperimentAndReviewBoth(page);

    await page.getByRole('button', { name: `Abrir ${TARGET_RUN_ID}` }).click();
    await expect(page.getByTestId('oe4-python-evidence-empty')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('oe4-python-syntax-not-measured')).toContainText('No medida');
    await expect(page.getByTestId('oe4-python-execution-not-run')).toContainText('No realizada');
    await expect(page.getByTestId('oe4-python-reaudit-not-run')).toContainText('No realizada');
  });

  test('2. Estado previo al recibo Python muestra estados pendientes en ExecutionEvidencePanel', async ({ page }) => {
    await openLab(page);
    await completeExperimentAndReviewBoth(page);

    await page.getByRole('button', { name: `Abrir ${TARGET_RUN_ID}` }).click();
    const panel = page.getByTestId('oe4-python-evidence-empty');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel.locator('h2')).toContainText('Evidencia Python');
    await expect(page.getByTestId('oe4-python-syntax-not-measured')).toBeVisible();
    await expect(page.getByTestId('oe4-python-execution-not-run')).toBeVisible();
    await expect(page.getByTestId('oe4-python-reaudit-not-run')).toBeVisible();
    await expect(page.getByTestId('oe4-python-evidence-receipt')).toHaveCount(0);
  });

  test('3. Recibo Python verificado muestra sintaxis superada, ejecución superada, versiones, dimensiones y hashes', async ({ page }) => {
    await openLab(page);
    await completeExperimentAndReviewBoth(page);
    await approvePrepareAndImport(page);

    await expect(page.getByTestId('oe4-python-evidence-receipt')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('oe4-python-syntax-status')).toContainText('Superada');
    await expect(page.getByTestId('oe4-python-execution-status')).toContainText('Superada');
    await expect(page.getByTestId('oe4-python-version')).toContainText('3.12.1');
    await expect(page.getByTestId('oe4-python-pandas-version')).toContainText('2.2.0');
    await expect(page.getByTestId('oe4-python-output-dimensions')).toContainText('50 filas');
    await expect(page.getByTestId('oe4-python-receipt-hash')).toBeVisible();
    await expect(page.getByTestId('oe4-python-script-hash')).toBeVisible();
    await expect(page.getByTestId('oe4-python-before-hash')).toBeVisible();
    await expect(page.getByTestId('oe4-python-after-hash')).toBeVisible();
  });

  test('4. Copiar hash completo copia hash de 64 caracteres al portapapeles', async ({ page }) => {
    await openLab(page);
    await completeExperimentAndReviewBoth(page);
    await approvePrepareAndImport(page);

    await expect(page.getByTestId('oe4-python-receipt-hash')).toBeVisible({ timeout: 10000 });

    let clipboardText = '';
    await page.evaluate(() => {
      const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (text: string) => {
        (window as any).__CLIPBOARD_TEXT__ = text;
        return origWrite(text);
      };
    });

    const copyBtn = page.getByTestId('oe4-python-receipt-hash').locator('button');
    await copyBtn.click();

    clipboardText = await page.evaluate(() => (window as any).__CLIPBOARD_TEXT__ ?? '');
    expect(clipboardText).toMatch(/^[a-f0-9]{64}$/);
  });

  test('5. Exportaciones explicadas muestran descripciones visibles', async ({ page }) => {
    await openLab(page);
    await completeExperimentAndReviewBoth(page);
    await approvePrepareAndImport(page);

    const exportSection = page.getByRole('list', { name: 'Artefactos disponibles' });
    await expect(exportSection).toBeVisible({ timeout: 10000 });

    for (const filename of ['campaign.json', 'runs.csv', 'report.md', 'report.pdf', 'manifest.json']) {
      await expect(exportSection.getByText(filename, { exact: true })).toBeVisible();
    }
    for (const description of [
      'Fuente canónica del experimento',
      'Una fila por corrida',
      'Informe legible',
      'Versión PDF',
      'Hashes de todos los archivos',
    ]) {
      await expect(exportSection.getByText(new RegExp(description))).toBeVisible();
    }
  });

  test('6. No ejecución automática mantiene contador en 0 antes de click explícito', async ({ page }) => {
    await openLab(page);
    const countBefore = await page.evaluate(() => window.__OE4_E2E_GENERATE_CALL_COUNT__ ?? 0);
    expect(countBefore).toBe(0);

    await page.getByRole('button', { name: 'Crear experimento' }).click();
    await expect(page.getByText('25 / 27')).toBeVisible({ timeout: 30000 });

    const countBeforeReanudar = await page.evaluate(() => window.__OE4_E2E_GENERATE_CALL_COUNT__ ?? 0);
    expect(countBeforeReanudar).toBe(0);

    await page.getByRole('button', { name: 'Reanudar experimento' }).click();
    await expect.poll(() => page.evaluate(() => window.__OE4_E2E_WAITING__ === true)).toBe(true);

    const countAfterReanudar = await page.evaluate(() => window.__OE4_E2E_GENERATE_CALL_COUNT__ ?? -1);
    expect(countAfterReanudar).toBeGreaterThan(0);
  });
});
