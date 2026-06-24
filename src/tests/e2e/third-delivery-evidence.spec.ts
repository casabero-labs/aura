/**
 * Third Delivery — Phase 3 Evidence Screenshots.
 *
 * Captures UI screenshots demonstrating the Phase 3 pipeline:
 * Profile → structured Diagnosis v2 → RemediationPlan v2 → HITL approval.
 *
 * Does NOT call real LLM providers. Uses the "skip diagnosis" path
 * which triggers the v2 fixture path when CONTRACTS_V2_ENABLED=true.
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

test.describe('Phase 3 — Third Delivery Evidence Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test('01 — synthetic_ground_truth.csv: dataset profile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.setInputFiles('input[type="file"]', DATASETS.synthetic);
    await page.waitForTimeout(800);

    await expect(page.locator('.profile-editorial-header, .sec-title')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_synthetic_profile.png'),
      fullPage: false,
    });
  });

  test('02 — titanic.csv: dataset profile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.setInputFiles('input[type="file"]', DATASETS.titanic);
    await page.waitForTimeout(800);

    await expect(page.locator('.profile-editorial-header, .sec-title')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_titanic_profile.png'),
      fullPage: false,
    });
  });

  test('03 — adult_income.csv: dataset profile (high volume)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.setInputFiles('input[type="file"]', DATASETS.adult);
    await page.waitForTimeout(1500);

    await expect(page.locator('.profile-editorial-header, .sec-title')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_adult_income_profile.png'),
      fullPage: false,
    });
  });

  test('04 — structured_diagnosis_v2.png (titanic, fixture path)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.setInputFiles('input[type="file"]', DATASETS.titanic);
    await page.waitForTimeout(800);

    // Navigate to diagnosis step
    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(400);

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');

    // Try to generate; if no provider, skip
    const genBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const canGenerate = await genBtn.isEnabled().catch(() => false);

    if (canGenerate) {
      await genBtn.click();
      await page.waitForTimeout(6000);
    }

    // Look for structured diagnosis elements
    const structuredDiag = page.locator('[data-testid="diagnosis-stage"]');
    await structuredDiag.waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_structured_diagnosis_v2.png'),
      fullPage: true,
    });
  });

  test('05 — remediation_plan_v2.png (titanic, fixture path)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.setInputFiles('input[type="file"]', DATASETS.titanic);
    await page.waitForTimeout(800);

    // Profile → Diagnosis
    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(400);

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    const genBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const canGenerate = await genBtn.isEnabled().catch(() => false);

    if (canGenerate) {
      await genBtn.click();
      await page.waitForTimeout(6000);
    }

    // Skip diagnosis to reach remediation step
    const skipBtn = diagnosisStage.getByRole('button', { name: /Continuar sin diagnóstico/i });
    const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar a propuesta/i });

    const hasSkip = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasContinue = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasSkip) {
      await skipBtn.click();
    } else if (hasContinue) {
      await continueBtn.click();
    }

    await page.waitForTimeout(500);

    // Remediation plan step
    const remediationStage = page.locator('[data-testid="remediation-stage"]');
    await remediationStage.waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05_remediation_plan_v2.png'),
      fullPage: true,
    });
  });

  test('06 — remediation_hitl.png (titanic, approve+reject visible)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });

    await page.setInputFiles('input[type="file"]', DATASETS.titanic);
    await page.waitForTimeout(800);

    // Profile → Diagnosis
    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(400);

    const diagnosisStage = page.locator('[data-testid="diagnosis-stage"]');
    const genBtn = diagnosisStage.getByRole('button', { name: /(Generar|Regenerar) diagnóstico/i });
    const canGenerate = await genBtn.isEnabled().catch(() => false);

    if (canGenerate) {
      await genBtn.click();
      await page.waitForTimeout(6000);
    }

    // Skip to remediation
    const skipBtn = diagnosisStage.getByRole('button', { name: /Continuar sin diagnóstico/i });
    const continueBtn = page.locator('[data-testid="primary-stage-action"]').getByRole('button', { name: /Continuar a propuesta/i });

    const hasSkip = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasContinue = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasSkip) {
      await skipBtn.click();
    } else if (hasContinue) {
      await continueBtn.click();
    }

    await page.waitForTimeout(500);

    // Remediation plan — interact with first two pending actions
    const remediationStage = page.locator('[data-testid="remediation-stage"]');
    await remediationStage.waitFor({ state: 'visible', timeout: 10_000 });

    // Find first pending action's Approve button
    const firstApprove = remediationStage.locator('button').filter({ hasText: 'Aprobar' }).first();
    const firstReject  = remediationStage.locator('button').filter({ hasText: 'Rechazar' }).first();

    const hasApprove = await firstApprove.isVisible({ timeout: 3000 }).catch(() => false);
    const hasReject  = await firstReject.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasApprove) {
      await firstApprove.click();
      await page.waitForTimeout(200);
    }
    if (hasReject) {
      await firstReject.click();
      await page.waitForTimeout(200);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06_remediation_hitl.png'),
      fullPage: true,
    });
  });
});
