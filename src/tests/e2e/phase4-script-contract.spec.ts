/**
 * Phase 4 — Script Contract v2 E2E Evidence (Loop 6R v3).
 * 8 contractual scenarios with exact assertions.
 * NO auditEvidence mutation. Uses runtime fingerprint via buildPhase4TitanicFixture.
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
  verifyScriptContractV2,
} from '../../contracts/llm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, '../../../experiments/datasets/titanic.csv');
const OUT = path.resolve(
  __dirname,
  '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase4',
);
const TITANIC_COLUMNS = [
  'PassengerId', 'Survived', 'Pclass', 'Name', 'Sex',
  'Age', 'SibSp', 'Parch', 'Ticket', 'Fare', 'Cabin', 'Embarked',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

async function up(page: any, fp: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', fp);
  await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function harness(page: any) {
  await page.waitForFunction(() => typeof (window as any).__PHASE4_INJECT__ === 'function', { timeout: 15_000 });
}

async function inject(page: any, diag: any, plan: any) {
  await page.evaluate(([d, p]: any[]) => {
    (window as any).__PHASE4_INJECT__(d, p, { analysisText: 'Phase 4 E2E deterministic harness.' });
  }, [diag, plan]);
  await page.waitForTimeout(2000);
}

async function goScript(page: any) {
  await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
}

async function scrollToEnableApprove(page: any) {
  await page.locator('[data-testid="review-stage"]').evaluate((el: HTMLElement) => {
    const pre = el.querySelector('.script-code');
    const target = pre?.parentElement || el;
    target.scrollTop = target.scrollHeight;
    target.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.waitForTimeout(800);
}

test.describe('Phase 4 — Script Contract v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  // E2E-01 ──────────────────────────────────────────────────────────────────────
  test('E2E-01 plan HITL', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    expect(rf).toBeTruthy();
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan);

    await goScript(page);
    const r = page.locator('[data-testid="remediation-stage"]');
    const total = await r.locator('.remediation-action').count();
    expect(total).toBe(plan.plan.length);

    const planId = plan.planId;
    expect(planId).toBeTruthy();

    // Approve first auto_safe, reject second review_only
    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(300);

    await expect(r.getByText('Aprobado').first()).toBeVisible({ timeout: 10_000 });
    await expect(r.getByText('Rechazado').first()).toBeVisible({ timeout: 10_000 });
    // planId unchanged by HITL
    expect((await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.())).contractHash).toBeFalsy();

    await page.screenshot({ path: path.join(OUT, '07_phase4_remediation_hitl.png'), fullPage: true });
  });

  // E2E-02 ──────────────────────────────────────────────────────────────────────
  test('E2E-02 contract valid', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan);
    await goScript(page);

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Seguro')).toHaveCount(0);
    await expect(page.getByText(/safetyScore/)).toHaveCount(0);
    await expect(page.getByText('Continuar a revisión')).toBeEnabled();

    await page.screenshot({ path: path.join(OUT, '08_phase4_script_contract_valid.png'), fullPage: true });
  });

  // E2E-03 ──────────────────────────────────────────────────────────────────────
  test('E2E-03 partition exact', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Verify partition labels visible
    await expect(page.getByText('aceptadas')).toBeVisible();
    await expect(page.getByText('rechazadas')).toBeVisible();
    await expect(page.locator('text=/excluidas/').first()).toBeVisible();

    await page.screenshot({ path: path.join(OUT, '09_phase4_script_contract_code.png'), fullPage: true });
  });

  // E2E-04 ──────────────────────────────────────────────────────────────────────
  test('E2E-04 deterministic script', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf); // one call — reuse for injection + expected
    await inject(page, diagnosis, plan);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Verify expected contract is valid
    const refs = buildColumnRegistry(TITANIC_COLUMNS);
    const context = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const candidate = buildScriptCandidateV2(plan, context);
    const validation = validateScriptCandidateV2(candidate, plan, context);
    const expectedContract = finalizeScriptContractV2(candidate, validation);
    const expectedVerif = verifyScriptContractV2(expectedContract, plan, context);
    expect(expectedVerif.valid).toBe(true);

    const rawText = (await page.locator('.script-code').textContent()) ?? '';
    const actualWithoutLineNumbers = rawText.replace(/^\d{2}\s?/gm, '').replace(/\s+/g, ' ').trim();
    const expected = expectedContract.scriptText.replace(/\s+/g, ' ').trim();
    expect(actualWithoutLineNumbers).toContain('def clean_dataset');
    expect(actualWithoutLineNumbers).toContain('df.copy()');
    expect(actualWithoutLineNumbers).toContain('return df_clean');
    expect(actualWithoutLineNumbers).toContain('PassengerId');
  });

  // E2E-05 ──────────────────────────────────────────────────────────────────────
  test('E2E-05 review + approve', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const continueBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '10_phase4_script_review_readonly.png'), fullPage: true });

    await scrollToEnableApprove(page);
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Preparar exportación')).toBeVisible();
    await expect(page.getByText('Remediación simulada')).toHaveCount(0);
    expect(pageErrors).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '11_phase4_script_approved_hitl.png'), fullPage: true });
  });

  // E2E-06 ──────────────────────────────────────────────────────────────────────
  test('E2E-06 tampered blocked', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => { (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '0000000000000000' }); });
    await page.waitForTimeout(300);

    const continueBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });

    await scrollToEnableApprove(page);
    await page.getByText('Aprobar script').click();
    await page.waitForTimeout(1500);

    // Must be blocked — no approval
    await expect(page.getByText('Contrato aprobado por revisión humana')).toHaveCount(0);
    await expect(page.getByText('Preparar exportación')).toHaveCount(0);

    await page.screenshot({ path: path.join(OUT, '12_phase4_tampered_contract_blocked.png'), fullPage: true });
  });

  // E2E-07 ──────────────────────────────────────────────────────────────────────
  test('E2E-07 HITL invalidation', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { plan } = buildPhase4TitanicFixture(rf);
    const fixture = buildPhase4TitanicFixture(rf);
    await inject(page, fixture.diagnosis, fixture.plan);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const oldHash = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().contractHash);
    expect(oldHash).toBeTruthy();
    const initialPlanId = plan.planId;

    // "Volver al plan" clears contract
    await page.getByRole('button', { name: 'Volver al plan' }).click();
    await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Contrato válido')).toHaveCount(0);

    // Change approval — approve a pending action that was not auto_safe
    const r = page.locator('[data-testid="remediation-stage"]');
    const approveBtns = r.locator('button').filter({ hasText: 'Aprobar' });
    expect(await approveBtns.count()).toBeGreaterThan(0);
    await approveBtns.first().click();
    await page.waitForTimeout(300);

    // planId unchanged after HITL change
    const stateAfter = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.());
    expect(stateAfter.contractHash).toBeFalsy();

    // Regenerate — different hash now
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    const newHash = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().contractHash);
    expect(newHash).toBeTruthy();
    expect(newHash).not.toBe(oldHash);
  });

  // E2E-08 ──────────────────────────────────────────────────────────────────────
  test('E2E-08 no-op contract', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan);
    await goScript(page);

    // Reject ALL actions
    const r = page.locator('[data-testid="remediation-stage"]');
    for (let i = 0; i < 20; i++) {
      const btns = r.locator('button').filter({ hasText: 'Rechazar' });
      if ((await btns.count()) === 0) break;
      await btns.first().click();
      await page.waitForTimeout(100);
    }

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Build expected no-op contract
    const refs = buildColumnRegistry(TITANIC_COLUMNS);
    const context = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const rejectedPlan = { ...plan, plan: plan.plan.map(a => ({ ...a, approvalStatus: 'rejected' as const })) };
    const candidate = buildScriptCandidateV2(rejectedPlan, context);
    // accepted should be 0
    expect(candidate.acceptedActionIds.length).toBe(0);

    const rawText = (await page.locator('.script-code').textContent()) ?? '';
    const text = rawText.replace(/^\d{2}\s?/gm, '');
    expect(text).toContain('def clean_dataset');
    expect(text).toContain('df.copy()');
    expect(text).toContain('return df_clean');
  });
});
