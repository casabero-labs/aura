import { expect, test } from '@playwright/test';
import { AURA_EXPERIMENT_DATABASE_NAME } from '../../services/benchmark/indexedDbExperimentStore';

const expectNoHorizontalOverflow = async (page: import('@playwright/test').Page): Promise<void> => {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1);
};

const openLab = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.getByRole('button', { name: 'Laboratorio', exact: true }).first().click();
  await expect(page.getByTestId('oe4-campaign-lab')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Laboratorio de evaluación LLM' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Laboratorio de evaluación LLM' })).toBeVisible();
  await expect(page.getByText('Objetivo específico 4')).toHaveCount(0);
};

test.describe.serial('Laboratorio — evaluación automática y recuperación', () => {
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

  test('crea, pausa, recarga, reanuda, califica y exporta sin revisión humana', async ({ page }) => {
    await page.getByRole('button', { name: 'Configuración', exact: true }).first().click();
    await expect(page.getByText('Contrato técnico del diagnóstico (avanzado)')).toHaveCount(0);
    await expect(page.getByText('Ejecución automática')).toHaveCount(0);
    await openLab(page);
    await expect(page.getByRole('note')).toContainText('no constituye evidencia de modelos');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Crear experimento' }).click();
    await expect(page.getByText('25 / 27')).toBeVisible();

    await page.getByRole('button', { name: 'Reanudar experimento' }).click();
    await expect.poll(() => page.evaluate(() => window.__OE4_E2E_WAITING__ === true)).toBe(true);
    await expect(page.getByText('diagnosis.response.stream.json')).toBeVisible();
    await expect(page.getByTestId('oe4-diagnosis-response-stream-content'))
      .toContainText('{"contractId":');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Pausar de forma segura' }).click();
    await page.evaluate(() => window.__OE4_E2E_RELEASE__?.());
    await expect(page.getByRole('status')).toContainText('Experimento pausado');
    await expect(page.getByText('26 / 27')).toBeVisible();

    await page.reload();
    await openLab(page);
    await expect(page.getByText('26 / 27')).toBeVisible();
    await page.getByRole('button', { name: 'Reanudar experimento' }).click();
    await expect(page.getByRole('status')).toContainText('Ejecución terminada');
    await expect(page.getByText('27 / 27')).toBeVisible();
    await expect(page.getByText('Con score automático')).toBeVisible();
    await expect(page.getByText('sin revisión humana obligatoria')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await expect(page.getByRole('heading', { name: 'Reporte listo' })).toBeVisible();
    await expect(page.getByText('Mejor equilibrio para AURA')).toBeVisible();
    await expect(page.getByText('Cómo califica AURA')).toBeVisible();
    await expect(page.getByText(/No es un juicio de otro LLM/)).toBeVisible();
    await expect(page.getByText(/La revisión humana, el script, HITL y la remediación pertenecen al pipeline normal/)).toBeVisible();
    await expect(page.getByText('Guardar evaluación humana')).toHaveCount(0);
    await expect(page.getByText('Aprobar representante')).toHaveCount(0);
    await expect(page.getByText('Preparar ejecución externa')).toHaveCount(0);
    await expect(page.getByText('Script', { exact: true })).toHaveCount(0);

    const matrixCells = page.getByTestId('oe4-matrix-cell');
    await expect(matrixCells).toHaveCount(9);
    await expect(page.locator('.oe4-matrix-cell--success')).toHaveCount(9);
    await expect(page.locator('.oe4-run-dot--success')).toHaveCount(27);

    const artifactNames = ['campaign.json', 'runs.csv', 'report.md', 'report.pdf', 'manifest.json'];
    const artifactList = page.getByRole('list', { name: 'Artefactos disponibles' });
    for (const filename of artifactNames) {
      await expect(artifactList.getByText(filename, { exact: true })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);

    const downloaded: string[] = [];
    page.on('download', (download) => downloaded.push(download.suggestedFilename()));
    const exportButton = page.getByRole('button', { name: 'Exportar resultados' });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect.poll(() => downloaded.sort()).toEqual([...artifactNames].sort());
  });
});
