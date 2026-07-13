import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');

test('AURA: flujo completo perfil → diagnóstico → script → revisar → exportar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });

  // ── Subir dataset ──
  await page.setInputFiles('input[type="file"]', fixtureCsv);

  // ── Perfil compacto ──
  const profileSummary = page.locator('.profile-decision-summary');
  await expect(profileSummary.locator('.profile-decision-status-label')).toBeVisible();
  await expect(page.locator('.profile-actions').getByRole('button', { name: /Continuar al diagnóstico/i })).toBeVisible();
  await expect(page.getByText('Macro F1')).not.toBeVisible();

  // ── Ir a Diagnóstico ──
  await page.locator('.profile-actions').getByRole('button', { name: /Continuar al diagnóstico/i }).click();
  const diagnosisSection = page.locator('[data-testid="diagnosis-stage"]');
  await expect(diagnosisSection).toBeVisible();
  await expect(diagnosisSection.getByText(/AURA interpreta los hallazgos/i)).toBeVisible();

  // Generate diagnosis (may be disabled if no AI provider in headless Playwright)
  await page.waitForTimeout(500);
  const diagnosisGenBtn = diagnosisSection.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
  const diagnosisBtnEnabled = await diagnosisGenBtn.isEnabled().catch(() => false);

  const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar al reporte diagnóstico/i });
  const skipBtn = page.locator('.provider-error-notice, .provider-unavailable-notice').getByRole('button', { name: /Continuar sin diagnóstico/i });

  if (diagnosisBtnEnabled) {
    await diagnosisGenBtn.click();
    await page.waitForTimeout(3000);

    const hasContinue = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasSkip = await skipBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasContinue) {
      await continueBtn.click();
    } else if (hasSkip) {
      await skipBtn.click();
    } else {
      // Fallback: try clicking the new "Reporte diagnóstico" stepper to bypass diagnosis
      const reportStepper = page.locator('.stepper-step').filter({ hasText: /Reporte diagnóstico/i });
      if (await reportStepper.isVisible().catch(() => false)) {
        await reportStepper.click();
      } else {
        throw new Error('Neither "Continuar al reporte diagnóstico" nor "Continuar sin diagnóstico" appeared');
      }
    }
  } else {
    const hasSkip = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSkip) {
      await skipBtn.click();
    } else {
      // Fallback: try clicking the new "Reporte diagnóstico" stepper to bypass diagnosis
      const reportStepper = page.locator('.stepper-step').filter({ hasText: /Reporte diagnóstico/i });
      if (await reportStepper.isVisible().catch(() => false)) {
        await reportStepper.click();
      } else {
        throw new Error('Diagnosis button disabled and "Continuar sin diagnóstico" not available');
      }
    }
  }
  await page.waitForTimeout(300);

  // ── Ir a Script ──
  const scriptStage = page.locator('[data-testid="script-stage"]');
  await expect(scriptStage).toBeVisible();

  // Generate script (has deterministic fallback)
  await scriptStage.getByRole('button', { name: /Generar propuesta/i }).click();
  await page.waitForTimeout(8000);

  // ── Ir a Revisar ──
  await expect(scriptStage.locator('.script-preview-section')).toBeVisible({ timeout: 10000 });
  await scriptStage.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Revisar propuesta/i }).click();
  await page.waitForTimeout(300);

  // Review step
  const reviewStage = page.locator('[data-testid="review-stage"]');
  await expect(reviewStage.getByText(/Tú decides antes de aplicar/i)).toBeVisible();
  await expect(reviewStage.locator('.script-review')).toBeVisible();

  // ── Task 1: Assert script lines stack vertically (not horizontal strip) ──
  const scriptLines = reviewStage.locator('.script-line');
  await expect(scriptLines.first()).toBeVisible();
  const firstBox = await scriptLines.nth(0).boundingBox();
  const secondBox = await scriptLines.nth(1).boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(secondBox!.y).toBeGreaterThan(firstBox!.y);

  // Scroll and approve
  const scriptScroll = reviewStage.locator('.script-scroll');
  await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(reviewStage.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
  await reviewStage.getByRole('button', { name: /Aprobar script/i }).click();
  await expect(reviewStage.locator('.review-delta')).toBeVisible({ timeout: 15000 });

  // ── Ir a Exportar ──
  await reviewStage.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Preparar exportación/i }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="export-stage"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Descargar PDF/i })).toBeVisible();

  // ── Task 5: Complete evidence package ──
  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-download-evidence-package').click(),
  ]);
  expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/);

  // ── Task 5a: Real JSON download check ──
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar JSON/i }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/);

  // ── Task 5b: CSV findings download ──
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar CSV/i }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/);

  expect(errors.length).toBe(0);

  await expect(page.getByRole('button', { name: 'Laboratorio' })).toHaveCount(0);

  // ── Task 3+5: Session restore — reload should keep export state ──
  await page.reload({ waitUntil: 'commit', timeout: 30_000 });
  await expect(page.locator('[data-testid="export-stage"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Exportación de resultados/i)).toBeVisible();

  // ── Task 3+5: Session destroy — destroys session and shows upload ──
  await page.getByRole('button', { name: /Cerrar sesión y destruir datos locales/i }).click();
  await expect(page.getByText(/Sesión destruida/i)).toBeVisible({ timeout: 5000 });

  // Reload after destroy should show fresh upload
  await page.reload({ waitUntil: 'commit', timeout: 30_000 });
  await expect(page.locator('.file-drop')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="export-stage"]')).not.toBeVisible();
});
