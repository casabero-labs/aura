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
  const profileSummary = page.locator('.profile-summary-section');
  await expect(profileSummary.locator('.profile-summary-score-label')).toBeVisible();
  await expect(profileSummary.getByRole('button', { name: /Generar diagnóstico/i })).toBeVisible();
  await expect(page.getByText('Macro F1')).not.toBeVisible();

  // ── Ir a Diagnóstico ──
  await profileSummary.getByRole('button', { name: /Generar diagnóstico/i }).click();
  const diagnosisSection = page.locator('.diagnosis-compact');
  await expect(diagnosisSection.getByText(/principal señal de calidad/i)).toBeVisible();

  // ── Ir a Script → generar fallback → ir a Revisar → aprobar → simular ──
  await page.getByRole('button', { name: /Generar script/i }).first().click();
  await page.getByRole('button', { name: /Generar script/i }).click();
  await expect(page.locator('.script-review')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /Revisar script/i }).click();
  await expect(page.getByRole('heading', { name: /Revisión humana/i })).toBeVisible();
  const scriptScroll = page.locator('.script-scroll');
  await scriptScroll.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(page.getByText(/Código revisado completo/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Aprobar script/i }).click();
  await expect(page.locator('.review-delta')).toBeVisible({ timeout: 10000 });

  // ── Ir a Exportar ──
  await page.getByRole('button', { name: /Preparar exportación/i }).click();
  await expect(page.locator('.export-closure')).toBeVisible();
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
