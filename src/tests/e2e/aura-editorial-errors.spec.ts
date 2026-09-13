import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  L10_CSV,
  PRESERVATION_CSV,
  injectPhase4Diagnosis,
  moveFromReportToExecution,
  openAudit,
  prepareExternalExecution,
  setPipelineState,
  submitExternalExecution,
  uploadAuditFile,
} from './aura-editorial-flow-helpers';

async function openDiagnosticReport(page: Parameters<typeof uploadAuditFile>[0], fixture = 'l10'): Promise<void> {
  await uploadAuditFile(page, fixture === 'l10' ? L10_CSV : {
    name: 'editorial-values.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(PRESERVATION_CSV, 'utf8'),
  });
  await page.getByTestId('profile-continue-diagnosis').click();
  await setPipelineState(page, 'diagnosis');
  await injectPhase4Diagnosis(page);
  await page.getByTestId('primary-stage-action').getByRole('button', { name: /Continuar al reporte diagnóstico/i }).click();
  await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 15_000 });
}

test.describe('Aura Editorial — recuperación y rechazo explícito', () => {
  test('CSV vacío o ilegible → evidencia de error → seleccionar otro archivo', async ({ page }) => {
    await openAudit(page);
    await page.locator('[data-testid="csv-file-input"]').setInputFiles({
      name: 'empty.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('', 'utf8'),
    });
    await expect(page.locator('.profile-surface')).toContainText('Error en la ingesta del archivo', { timeout: 15_000 });
    await expect(page.locator('.ingestion-evidence-status--error')).toContainText('INGESTIÓN FALLIDA');

    await page.getByRole('button', { name: /Seleccionar otro archivo/i }).click();
    await page.locator('[data-testid="csv-file-input"]').setInputFiles(L10_CSV);
    await expect(page.getByTestId('profile-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('profile-summary-strip')).toContainText('aura_l10_full_flow_issues.csv');
  });

  test('proveedor ausente → continuar con informe determinista → recarga recuperable', async ({ page }) => {
    await uploadAuditFile(page, L10_CSV);
    await page.getByTestId('profile-continue-diagnosis').click();
    await expect(page.getByTestId('provider-recovery-alert')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('provider-recovery-continue').click();
    await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('diagnostic-report-stage')).toContainText('evidencia determinista');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('home-resume-audit')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('home-resume-audit').click();
    await expect(page.getByTestId('diagnostic-report-stage')).toBeVisible({ timeout: 15_000 });
  });

  test('sin acciones aprobadas → exportación declara que no hubo remediación', async ({ page }) => {
    await openDiagnosticReport(page);
    await page.getByTestId('diagnostic-report-generate-script-top').click();
    const stage = page.getByTestId('remediation-stage');
    await stage.waitFor({ state: 'visible', timeout: 15_000 });

    const rejectButtons = stage.locator('.remediation-action__reject');
    const count = await rejectButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await stage.locator('.remediation-action__reject').first().click();
      await page.waitForTimeout(150);
    }

    await expect(page.getByTestId('remediation-close-without-changes')).toContainText('No hay acciones aprobadas');
    await page.getByRole('button', { name: 'Cerrar sin cambios', exact: true }).click();
    await expect(page.getByTestId('export-stage')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('export-remediation-not-run')).toContainText('no se ejecutó una remediación');
    await expect(page.getByTestId('export-validity-note')).toContainText('Una ejecución sin esa evidencia no se exporta como válida');
  });

  test('receipt alterado → rechazo específico de la cadena de evidencia', async ({ page }) => {
    const sourceBytes = Buffer.from(PRESERVATION_CSV, 'utf8');
    await openDiagnosticReport(page, 'preservation');
    await moveFromReportToExecution(page);
    const artifacts = await prepareExternalExecution(page, sourceBytes);
    const tamperedReceipt = {
      ...artifacts.receipt,
      afterDatasetSha256: '0'.repeat(64),
    };
    const tamperedPath = path.join(artifacts.tempDir, 'tampered-receipt.json');
    writeFileSync(tamperedPath, JSON.stringify(tamperedReceipt, null, 2), 'utf8');

    await submitExternalExecution(page, artifacts, tamperedPath);
    await expect(page.getByTestId('apply-verify-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('apply-verify-error')).toContainText(/Cadena inválida|hash|coincide/i);
  });
});
