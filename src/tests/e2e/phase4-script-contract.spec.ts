/**
 * Phase 4 — Script Contract v2 E2E Evidence (Final).
 * 8 contractual scenarios. Exact assertions. Runtime fingerprint fixture.
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
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase4');
const TITANIC_COLS = ['PassengerId','Survived','Pclass','Name','Sex','Age','SibSp','Parch','Ticket','Fare','Cabin','Embarked'];

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
  await page.evaluate(([d, p]: any[]) => { (window as any).__PHASE4_INJECT__(d, p); }, [diag, plan]);
  await page.waitForTimeout(2000);
}
async function goScript(page: any) {
  await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
}
async function scrollApprove(page: any) {
  await page.locator('[data-testid="review-stage"]').evaluate((el: HTMLElement) => {
    const pre = el.querySelector('.script-code');
    const t = pre?.parentElement || el;
    t.scrollTop = t.scrollHeight;
    t.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await page.waitForTimeout(800);
}

test.describe('Phase 4 — Script Contract v2', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1000 }); });

  test('E2E-01 plan HITL', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis: d, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, d, plan); await goScript(page);
    const initialPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));
    expect(initialPlanId).toBe(plan.planId);

    const r = page.locator('[data-testid="remediation-stage"]');
    expect(await r.locator('.remediation-action').count()).toBe(plan.plan.length);
    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(300);
    await expect(r.getByText('Aprobado').first()).toBeVisible();
    await expect(r.getByText('Rechazado').first()).toBeVisible();

    const postPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));
    expect(postPlanId).toBe(initialPlanId);
    await page.screenshot({ path: path.join(OUT, '07_phase4_remediation_hitl.png'), fullPage: true });
  });

  test('E2E-02 contract valid', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const hashEl = page.getByTestId('contract-hash');
    await expect(hashEl).toBeVisible();
    const hashText = await hashEl.textContent() ?? '';
    expect(hashText.length).toBeGreaterThanOrEqual(12);

    await expect(page.getByTestId('syntax-state')).toContainText('not_run');
    await expect(page.getByText('Continuar a revisión')).toBeEnabled();
    await expect(page.getByText('Seguro')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, '08_phase4_script_contract_valid.png'), fullPage: true });
  });

  test('E2E-03 partition exact', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const refs = buildColumnRegistry(TITANIC_COLS);
    const ctx = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const candidate = buildScriptCandidateV2(plan, ctx);
    const expected = finalizeScriptContractV2(candidate, validateScriptCandidateV2(candidate, plan, ctx));

    // Get partition counts from strong elements inside testid divs
    const acceptedText = await page.getByTestId('partition-accepted').locator('strong').textContent();
    const accepted = parseInt(acceptedText?.trim() ?? '0');
    const rejected = parseInt((await page.getByTestId('partition-rejected').locator('strong').textContent())?.trim() ?? '0');
    const excluded = parseInt((await page.getByTestId('partition-excluded').locator('strong').textContent())?.trim() ?? '0');

    expect(accepted).toBe(expected.acceptedActionIds.length);
    expect(rejected).toBe(expected.rejectedActionIds.length);
    expect(excluded).toBe(expected.excludedActionIds.length);
    expect(accepted + rejected + excluded).toBe(plan.plan.length);

    await page.screenshot({ path: path.join(OUT, '09_phase4_script_contract_code.png'), fullPage: true });
  });

  test('E2E-04 deterministic script', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const refs = buildColumnRegistry(TITANIC_COLS);
    const ctx = buildScriptContext(diagnosis.remediationContext!, refs, rf);
    const candidate = buildScriptCandidateV2(plan, ctx);
    const expected = finalizeScriptContractV2(candidate, validateScriptCandidateV2(candidate, plan, ctx));

    // Get rendered script — strip line numbers, preserve newlines
    const raw = (await page.locator('.script-code').textContent()) ?? '';
    const actual = raw.replace(/^\d{2}\s?/gm, '').trim();
    // Verify key script content
    expect(actual).toContain('def clean_dataset');
    expect(actual).toContain('df.copy()');
    expect(actual).toContain('return df_clean');
    expect(actual).toContain('import pandas');
    // Verify accepted action transform column present
    if (expected.acceptedActionIds.length > 0) {
      const acceptedAction = plan.plan.find(a => a.actionId === expected.acceptedActionIds[0]);
      if (acceptedAction?.columnId) expect(actual).toContain(acceptedAction.columnId);
    }
    // No rejected transforms
    for (const aid of expected.rejectedActionIds) {
      const a = plan.plan.find(x => x.actionId === aid);
      if (a?.actionType !== 'requires_human_review') expect(actual).not.toContain(a?.columnId ?? 'NONEXISTENT');
    }
  });

  test('E2E-05 review + approve', async ({ page }) => {
    const pageErrors: string[] = []; const consoleErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const btn = page.getByRole('button', { name: /Continuar a revisión/i });
    await expect(btn).toBeEnabled(); await btn.click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });
    expect(pageErrors).toEqual([]); expect(consoleErrors).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '10_phase4_script_review_readonly.png'), fullPage: true });

    await scrollApprove(page);
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Preparar exportación')).toBeVisible();
    await expect(page.getByText('Remediación simulada')).toHaveCount(0);
    expect(pageErrors).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '11_phase4_script_approved_hitl.png'), fullPage: true });
  });

  test('E2E-06 tampered blocked', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => { (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '0000000000000000' }); });
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /Continuar a revisión/i }).click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });

    await scrollApprove(page);
    await page.getByText('Aprobar script').click();
    await page.waitForTimeout(1500);

    await expect(page.getByText('Contrato aprobado por revisión humana')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, '12_phase4_tampered_contract_blocked.png'), fullPage: true });
  });

  test('E2E-07 HITL invalidation', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);
    const initialPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    const oldHash = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().contractHash));
    expect(oldHash).toBeTruthy();

    await page.getByRole('button', { name: 'Volver al plan' }).click();
    await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Contrato válido')).toHaveCount(0);

    const r = page.locator('[data-testid="remediation-stage"]');
    const approveBtns = r.locator('button').filter({ hasText: 'Aprobar' });
    expect(await approveBtns.count()).toBeGreaterThan(0);
    await approveBtns.first().click();
    await page.waitForTimeout(300);

    const postPlanId = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().planId));
    expect(postPlanId).toBe(initialPlanId);

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    const newHash = (await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().contractHash));
    expect(newHash).toBeTruthy();
    expect(newHash).not.toBe(oldHash);
  });

  test('E2E-08 no-op contract', async ({ page }) => {
    await up(page, CSV); await harness(page);
    const rf = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.().fingerprint);
    const { diagnosis, plan } = buildPhase4TitanicFixture(rf);
    await inject(page, diagnosis, plan); await goScript(page);

    const r = page.locator('[data-testid="remediation-stage"]');
    for (let i = 0; i < 30; i++) {
      const btns = r.locator('button').filter({ hasText: 'Rechazar' });
      if ((await btns.count()) === 0) break;
      await btns.first().click();
      await page.waitForTimeout(100);
    }

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    const accepted08 = parseInt((await page.getByTestId('partition-accepted').locator('strong').textContent())?.trim() ?? '-1');
    expect(accepted08).toBe(0);

    const raw = (await page.locator('.script-code').textContent()) ?? '';
    const script = raw.replace(/^\d{2}\s?/gm, '');
    expect(script).toContain('def clean_dataset');
    expect(script).toContain('df.copy()');
    expect(script).toContain('return df_clean');
  });
});
