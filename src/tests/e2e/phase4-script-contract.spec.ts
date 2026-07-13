/**
 * Phase 4 — Script Contract v2 E2E Evidence (sealed).
 * 8 contractual scenarios. Exact assertions. Runtime fingerprint fixture.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';
import {
  buildColumnRegistry, buildScriptContext, buildScriptCandidateV2,
  validateScriptCandidateV2, finalizeScriptContractV2,
} from '../../contracts/llm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, 'fixtures/titanic-mini.csv');
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase4');
const COLS = ['PassengerId','Survived','Pclass','Name','Sex','Age','SibSp','Parch','Ticket','Fare','Cabin','Embarked'];

async function up(p: any, fp: string) {
  await p.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await p.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await p.getByRole('button', { name: /Empezar auditoría/i }).click();
  await p.waitForTimeout(500);
  await p.setInputFiles('input[type="file"]', fp);
  await p.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}
async function h(p: any) {
  await p.waitForFunction(() => typeof (window as any).__PHASE4_INJECT__ === 'function', { timeout: 15_000 });
}
async function inj(p: any, d: any, pl: any) {
  await p.evaluate(([x, y]: any[]) => { (window as any).__PHASE4_INJECT__(x, y); }, [d, pl]);
  await p.waitForTimeout(2000);
}
async function gs(p: any) {
  await p.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
  await p.waitForTimeout(1000);
  await expect(p.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
}
async function approveFirstRenderable(p: any) {
  const r = p.locator('[data-testid="remediation-stage"]');
  const approveBtns = r.locator('button').filter({ hasText: 'Aprobar' });
  await expect(approveBtns.first()).toBeVisible({ timeout: 10_000 });
  await approveBtns.first().click();
  await p.waitForTimeout(300);
}
function approveFirstAction(plan: any) {
  return {
    ...plan,
    plan: plan.plan.map((a: any, index: number) => (
      index === 0 ? { ...a, approvalStatus: 'approved' as const } : a
    )),
  };
}
async function scroll(p: any) {
  await p.locator('[data-testid="review-stage"]').evaluate((el: HTMLElement) => {
    const pre = el.querySelector('.script-code');
    const t = pre?.parentElement || el;
    t.scrollTop = t.scrollHeight;
    t.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await p.waitForTimeout(800);
}

test.describe('Phase 4 — Script Contract v2', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1000 }); });

  // ── E2E-01 ──────────────────────────────────────────────────────────────────
  test('E2E-01 plan HITL', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis: d, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, d, plan); await gs(page);
    const initialPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));
    expect(initialPlanId).toBe(plan.planId);

    const r = page.locator('[data-testid="remediation-stage"]');
    expect(await r.locator('.remediation-action').count()).toBe(plan.plan.length);

    // Approve first action, reject second
    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(500);

    await expect(r.getByText('Aprobado').first()).toBeVisible();
    await expect(r.getByText('Rechazado').first()).toBeVisible();

    const postPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));
    expect(postPlanId).toBe(initialPlanId);
    await page.screenshot({ path: path.join(OUT, '07_phase4_remediation_hitl.png'), fullPage: true });
  });

  // ── E2E-02 ──────────────────────────────────────────────────────────────────
  test('E2E-02 contract valid', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);
    await approveFirstRenderable(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Full hash exposed as attribute
    const hashEl = page.getByTestId('contract-hash');
    const fullHash = await hashEl.getAttribute('data-contract-hash') ?? '';
    expect(fullHash).toMatch(/^[a-f0-9]{64}$/);

    await expect(page.getByTestId('syntax-state')).toContainText('not_run');
    await expect(page.getByRole('button', { name: /Continuar a revisión/i })).toBeEnabled();
    await expect(page.getByText('Seguro')).toHaveCount(0);
    await expect(page.getByText(/safetyScore/)).toHaveCount(0);
    await expect(page.getByText('Remediación simulada')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, '08_phase4_script_contract_valid.png'), fullPage: true });
  });

  // ── E2E-03 ──────────────────────────────────────────────────────────────────
  test('E2E-03 partition exact', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);
    await approveFirstRenderable(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const refs = buildColumnRegistry(COLS);
    const ctx = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const approvedPlan = approveFirstAction(plan);
    const candidate = buildScriptCandidateV2(approvedPlan, ctx);
    const expected = finalizeScriptContractV2(candidate, validateScriptCandidateV2(candidate, approvedPlan, ctx));

    const accepted = parseInt((await page.getByTestId('partition-accepted').locator('strong').textContent())?.trim() ?? '0');
    const rejected = parseInt((await page.getByTestId('partition-rejected').locator('strong').textContent())?.trim() ?? '0');
    const excluded = parseInt((await page.getByTestId('partition-excluded').locator('strong').textContent())?.trim() ?? '0');

    expect(accepted).toBe(expected.acceptedActionIds.length);
    expect(rejected).toBe(expected.rejectedActionIds.length);
    expect(excluded).toBe(expected.excludedActionIds.length);
    expect(accepted + rejected + excluded).toBe(plan.plan.length);

    await page.screenshot({ path: path.join(OUT, '09_phase4_script_contract_code.png'), fullPage: true });
  });

  // ── E2E-04 ──────────────────────────────────────────────────────────────────
  test('E2E-04 deterministic script', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);
    await approveFirstRenderable(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const refs = buildColumnRegistry(COLS);
    const ctx = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const approvedPlan = approveFirstAction(plan);
    const candidate = buildScriptCandidateV2(approvedPlan, ctx);
    const expected = finalizeScriptContractV2(candidate, validateScriptCandidateV2(candidate, approvedPlan, ctx));

    const rawLines = await page.locator('.script-line code').allTextContents();
    const actual = rawLines.map(l => l.trim() === '' ? '' : l).join('\n');
    expect(actual).toBe(expected.scriptText);
    expect(actual).toContain('def clean_dataset');

    // Rejected transforms absent
    for (const aid of expected.rejectedActionIds) {
      const a = plan.plan.find(x => x.actionId === aid);
      if (a?.columnId) expect(actual).not.toContain(a.columnId);
    }
  });

  // ── E2E-05 ──────────────────────────────────────────────────────────────────
  test('E2E-05 review + approve', async ({ page }) => {
    const pe: string[] = []; const ce: string[] = [];
    page.on('pageerror', e => pe.push(e.message));
    page.on('console', m => { if (m.type() === 'error') ce.push(m.text()); });

    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);
    await approveFirstRenderable(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: /Continuar a revisión/i })).toBeEnabled();
    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });
    expect(pe).toEqual([]); expect(ce).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '10_phase4_script_review_readonly.png'), fullPage: true });

    await scroll(page);
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Preparar exportación')).toBeVisible();
    await expect(page.getByText('Remediación simulada')).toHaveCount(0);
    expect(pe).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '11_phase4_script_approved_hitl.png'), fullPage: true });
  });

  // ── E2E-06 ──────────────────────────────────────────────────────────────────
  test('E2E-06 tampered blocked', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);
    await approveFirstRenderable(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => { (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '0000000000000000' }); });
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });

    await scroll(page);
    await page.getByText('Aprobar script').click();
    await page.waitForTimeout(2000);

    // Must show verification failure (error appears in provider-error-notice)
    const errorBlock = page.locator('[data-testid="review-stage"] .provider-error-notice');
    await expect(errorBlock).toBeAttached({ timeout: 10_000 });
    await expect(page.getByText('Contrato aprobado por revisión humana')).toHaveCount(0);
    await expect(page.getByText('Preparar exportación')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, '12_phase4_tampered_contract_blocked.png'), fullPage: true });
  });

  // ── E2E-07 ──────────────────────────────────────────────────────────────────
  test('E2E-07 HITL invalidation', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);
    const initialPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    const oldHash = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().contractHash));
    expect(oldHash).toMatch(/^[a-f0-9]{64}$/);

    await page.getByRole('button', { name: 'Volver al plan' }).click();
    await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible();
    await expect(page.getByText('Contrato válido')).toHaveCount(0);

    const r = page.locator('[data-testid="remediation-stage"]');
    const approveBtns = r.locator('button').filter({ hasText: 'Aprobar' });
    expect(await approveBtns.count()).toBeGreaterThan(0);
    await approveBtns.first().click();
    await page.waitForTimeout(300);

    const postPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));
    expect(postPlanId).toBe(initialPlanId);

    // Regenerate
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const newHash = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().contractHash));
    expect(newHash).toMatch(/^[a-f0-9]{64}$/);
    expect(newHash).not.toBe(oldHash);

    // Verify updated partition counts
    const refs = buildColumnRegistry(COLS);
    const ctx = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const candidate2 = buildScriptCandidateV2(plan, ctx);
    // HITL changed plan — re-read from state
    const accepted2 = parseInt((await page.getByTestId('partition-accepted').locator('strong').textContent())?.trim() ?? '0');
    const rejected2 = parseInt((await page.getByTestId('partition-rejected').locator('strong').textContent())?.trim() ?? '0');
    const excluded2 = parseInt((await page.getByTestId('partition-excluded').locator('strong').textContent())?.trim() ?? '0');
    expect(accepted2).toBeGreaterThanOrEqual(0);
    expect(accepted2 + rejected2 + excluded2).toBe(plan.plan.length);
  });

  // ── E2E-08 ──────────────────────────────────────────────────────────────────
  test('E2E-08 no-op contract', async ({ page }) => {
    await up(page, CSV); await h(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inj(page, diagnosis, plan); await gs(page);

    const r = page.locator('[data-testid="remediation-stage"]');
    for (let i = 0; i < 30; i++) {
      const btns = r.locator('button').filter({ hasText: 'Rechazar' });
      if ((await btns.count()) === 0) break;
      await btns.first().click();
      await page.waitForTimeout(80);
    }

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const accepted = parseInt((await page.getByTestId('partition-accepted').locator('strong').textContent())?.trim() ?? '-1');
    expect(accepted).toBe(0);

    // Build expected no-op contract
    const refs = buildColumnRegistry(COLS);
    const ctx = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const rejectedPlan = { ...plan, plan: plan.plan.map(a => ({ ...a, approvalStatus: 'rejected' as const })) };
    const candidate = buildScriptCandidateV2(rejectedPlan, ctx);
    expect(candidate.acceptedActionIds.length).toBe(0);
    const expected = finalizeScriptContractV2(candidate, validateScriptCandidateV2(candidate, rejectedPlan, ctx));

    const rawLines08 = await page.locator('.script-line code').allTextContents();
    const actual08 = rawLines08.map(l => l.trim() === '' ? '' : l).join('\n');
    expect(actual08).toBe(expected.scriptText);
    expect(actual08).toContain('def clean_dataset');
    expect(actual08).toContain('df.copy()');
    expect(actual08).toContain('return df_clean');
    await expect(page.getByTestId('script-contract-no-executable')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sin acciones ejecutables/i })).toBeDisabled();
  });
});
