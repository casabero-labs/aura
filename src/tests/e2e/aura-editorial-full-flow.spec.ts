import { expect, test } from '@playwright/test';
import {
  PRESERVATION_CSV,
  downloadEvidencePackage,
  injectPhase4Diagnosis,
  moveFromReportToExecution,
  runExternalExecution,
  setPipelineState,
  uploadAuditFile,
} from './aura-editorial-flow-helpers';

test.describe('Aura Editorial — recorrido humano completo', () => {
  test('abrir → perfilar → diagnosticar → ejecutar en copia → reauditar → exportar → destruir sesión', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (/preload assets|React DevTools|Failed to load resource: net::ERR_FAILED/i.test(text)) return;
      if (/localhost:11434\/api\/tags|127\.0\.0\.1:11434\/api\/tags|address space of `local`.*address space of `loopback`/i.test(text)) return;
      runtimeErrors.push(text);
    });

    const sourceBytes = Buffer.from(PRESERVATION_CSV, 'utf8');
    await uploadAuditFile(page, {
      name: 'editorial-values.csv',
      mimeType: 'text/csv',
      buffer: sourceBytes,
    });
    await expect(page.getByTestId('profile-hero')).toContainText('Perfil inicial del dataset');
    await expect(page.getByTestId('profile-summary-strip')).toContainText('editorial-values.csv');
    await page.getByTestId('profile-continue-diagnosis').click();

    await setPipelineState(page, 'diagnosis');
    await injectPhase4Diagnosis(page);
    await page.getByTestId('primary-stage-action').getByRole('button', { name: /Continuar al reporte diagnóstico/i }).click();
    await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('diagnostic-report-stage')).toContainText('Qué encontró AURA');

    await moveFromReportToExecution(page);
    const execution = await runExternalExecution(page, sourceBytes);
    expect(execution.correctedBytes.toString('utf8')).toContain('001');
    expect(execution.correctedBytes.toString('utf8')).toContain('120.00');
    expect(execution.receipt.execution.status).toBe('passed');

    await page.getByTestId('export-corrected-opt-in').getByRole('checkbox').check();
    const zipPath = await downloadEvidencePackage(page);
    expect(zipPath).toBeTruthy();

    await page.getByTestId('export-return-to-results').click();
    await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('diagnostic-report-export-main').click();
    await expect(page.getByTestId('export-stage')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('export-destroy-session').click();
    await expect(page.getByTestId('destroy-session-dialog')).toBeVisible();
    await page.getByTestId('destroy-session-confirm').click();
    await expect(page.getByTestId('session-destroyed-msg')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('csv-file-input')).toBeAttached({ timeout: 10_000 });

    expect(runtimeErrors, 'el recorrido completo no debe producir errores JS').toEqual([]);
  });
});
