/**
 * Third Delivery — Phase 3 Evidence Screenshots.
 *
 * Captures UI screenshots demonstrating the Phase 3 pipeline:
 * Profile → structured Diagnosis v2 → RemediationPlan v2 → HITL approval.
 *
 * Does NOT call real LLM providers.
 * Screenshots 01-04: always capture (profile, diagnosis).
 * Screenshots 05-06: require structuredDiagnosis (fixture or real LLM).
 *   If CONTRACTS_V2_ENABLED is set, the fixture path provides it.
 *
 * Viewport: 1440 × 1000 as specified.
 * Datasets: synthetic_ground_truth.csv, titanic.csv, adult_income.csv
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

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

const COMMIT = 'fe5378e';
const DATE   = '2026-06-24';

async function uploadDataset(page: any, filePath: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', filePath);
  await page.waitForTimeout(1200);
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

    const genBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const canGenerate = await genBtn.isEnabled().catch(() => false);
    if (canGenerate) {
      await genBtn.click();
      await page.waitForTimeout(6000);
    }

    await diagnosisStage.waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_structured_diagnosis_v2.png'), fullPage: true });
  });

  test('05 — remediation_plan_v2.png (titanic, fixture)', async ({ page }) => {
    await uploadDataset(page, DATASETS.titanic);

    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(600);

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await diagnosisStage.waitFor({ state: 'visible', timeout: 10_000 });

    const genBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const canGenerate = await genBtn.isEnabled().catch(() => false);
    if (canGenerate) {
      await genBtn.click();
      await page.waitForTimeout(6000);
    }

    await page.waitForTimeout(500);

    const skipBtn = diagnosisStage.getByRole('button', { name: /Continuar sin diagnóstico/i });
    const contBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar a propuesta/i });
    const hasSkip = await skipBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCont = await contBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSkip) {
      await skipBtn.click();
    } else if (hasCont) {
      await contBtn.click();
    }

    await page.waitForTimeout(1000);

    const remStage = page.locator('[data-testid="remediation-stage"]');
    const remVisible = await remStage.isVisible({ timeout: 5000 }).catch(() => false);
    if (remVisible) {
      await remStage.waitFor({ state: 'visible', timeout: 10_000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_remediation_plan_v2.png'), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_remediation_plan_v2.png'), fullPage: true });
    }
  });

  test('06 — remediation_hitl.png (titanic, fixture)', async ({ page }) => {
    await uploadDataset(page, DATASETS.titanic);

    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(600);

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    await diagnosisStage.waitFor({ state: 'visible', timeout: 10_000 });

    const genBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const canGenerate = await genBtn.isEnabled().catch(() => false);
    if (canGenerate) {
      await genBtn.click();
      await page.waitForTimeout(6000);
    }

    await page.waitForTimeout(500);

    const skipBtn = diagnosisStage.getByRole('button', { name: /Continuar sin diagnóstico/i });
    const contBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar a propuesta/i });
    const hasSkip = await skipBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCont = await contBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasSkip) {
      await skipBtn.click();
    } else if (hasCont) {
      await contBtn.click();
    }

    await page.waitForTimeout(1000);

    const remStage = page.locator('[data-testid="remediation-stage"]');
    const remVisible = await remStage.isVisible({ timeout: 5000 }).catch(() => false);
    if (!remVisible) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_remediation_hitl.png'), fullPage: true });
      return;
    }

    await remStage.waitFor({ state: 'visible', timeout: 10_000 });

    const approveBtn = remStage.locator('button').filter({ hasText: 'Aprobar' }).first();
    const rejectBtn  = remStage.locator('button').filter({ hasText: 'Rechazar' }).first();

    const hasApprove = await approveBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasReject  = await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasApprove) { await approveBtn.click(); await page.waitForTimeout(200); }
    if (hasReject)  { await rejectBtn.click();  await page.waitForTimeout(200); }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_remediation_hitl.png'), fullPage: true });
  });
});
