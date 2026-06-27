/**
 * Third Delivery — University Evidence Screenshots.
 *
 * 10 screenshots covering the full AURA pipeline:
 * Upload → Profile → Audit → Diagnosis → Remediation Plan → Script Contract
 * → Review → Approval → Tampered Blocked → Phase 5 Boundary.
 *
 * Uses titanic.csv. Harness for contractual steps (no LLM, no Python execution).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';
import {
  buildColumnRegistry,
  buildScriptContext,
  buildScriptCandidateV2,
  validateScriptCandidateV2,
  finalizeScriptContractV2,
} from '../../contracts/llm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, '../../../experiments/datasets/titanic.csv');
const OUT = path.resolve(
  __dirname,
  '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/entrega3_universidad',
);
const COLS = ['PassengerId','Survived','Pclass','Name','Sex','Age','SibSp','Parch','Ticket','Fare','Cabin','Embarked'];

async function up(page: any, fp: string) {
  // Wait for Vite dev server to be ready (retry if not started yet)
  await page.waitForTimeout(5000);
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      break;
    } catch {
      if (attempt === 11) throw new Error('Server failed to start');
      await page.waitForTimeout(5000);
    }
  }
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar|Comenzar/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', fp);
  await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function harness(page: any) {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE4_INJECT__ === 'function',
    { timeout: 15_000 },
  );
}

async function injectPhase4(page: any, rf: string, fixture: any) {
  await page.evaluate(([d, p]: any[]) => {
    (window as any).__PHASE4_INJECT__(d, p);
  }, [fixture.diagnosis, fixture.plan]);
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

test.describe('Entrega 3 Universidad — AURA', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  // 01 ──────────────────────────────────────────────────────────────────────────
  test('01 — local first upload profile', async ({ page }) => {
    await up(page, CSV);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(OUT, '01_local_first_upload_profile.png'),
      fullPage: true,
    });
  });

  // 02 ──────────────────────────────────────────────────────────────────────────
  test('02 — deterministic audit findings', async ({ page }) => {
    await up(page, CSV);
    await expect(page.locator('.profile-editorial-header').first()).toBeVisible();
    // Scroll to audit findings / issues section
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="stage-decision-summary"]');
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT, '02_deterministic_audit_findings.png'),
      fullPage: true,
    });
  });

  // 03 ──────────────────────────────────────────────────────────────────────────
  test('03 — diagnosis evidence contract', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    // Inject diagnosis only (no plan) to show diagnosis state
    await page.evaluate((d: any) => {
      (window as any).__PHASE4_INJECT__(d, null, { analysisText: 'Diagnóstico estructurado completado (harness determinista).' });
    }, fixture.diagnosis);
    await page.waitForTimeout(2000);
    // Navigate to diagnosis step
    await page.locator('.profile-actions').getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(600);
    const diagStage = page.locator('[data-testid="diagnosis-stage"]');
    await expect(diagStage).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(OUT, '03_diagnosis_evidence_contract.png'),
      fullPage: true,
    });
  });

  // 04 ──────────────────────────────────────────────────────────────────────────
  test('04 — remediation plan HITL', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
    await goScript(page);
    const r = page.locator('[data-testid="remediation-stage"]');
    await expect(r.locator('.remediation-action').first()).toBeVisible();
    // Approve one, reject another
    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(500);
    await expect(r.getByText('Aprobado').first()).toBeVisible();
    await expect(r.getByText('Rechazado').first()).toBeVisible();
    await page.screenshot({
      path: path.join(OUT, '04_remediation_plan_hitl.png'),
      fullPage: true,
    });
  });

  // 05 ──────────────────────────────────────────────────────────────────────────
  test('05 — script contract valid', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT, '05_script_contract_valid.png'),
      fullPage: true,
    });
  });

  // 06 ──────────────────────────────────────────────────────────────────────────
  test('06 — script rendered code', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.script-code')).toBeVisible();
    await page.screenshot({
      path: path.join(OUT, '06_script_rendered_code.png'),
      fullPage: true,
    });
  });

  // 07 ──────────────────────────────────────────────────────────────────────────
  test('07 — human review read-only', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT, '07_human_review_readonly.png'),
      fullPage: true,
    });
  });

  // 08 ──────────────────────────────────────────────────────────────────────────
  test('08 — human approved contract', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 15_000 });
    await scrollReview(page);
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({
      path: path.join(OUT, '08_human_approved_contract.png'),
      fullPage: true,
    });
  });

  // 09 ──────────────────────────────────────────────────────────────────────────
  test('09 — tampered contract blocked', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
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
    await page.screenshot({
      path: path.join(OUT, '09_tampered_contract_blocked.png'),
      fullPage: true,
    });
  });

  // 10 ──────────────────────────────────────────────────────────────────────────
  test('10 — Phase 5 boundary', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const fixture = buildPhase4TitanicFixture(rf);
    await injectPhase4(page, rf, fixture);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 15_000 });
    await scrollReview(page);
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    // Click "Preparar exportación" to reach the Phase 5 boundary
    if (await page.getByText('Preparar exportación').isVisible()) {
      await page.getByText('Preparar exportación').click();
      await page.waitForTimeout(1000);
    }
    // Screenshot shows the export/preparation step — Phase 5 boundary
    await page.screenshot({
      path: path.join(OUT, '10_phase5_boundary_next_step.png'),
      fullPage: true,
    });
  });
});
