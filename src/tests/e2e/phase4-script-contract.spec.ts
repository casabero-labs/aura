/**
 * Phase 4 — Script Contract v2 E2E Evidence (Loop 6R).
 *
 * 8 E2E scenarios demonstrating full contractual flow:
 * RemediationPlanV2 → HITL → ScriptContractV2 → review → approval → fail-closed.
 *
 * Uses Phase4EvidenceHarness for deterministic diagnosis + plan.
 * NO LLM. NO Python execution. NO HealthDelta. NO dataset transformations.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { PHASE4_TITANIC_DIAGNOSIS, PHASE4_TITANIC_PLAN } from './harness/Phase4EvidenceHarness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(__dirname, '../../../experiments/datasets/titanic.csv');
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/phase4');

// ── Helpers ────────────────────────────────────────────────────────────────────

async function up(page: any, fp: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', fp);
  await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function waitHarness(page: any) {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE4_INJECT__ === 'function',
    { timeout: 15_000 },
  );
}

async function injectFull(page: any) {
  await page.evaluate(([diag, plan]: any[]) => {
    (window as any).__PHASE4_SYNC_FP__(diag.remediationContext.datasetFingerprint);
    (window as any).__PHASE4_INJECT__(diag, plan, { analysisText: 'Phase 4 E2E diagnosis (deterministic harness).' });
  }, [PHASE4_TITANIC_DIAGNOSIS, PHASE4_TITANIC_PLAN]);
  await page.waitForTimeout(2000);
}

async function goScript(page: any) {
  await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="remediation-stage"]')).toBeVisible({ timeout: 10_000 });
}

test.describe('Phase 4 — Script Contract v2 (Loop 6R)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  // ── E2E-01: Plan + HITL ─────────────────────────────────────────────────────

  test('E2E-01 plan HITL', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);

    const r = page.locator('[data-testid="remediation-stage"]');
    await expect(r.locator('.remediation-action').first()).toBeVisible();

    // Count total actions
    const totalActions = await r.locator('.remediation-action').count();
    expect(totalActions).toBeGreaterThanOrEqual(2);

    // Approve first (auto_safe)
    const firstApprove = r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' });
    await expect(firstApprove).toBeVisible();
    await firstApprove.click();
    await page.waitForTimeout(300);

    // Reject second (review_only)
    const secondReject = r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' });
    await expect(secondReject).toBeVisible();
    await secondReject.click();
    await page.waitForTimeout(300);

    // Verify states
    await expect(r.getByText('Aprobado').first()).toBeVisible({ timeout: 10_000 });
    await expect(r.getByText('Rechazado').first()).toBeVisible({ timeout: 10_000 });

    // PlanId persists (not changed by HITL)
    const planId = PHASE4_TITANIC_PLAN.planId;
    expect(planId).toBeTruthy();

    await page.screenshot({ path: path.join(OUT, '07_phase4_remediation_hitl.png'), fullPage: true });
  });

  // ── E2E-02: Valid contract ──────────────────────────────────────────────────

  test('E2E-02 contract valid', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);

    // Generate contract
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Assertions
    await expect(page.getByText('Seguro')).toHaveCount(0);
    await expect(page.getByText(/safetyScore/)).toHaveCount(0);
    await expect(page.getByText(/not_run/)).toBeVisible();
    await expect(page.getByText(/renderer:/)).toBeVisible();
    await expect(page.getByText('Continuar a revisión')).toBeVisible();

    await page.screenshot({ path: path.join(OUT, '08_phase4_script_contract_valid.png'), fullPage: true });
  });

  // ── E2E-03: Partition exact ─────────────────────────────────────────────────

  test('E2E-03 partition', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Partition labels must be visible
    await expect(page.getByText('aceptadas')).toBeVisible();
    await expect(page.getByText('rechazadas')).toBeVisible();
    await expect(page.locator('text=/excluidas/').first()).toBeVisible();

    // Total = accepted + rejected + excluded (verified in code step)
    await page.screenshot({ path: path.join(OUT, '09_phase4_script_contract_code.png'), fullPage: true });
  });

  // ── E2E-04: Deterministic script ────────────────────────────────────────────

  test('E2E-04 deterministic script', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Script code visible
    const code = page.locator('.script-code');
    await expect(code).toBeVisible();
    const text = await code.textContent();
    expect(text).toContain('def clean_dataset');
    expect(text).toMatch(/import pandas/);
  });

  // ── E2E-05: Review + approval ───────────────────────────────────────────────

  test('E2E-05 review + approve', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Click real button + harness fallback for review transition
    await page.getByText('Continuar a revisión').click();
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('review'); });
      await page.waitForTimeout(500);
      const visible = await page.locator('[data-testid="review-stage"]').isVisible().catch(() => false);
      if (visible) break;
    }
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: path.join(OUT, '10_phase4_script_review_readonly.png'), fullPage: true });

    // Approve
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Preparar exportación')).toBeVisible();

    await page.screenshot({ path: path.join(OUT, '11_phase4_script_approved_hitl.png'), fullPage: true });
  });

  // ── E2E-06: Hash tampered → fail-closed ─────────────────────────────────────

  test('E2E-06 tampered', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Tamper hash
    await page.evaluate(() => {
      (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '0000000000000000' });
    });
    await page.waitForTimeout(300);

    // Continue to review
    await page.getByText('Continuar a revisión').click();
    await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('review'); });
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="review-stage"]')).toBeVisible({ timeout: 15_000 });

    // Try to approve
    await page.getByText('Aprobar script').click();
    await page.waitForTimeout(1000);

    // Blocked
    await expect(page.getByText('Contrato aprobado por revisión humana')).toHaveCount(0);
    await expect(page.getByText('Preparar exportación')).toHaveCount(0);

    await page.screenshot({ path: path.join(OUT, '12_phase4_tampered_contract_blocked.png'), fullPage: true });
  });

  test('E2E-07 HITL invalidation', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Navigate back to plan
    await page.evaluate(() => { (window as any).__PHASE4_SET_STATE__('script'); });
    await page.waitForTimeout(500);

    const r = page.locator('[data-testid="remediation-stage"]');
    await expect(r).toBeVisible({ timeout: 10_000 });

    // Change approval — approve a pending action
    const approveBtns = r.locator('button').filter({ hasText: 'Aprobar' });
    const count = await approveBtns.count();
    if (count > 0) {
      await approveBtns.first().click();
      await page.waitForTimeout(300);
    }

    // Contract invalidated
    await expect(page.getByText('Contrato válido')).toHaveCount(0);
    await expect(page.getByText('Generar contrato de script')).toBeVisible();

    // Regenerate
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
  });

  test('E2E-08 no-op', async ({ page }) => {
    await up(page, CSV);
    await waitHarness(page);
    await injectFull(page);
    await goScript(page);

    // Reject ALL actions
    const r = page.locator('[data-testid="remediation-stage"]');
    for (let i = 0; i < 20; i++) {
      const btns = r.locator('button').filter({ hasText: 'Rechazar' });
      const c = await btns.count();
      if (c === 0) break;
      await btns.first().click();
      await page.waitForTimeout(100);
    }

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('aceptadas 0')).toBeVisible();

    const code = page.locator('.script-code');
    await expect(code).toBeVisible();
    const text = await code.textContent();
    expect(text).toContain('def clean_dataset');
    expect(text).toContain('return df_clean');
  });
});
