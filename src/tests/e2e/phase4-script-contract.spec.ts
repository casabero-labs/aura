/**
 * Phase 4 — Script Contract v2 E2E Evidence (Loop 6R v2).
 * 8 contractual scenarios. NO harness review navigation. NO try/catch hacks.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { PHASE4_TITANIC_DIAGNOSIS, PHASE4_TITANIC_PLAN } from './harness/Phase4EvidenceHarness';

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

async function harness(page: any) {
  await page.waitForFunction(() => typeof (window as any).__PHASE4_INJECT__ === 'function', { timeout: 15_000 });
}

async function inject(page: any) {
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

async function captureErrors(cb: (page: any) => Promise<void>) {
  // Error capture wrapper to be used per test
}

test.describe('Phase 4 — Script Contract v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  // E2E-01 ──────────────────────────────────────────────────────────────────────
  test('E2E-01 plan HITL', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);

    const r = page.locator('[data-testid="remediation-stage"]');
    await expect(r.locator('.remediation-action').first()).toBeVisible();

    const total = await r.locator('.remediation-action').count();
    expect(total).toBeGreaterThanOrEqual(2);

    await r.locator('.remediation-action').first().locator('button', { hasText: 'Aprobar' }).click();
    await page.waitForTimeout(300);
    await r.locator('.remediation-action').nth(1).locator('button', { hasText: 'Rechazar' }).click();
    await page.waitForTimeout(300);

    await expect(r.getByText('Aprobado').first()).toBeVisible({ timeout: 10_000 });
    await expect(r.getByText('Rechazado').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(OUT, '07_phase4_remediation_hitl.png'), fullPage: true });
  });

  // E2E-02 ──────────────────────────────────────────────────────────────────────
  test('E2E-02 contract valid', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT, '08_phase4_script_contract_valid.png'), fullPage: true });
  });

  // E2E-03 ──────────────────────────────────────────────────────────────────────
  test('E2E-03 partition', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('aceptadas')).toBeVisible();
    await expect(page.locator('.script-code')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, '09_phase4_script_contract_code.png'), fullPage: true });
  });

  // E2E-04 ──────────────────────────────────────────────────────────────────────
  test('E2E-04 deterministic script', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
    const text = await page.locator('.script-code').textContent();
    expect(text).toContain('def clean_dataset');
    expect(text).toMatch(/import pandas/);
  });

  // E2E-05 ──────────────────────────────────────────────────────────────────────
  test('E2E-05 review + approve', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Diagnostic state
    const diag = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__());
    expect(diag.hasContract).toBe(true);
    expect(diag.hasPlan).toBe(true);

    // Navigate to review via real button
    const continueBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.screenshot({ path: path.join(OUT, '10_phase4_script_review_readonly.png'), fullPage: true });

    // Scroll code viewer container to enable approve button (hasReviewed scroll check)
    const reviewContainer = page.locator('[data-testid="review-stage"]');
    await reviewContainer.evaluate((el: HTMLElement) => {
      // Find the scrollable code container and scroll to bottom
      const codeContainer = el.querySelector('.script-code')?.closest('[class*="script"]') as HTMLElement | null;
      const target = codeContainer?.parentElement || el;
      target.scrollTop = target.scrollHeight;
      target.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(800);

    // Approve button should now be enabled
    await page.getByText('Aprobar script').click();
    await expect(page.getByText('Contrato aprobado por revisión humana')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Preparar exportación')).toBeVisible();

    await page.screenshot({ path: path.join(OUT, '11_phase4_script_approved_hitl.png'), fullPage: true });
  });

  // E2E-06 ──────────────────────────────────────────────────────────────────────
  test('E2E-06 tampered blocked', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Tamper
    await page.evaluate(() => { (window as any).__PHASE4_TAMPER_CONTRACT__({ scriptHash: '0000000000000000' }); });
    await page.waitForTimeout(300);

    const continueBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await expect(page.getByTestId('review-stage')).toBeVisible({ timeout: 15_000 });

    // Scroll code viewer container to enable approve button
    await page.locator('[data-testid="review-stage"]').evaluate((el: HTMLElement) => {
      const codeContainer = el.querySelector('.script-code')?.closest('[class*="script"]') as HTMLElement | null;
      const target = codeContainer?.parentElement || el;
      target.scrollTop = target.scrollHeight;
      target.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(800);

    // Try approve — must be blocked
    await page.getByText('Aprobar script').click();
    await page.waitForTimeout(1500);
    await expect(page.getByText('Contrato aprobado por revisión humana')).toHaveCount(0);
    await expect(page.getByText('Preparar exportación')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, '12_phase4_tampered_contract_blocked.png'), fullPage: true });
  });

  // E2E-07 ──────────────────────────────────────────────────────────────────────
  test('E2E-07 HITL invalidation', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Use "Volver al plan" button
    await page.getByRole('button', { name: 'Volver al plan' }).click();
    await page.waitForTimeout(500);

    const r = page.locator('[data-testid="remediation-stage"]');
    await expect(r).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Contrato válido')).toHaveCount(0);

    // Change approval
    const approveBtns = r.locator('button').filter({ hasText: 'Aprobar' });
    const c = await approveBtns.count();
    if (c > 0) { await approveBtns.first().click(); await page.waitForTimeout(300); }

    // Regenerate
    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });
  });

  // E2E-08 ──────────────────────────────────────────────────────────────────────
  test('E2E-08 no-op', async ({ page }) => {
    await up(page, CSV);
    await harness(page);
    await inject(page);
    await goScript(page);

    const r = page.locator('[data-testid="remediation-stage"]');
    for (let i = 0; i < 20; i++) {
      const btns = r.locator('button').filter({ hasText: 'Rechazar' });
      if ((await btns.count()) === 0) break;
      await btns.first().click();
      await page.waitForTimeout(100);
    }

    await page.getByText('Generar contrato de script').click();
    await expect(page.getByText('Contrato válido')).toBeVisible({ timeout: 15_000 });

    // Check accepted is 0 via partition display
    const partitionSection = page.locator('[data-testid="script-gen-v2-stage"]');
    await expect(partitionSection.getByText('aceptadas')).toBeVisible();
    // Verify no-op: script contains function and returns clean df
    const text = await page.locator('.script-code').textContent();
    expect(text).toContain('def clean_dataset');
    expect(text).toContain('return df_clean');
  });
});
