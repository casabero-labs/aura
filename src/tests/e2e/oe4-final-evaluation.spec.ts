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
  await expect(page.getByRole('heading', { name: 'Laboratorio de evaluación LLM' })).toBeVisible();
  await expect(page.getByText('Objetivo específico 4')).toBeVisible();
};

const reviewRun = async (
  page: import('@playwright/test').Page,
  runId: string,
  notes: string,
): Promise<void> => {
  await page.getByRole('button', { name: `Abrir ${runId}` }).click();
  await page.getByLabel('Claridad').selectOption('4');
  await page.getByLabel('Trazabilidad').selectOption('3');
  await page.getByLabel('Accionabilidad').selectOption('3');
  await page.getByLabel('Notas de revisión').fill(notes);
  await page.getByRole('button', { name: 'Guardar evaluación humana' }).click();
  await expect(page.getByRole('status')).toContainText('Revisión humana guardada');
};

test.describe.serial('Task 11 — recorrido humano OE4 y recuperación', () => {
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

  test('crea, pausa, recarga, reanuda y exporta el expediente válido', async ({ page }) => {
    await page.getByRole('button', { name: 'Configuración', exact: true }).first().click();
    await expect(page.getByText('Contrato técnico del diagnóstico (avanzado)')).toHaveCount(0);
    await expect(page.getByText('Ejecución automática')).toHaveCount(0);
    await openLab(page);
    await expect(page.getByRole('note')).toContainText('no constituye evidencia de modelos');

    await page.getByRole('button', { name: 'Crear experimento' }).click();
    await expect(page.getByText('43 / 45')).toBeVisible();

    await page.getByRole('button', { name: 'Reanudar experimento' }).click();
    await expect.poll(() => page.evaluate(() => window.__OE4_E2E_WAITING__ === true)).toBe(true);
    await page.getByRole('button', { name: 'Pausar de forma segura' }).click();
    await page.evaluate(() => window.__OE4_E2E_RELEASE__?.());
    await expect(page.getByRole('status')).toContainText('Experimento pausado');
    await expect(page.getByText('44 / 45')).toBeVisible();

    await page.reload();
    await openLab(page);
    await expect(page.getByText('44 / 45')).toBeVisible();
    await page.getByRole('button', { name: 'Reanudar experimento' }).click();
    await expect(page.getByRole('status')).toContainText('Ejecución terminada');
    await expect(page.getByText('2 pendientes de revisión')).toBeVisible();

    await reviewRun(page, TARGET_RUN_ID, 'Representante claro, trazable y accionable.');
    await reviewRun(page, RECOVERY_RUN_ID, 'Corrida recuperada después de recargar.');
    await expect(page.getByText('0 pendientes de revisión')).toBeVisible();

    await page.getByRole('button', { name: `Abrir ${TARGET_RUN_ID}` }).click();
    await page.getByRole('button', { name: 'Aprobar representante' }).click();
    await expect(page.getByRole('status')).toContainText('Representante aprobado');
    await page.getByRole('button', { name: 'Preparar ejecución externa' }).click();
    await expect(page.getByRole('status')).toContainText('Ejecución externa preparada');

    await page.getByLabel('CSV resultante').setInputFiles(AFTER_CSV);
    await page.getByRole('button', { name: 'Importar y reauditar' }).click();
    await expect(page.getByText('40 → 75')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('CSV importado y reauditoría registrada');

    const artifactNames = ['campaign.json', 'runs.csv', 'report.md', 'report.pdf', 'manifest.json'];
    const artifactList = page.getByRole('list', { name: 'Artefactos disponibles' });
    for (const filename of artifactNames) {
      await expect(artifactList.getByText(filename, { exact: true })).toBeVisible();
    }

    const downloaded: string[] = [];
    page.on('download', (download) => downloaded.push(download.suggestedFilename()));
    const exportButton = page.getByRole('button', { name: 'Exportar expediente TFM' });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect.poll(() => downloaded.sort()).toEqual([...artifactNames].sort());
  });
});
