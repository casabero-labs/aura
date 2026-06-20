import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');

test('AURA: flujo completo perfil → diagnóstico → script → revisar → exportar → Lab calibración', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });

  // ── Subir dataset ──
  await page.setInputFiles('input[type="file"]', fixtureCsv);

  // ── Perfil compacto ──
  const profileSummary = page.locator('.profile-decision-summary');
  await expect(profileSummary.locator('.profile-decision-status-label')).toBeVisible();
  await expect(page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i })).toBeVisible();
  await expect(page.getByText('Macro F1')).not.toBeVisible();

  // ── Ir a Diagnóstico ──
  await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
  const diagnosisSection = page.locator('[data-testid="diagnosis-stage"]');
  await expect(diagnosisSection).toBeVisible();
  await expect(diagnosisSection.getByText(/AURA interpreta los hallazgos/i)).toBeVisible();

  // Generate diagnosis (may be disabled if no AI provider in headless Playwright)
  await page.waitForTimeout(500);
  const diagnosisGenBtn = diagnosisSection.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
  const diagnosisBtnEnabled = await diagnosisGenBtn.isEnabled().catch(() => false);

  const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar a propuesta/i });
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
      // Fallback: try clicking stepper to bypass diagnosis
      const scriptStepper = page.locator('.stepper-step').filter({ hasText: 'Script' });
      if (await scriptStepper.isVisible().catch(() => false)) {
        await scriptStepper.click();
      } else {
        throw new Error('Neither "Continuar a propuesta" nor "Continuar sin diagnóstico" appeared');
      }
    }
  } else {
    const hasSkip = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSkip) {
      await skipBtn.click();
    } else {
      // Fallback: try clicking stepper to bypass diagnosis
      const scriptStepper = page.locator('.stepper-step').filter({ hasText: 'Script' });
      if (await scriptStepper.isVisible().catch(() => false)) {
        await scriptStepper.click();
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
  await expect(page.getByRole('button', { name: /Reporte PDF ejecutivo/i })).toBeVisible();

  // ── Task 5: Real download checks ──
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /JSON técnico/i }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/);

  // ── Task 5b: Colab notebook download ──
  const [colabDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Notebook Colab/i }).click(),
  ]);
  expect(colabDownload.suggestedFilename()).toMatch(/\.ipynb$/);
  // Verify notebook contains nbformat and privacy warning
  const colabBody = await colabDownload.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of colabBody) { chunks.push(Buffer.from(chunk)); }
  const notebookText = Buffer.concat(chunks).toString('utf-8');
  expect(notebookText).toContain('"nbformat": 4');
  expect(notebookText).toContain('ADVERTENCIA DE PRIVACIDAD');

  expect(errors.length).toBe(0);

  // ── AURA-LAB-01: Abrir Laboratorio ──
  const navMenu = page.locator('.nav-center-menu');
  await navMenu.getByRole('button', { name: 'Laboratorio' }).click();

  // ── Verificar configuración de experimento ──
  await expect(page.getByText(/Laboratorio de calibración/i)).toBeVisible();
  await expect(page.getByText(/configuración del experimento/i)).toBeVisible();

  // Controles de configuración visibles
  await expect(page.locator('.lab-runner-controls')).toBeVisible();
  await expect(page.getByRole('button', { name: /Ejecutar corrida/i })).toBeVisible();

  // Tabla de resultados (vacía pero con estructura)
  await expect(page.getByText(/Resultados comparados/i)).toBeVisible();

  // Sin proveedor disponible, tabla muestra mensaje de vacío
  await expect(page.getByText(/Sin ejecuciones/i)).toBeVisible();

  // Volver al flujo
  await page.getByRole('button', { name: /Volver al flujo/i }).click();

  // Verificar que el diagnóstico principal sigue accesible
  await navMenu.getByRole('button', { name: 'Auditoría' }).click();
  await expect(page.getByText(/La calidad del dato merece/i)).toHaveCount(0);
  await expect(page.locator('[data-testid="export-stage"]')).toBeVisible();

  // ── Task 3+5: Session restore — reload should keep export state ──
  await page.reload({ waitUntil: 'commit', timeout: 30_000 });
  await expect(page.locator('[data-testid="export-stage"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Tu evidencia está lista/i)).toBeVisible();

  // ── Task 3+5: Session destroy — destroys session and shows upload ──
  await page.getByRole('button', { name: /Cerrar y destruir sesión/i }).click();
  await expect(page.getByText(/Sesión destruida/i)).toBeVisible({ timeout: 5000 });

  // Reload after destroy should show fresh upload
  await page.reload({ waitUntil: 'commit', timeout: 30_000 });
  await expect(page.locator('.file-drop')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="export-stage"]')).not.toBeVisible();
});
