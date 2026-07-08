/**
 * Academic evidence screenshots for the final document.
 * Uses titanic.csv and synthetic_ground_truth.csv.
 * Harness for contractual steps (no LLM, no Python execution, no HealthDelta).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS = {
  titanic: path.resolve(__dirname, '../../../experiments/datasets/titanic.csv'),
  synthetic: path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv'),
};
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/evidencia_final_documento');

async function up(page: any, fp: string) {
  await page.waitForTimeout(5000);
  for (let i = 0; i < 12; i++) {
    try { await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 }); break; }
    catch { if (i === 11) throw new Error('Server failed'); await page.waitForTimeout(5000); }
  }
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar|Comenzar/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', fp);
  await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}
async function harness(page: any) {
  await page.waitForFunction(() => typeof (window as any).__PHASE4_INJECT__ === 'function', { timeout: 15_000 });
}
async function injectPhase4(page: any, fixture: any) {
  await page.evaluate(([d, p]: any[]) => { (window as any).__PHASE4_INJECT__(d, p); }, [fixture.diagnosis, fixture.plan]);
  await page.waitForTimeout(2000);
}
async function goScript(page: any) {
  await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
}
async function scrollReview(page: any) {
  await page.locator('[data-testid="review-stage"]').evaluate((el: HTMLElement) => {
    const pre = el.querySelector('.script-code');
    const t = pre?.parentElement || el;
    t.scrollTop = t.scrollHeight;
    t.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.waitForTimeout(800);
}

test.describe('Evidencia académica AURA', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1000 }); });

  test('01 — carga local titanic', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, '01_carga_local_titanic.png'), fullPage: true });
  });

  test('02 — hallazgos titanic', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await page.waitForTimeout(1000);
    // Scroll to make findings visible
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '02_hallazgos_titanic.png'), fullPage: true });
  });

  test('03 — paquete evidencia', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await page.evaluate((d: any) => {
      (window as any).__PHASE4_INJECT__(d, null, { analysisText: 'Diagnóstico estructurado (harness determinista).' });
    }, fixture.diagnosis);
    await page.waitForTimeout(2000);
    await page.locator('.profile-actions').getByRole('button', { name: /Continuar al diagnóstico/i }).click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-testid="diagnosis-stage"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '03_paquete_evidencia.png'), fullPage: true });
  });

  test('04 — diagnostico asistido', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await page.evaluate((d: any) => {
      (window as any).__PHASE4_INJECT__(d, null, { analysisText: 'Diagnóstico estructurado (harness determinista).' });
    }, fixture.diagnosis);
    await page.waitForTimeout(2000);
    await page.locator('.profile-actions').getByRole('button', { name: /Continuar al diagnóstico/i }).click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-testid="diagnosis-stage"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    // Scroll to diagnosis blocks section
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '04_diagnostico_asistido.png'), fullPage: true });
  });

  test('05 — plan remediacion', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, fixture);
    await goScript(page);
    const r = page.locator('[data-testid="remediation-stage"]');
    await expect(r.locator('.remediation-action').first()).toBeVisible();
    // Show plan BEFORE human interaction (all actions pending)
    await page.screenshot({ path: path.join(OUT, '05_plan_remediacion.png'), fullPage: true });
  });

  test('06 — revision humana', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, fixture);
    await goScript(page);
    const r = page.locator('[data-testid="remediation-stage"]');
    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(500);
    await expect(r.getByText('Aprobado').first()).toBeVisible();
    await expect(r.getByText('Rechazado').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, '06_revision_humana.png'), fullPage: true });
  });

  test('07 — script propuesto', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.script-code')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, '07_script_propuesto.png'), fullPage: true });
  });

  test('08 — validacion script', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 15_000 });
    await scrollReview(page);
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(OUT, '08_validacion_script.png'), fullPage: true });
  });

  test('09 — bloqueo manipulacion', async ({ page }) => {
    await up(page, DATASETS.titanic);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '0000000000000000' }); });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 15_000 });
    await scrollReview(page);
    await page.getByText('Aprobar script').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '09_bloqueo_manipulacion.png'), fullPage: true });
  });

  test('10 — laboratorio modelos', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    // Open the lab/benchmark panel if accessible
    const labBtn = page.getByRole('button', { name: /Lab|Benchmark|Modelos/i });
    if (await labBtn.isVisible().catch(() => false)) {
      await labBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(OUT, '10_laboratorio_modelos.png'), fullPage: true });
  });

  test('11 — resultados ground truth', async ({ page }) => {
    await up(page, DATASETS.synthetic);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible();
    // Look for ground truth validation section
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="technical-details"]');
      if (el) { (el as HTMLDetailsElement).open = true; el.scrollIntoView({ block: 'center' }); }
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '11_resultados_ground_truth.png'), fullPage: true });
  });
});
