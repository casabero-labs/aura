import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv');

test('AURA: flujo completo perfil → diagnóstico → script → revisar → exportar → Lab calibración', async ({ page }) => {
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

  // Generate diagnosis (may fail if no AI provider - that's ok)
  await diagnosisSection.getByRole('button', { name: /Generar diagnóstico/i }).click();
  await page.waitForTimeout(3000);

  // Wait for either "Continuar a propuesta" (success) or "Continuar sin diagnóstico" (fallback)
  const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar a propuesta/i });
  const skipBtn = page.locator('.provider-error-notice').getByRole('button', { name: /Continuar sin diagnóstico/i });
  
  const hasContinue = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);
  const hasSkip = await skipBtn.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (hasContinue) {
    await continueBtn.click();
  } else if (hasSkip) {
    await skipBtn.click();
  } else {
    throw new Error('Neither "Continuar a propuesta" nor "Continuar sin diagnóstico" appeared');
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
  await expect(page.getByText(/La calidad del dato merece/i)).toBeVisible();
});
