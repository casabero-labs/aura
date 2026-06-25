/**
 * Third Delivery — Phase 3 Evidence Screenshots.
 *
 * Captures UI screenshots demonstrating the Phase 3 pipeline:
 * Profile → structured Diagnosis v2 → RemediationPlan v2 → HITL approval.
 *
 * Does NOT call real LLM providers.
 * Harness (Phase3EvidenceHarness) injects pre-computed DiagnosisExecutionResult
 * and RemediationPlanV2 via window.__PHASE3_INJECT__ (component callbacks).
 *
 * Viewport: 1440 × 1000 as specified.
 * Datasets: synthetic_ground_truth.csv, titanic.csv, adult_income.csv
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { PHASE3_TITANIC_DIAGNOSIS, PHASE3_TITANIC_PLAN } from './harness/Phase3EvidenceHarness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATASETS = {
  synthetic: path.resolve(__dirname, '../../../experiments/datasets/synthetic_ground_truth.csv'),
  titanic:   path.resolve(__dirname, '../../../experiments/datasets/titanic.csv'),
  adult:     path.resolve(__dirname, '../../../experiments/datasets/adult_income.csv'),
};

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase3',
);

const COMMIT = 'b89f38e';
const DATE   = '2026-06-25';

async function uploadDataset(page: any, filePath: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', filePath);
  await page.waitForTimeout(1200);
}

async function waitForHarness(page: any) {
  await page.waitForFunction(() => typeof (window as any).__PHASE3_INJECT__ === 'function', { timeout: 10_000 });
}

test.describe('Phase 3 — Third Delivery Evidence Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test('01 — synthetic_profile.png', async ({ page }) => {
    await uploadDataset(page, DATASETS.synthetic);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_synthetic_profile.png'), fullPage: false });
  });

  test('02 — titanic_profile.png', async ({ page }) => {
    await uploadDataset(page, DATASETS.titanic);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_titanic_profile.png'), fullPage: false });
  });

  test('03 — adult_income_profile.png', async ({ page }) => {
    await uploadDataset(page, DATASETS.adult);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_adult_income_profile.png'), fullPage: false });
  });

  test('04 — structured_diagnosis_v2.png (titanic)', async ({ page }) => {
    await uploadDataset(page, DATASETS.titanic);

    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(600);

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await diagnosisStage.waitFor({ state: 'visible', timeout: 10_000 });

    await page.evaluate((diag: any) => {
      (window as any).__PHASE3_INJECT__(diag, null);
    }, PHASE3_TITANIC_DIAGNOSIS);

    await page.waitForTimeout(3000);

    await expect(diagnosisStage).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('REVISIÓN HUMANA').first()).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_structured_diagnosis_v2.png'), fullPage: true });
  });

  test('05 — remediation_plan_v2.png (titanic)', async ({ page }) => {
    await uploadDataset(page, DATASETS.titanic);

    await page.evaluate(() => {
      (window as any).__PHASE3_SET_STATE__('diagnosis');
    });

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await diagnosisStage.waitFor({ state: 'visible', timeout: 10_000 });

    await page.evaluate((arg: { diag: any; plan: any }) => {
      (window as any).__PHASE3_INJECT__(arg.diag, arg.plan, { analysisText: 'Diagnóstico estructurado completado vía harness de evidencia.' });
    }, { diag: PHASE3_TITANIC_DIAGNOSIS, plan: PHASE3_TITANIC_PLAN });

    await page.waitForTimeout(3000);

    const contBtn = diagnosisStage.locator('button').filter({ hasText: /Continuar a propuesta/i });
    await contBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await contBtn.click();

    await page.waitForTimeout(1500);

    const remStage = page.locator('[data-testid="remediation-stage"]');
    await expect(remStage).toBeVisible({ timeout: 10_000 });
    await expect(remStage.locator('.remediation-action')).toHaveCount(9, { timeout: 5_000 });
    await expect(remStage.getByText('Revisión requerida').first()).toBeVisible({ timeout: 5_000 });
    await expect(remStage.getByText('Aprobar').first()).toBeVisible({ timeout: 5_000 });
    await expect(remStage.getByText('Rechazar').first()).toBeVisible({ timeout: 5_000 });
    await expect(remStage.getByText(/semantic-long-tail-Name/).first()).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_remediation_plan_v2.png'), fullPage: true });
  });

  test('06 — remediation_hitl.png (titanic)', async ({ page }) => {
    await uploadDataset(page, DATASETS.titanic);

    await page.evaluate(() => {
      (window as any).__PHASE3_SET_STATE__('diagnosis');
    });

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await diagnosisStage.waitFor({ state: 'visible', timeout: 10_000 });

    await page.evaluate((arg: { diag: any; plan: any }) => {
      (window as any).__PHASE3_INJECT__(arg.diag, arg.plan, { analysisText: 'Diagnóstico estructurado completado vía harness de evidencia.' });
    }, { diag: PHASE3_TITANIC_DIAGNOSIS, plan: PHASE3_TITANIC_PLAN });

    await page.waitForTimeout(3000);

    const contBtn = diagnosisStage.locator('button').filter({ hasText: /Continuar a propuesta/i });
    await contBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await contBtn.click();

    await page.waitForTimeout(1500);

    const remStage = page.locator('[data-testid="remediation-stage"]');
    await expect(remStage).toBeVisible({ timeout: 10_000 });

    const firstAction = remStage.locator('.remediation-action').first();
    const secondAction = remStage.locator('.remediation-action').nth(1);

    const firstApproveBtn = firstAction.locator('button').filter({ hasText: 'Aprobar' });
    const secondRejectBtn = secondAction.locator('button').filter({ hasText: 'Rechazar' });

    await firstApproveBtn.click();
    await page.waitForTimeout(300);
    await secondRejectBtn.click();
    await page.waitForTimeout(500);

    await expect(remStage.getByText('Aprobado').first()).toBeVisible({ timeout: 5_000 });
    await expect(remStage.getByText('Rechazado').first()).toBeVisible({ timeout: 5_000 });
    await expect(secondAction.getByText('Rechazado').first()).toBeVisible({ timeout: 5_000 });
    // Verify there are still pending actions (7 out of 9 remain pending)
    const allActions = remStage.locator('.remediation-action');
    await expect(allActions).toHaveCount(9, { timeout: 5000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_remediation_hitl.png'), fullPage: true });
  });
});
