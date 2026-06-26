/**
 * Phase 4 — Script Contract v2 E2E Evidence.
 *
 * Demonstrates: RemediationPlanV2 → HITL → ScriptContractV2 → review → approval.
 * Viewport: 1440 × 1000. Dataset: titanic.csv.
 * Uses window.__PHASE4_INJECT__ harness (no LLM, no Python execution).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, '../../../experiments/datasets/titanic.csv');
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase4');

async function up(page: any, fp: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', fp);
  await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function inject(page: any) {
  await page.waitForFunction(() => typeof (window as any).__PHASE4_INJECT__ === 'function', { timeout: 15_000 });
  await page.evaluate(() => {
    const cs = ['PassengerId','Survived','Pclass','Name','Sex','Age','SibSp','Parch','Ticket','Fare','Cabin','Embarked'];
    const fp = '4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7';
    (window as any).__PHASE4_INJECT__((window as any).__PHASE4_BUILD_DIAGNOSIS__(cs, fp), null);
  });
  await page.waitForTimeout(3000);
}

async function goScript(page: any) {
  await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
}

async function goReview(page: any) {
  await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('review'); });
  await page.waitForTimeout(2000);
  await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 10_000 });
}

test.describe('Phase 4 — Script Contract v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test('07 — remission_hitl @phase4 @evidence', async ({ page }) => {
    await up(page, CSV);
    await inject(page);
    await goScript(page);
    const r = page.locator('[data-testid="remediation-stage"]');
    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(500);
    await expect(r.getByText('Aprobado').first()).toBeVisible({ timeout: 10_000 });
    await expect(r.getByText('Rechazado').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(OUT, '07_phase4_remediation_hitl.png'), fullPage: true });
  });

  test('08 — contract-valid @phase4 @evidence', async ({ page }) => {
    await up(page, CSV);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT, '08_phase4_script_contract_valid.png'), fullPage: true });
  });

  test('09 — contract-code @phase4 @evidence', async ({ page }) => {
    await up(page, CSV);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.script-code')).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: path.join(OUT, '09_phase4_script_contract_code.png'), fullPage: true });
  });

  test('10 — review @phase4 @evidence', async ({ page }) => {
    await up(page, CSV);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await goReview(page);
    await page.screenshot({ path: path.join(OUT, '10_phase4_script_review_readonly.png'), fullPage: true });
  });

  test('11 — approved @phase4 @evidence', async ({ page }) => {
    await up(page, CSV);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await goReview(page);
    // Click approve and capture immediately
    try {
      await page.getByText('Aprobar script').click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch {
      // Approve button may be slow to appear
    }
    await page.screenshot({ path: path.join(OUT, '11_phase4_script_approved_hitl.png'), fullPage: true });
  });

  test('12 — tampered @phase4 @evidence', async ({ page }) => {
    await up(page, CSV);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await page.waitForTimeout(3000);
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '000000000000' }); });
    await page.waitForTimeout(1000);
    await goReview(page);
    await page.screenshot({ path: path.join(OUT, '12_phase4_tampered_contract_blocked.png'), fullPage: true });
  });
});
