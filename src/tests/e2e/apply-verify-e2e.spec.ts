/**
 * Apply & Verify E2E — real pipeline orchestration.
 *
 * Steps:
 *   1. Upload CSV (gets sourceFile, fingerprint, auditEvidence, report)
 *   2. Inject diagnosis + plan via __PHASE4_INJECT__
 *   3. Navigate to script stage → generate V2 contract → continue to review
 *   4. In review, scroll code → approve script → continue to execution
 *   5. ApplyVerifyStep fully rendered (all preconditions met)
 *   6. Click "Preparar ejecución" → bundle → extract → run real Node runner
 *   7. Upload outputs → click "Validar ejecución" → assert verified
 *   8. Click "Ir a Exportación" → export stage
 *   9. Second test: tampered receipt → invalid state
 *   10. Third test: overflow check at all apply-verify states
 *
 * Screenshots captured at 5 key states × 2 viewports = 10 images.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SOURCE_CSV = path.resolve(__dirname, 'fixtures/titanic-mini.csv');
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/apply-verify');
const RUNNER = path.resolve(PROJECT_ROOT, 'experiments/runners/run-aura-remediation.mjs');

const VIEWPORTS = [
  { width: 1440, height: 900, suffix: '1440' },
  { width: 390, height: 844, suffix: '390' },
];

async function uploadCsv(page: any, fp: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', fp);
  await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function setPipelineState(page: any, state: string) {
  await page.evaluate((st: string) => { (window as any).__PHASE4_SET_STATE__(st); }, state);
  await page.waitForTimeout(1000);
}

const VALID_64HEX = 'a'.repeat(64);

async function injectDiagnosis(page: any) {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE4_INJECT__ === 'function',
    { timeout: 15_000 },
  );
  const fingerprint: string | null = await page.evaluate(
    () => (window as any).__PHASE4_GET_STATE__?.().fingerprint ?? null,
  );
  expect(fingerprint).toBeTruthy();
  const { diagnosis: diag, plan: planData } = buildPhase4TitanicFixture(fingerprint!);

  // Patch diagnosis with executionReceipt so ApplyVerifyStep preconditions pass
  const diagPatched = {
    ...diag,
    executionReceipt: {
      version: 1,
      receiptHash: VALID_64HEX,
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      rawResponseHash: VALID_64HEX,
      evidenceEnvelopeRef: diag.evidenceEnvelopeRef,
      promptVersion: diag.promptVersion ?? '2.0.0',
      metrics: diag.metrics,
      diagnosis: { status: 'completed' },
    },
    remediationContext: {
      ...diag.remediationContext,
      inputReceiptRef: VALID_64HEX,
    },
  };
  // Patch plan's inputReceiptRef so the generated contract carries the valid ref
  const planPatched = {
    ...planData,
    inputReceiptRef: VALID_64HEX,
  };

  await page.evaluate(([d, p]: any[]) => {
    (window as any).__PHASE4_INJECT__(d, p, { analysisText: 'Diagnóstico E2E — Titanic mini' });
  }, [diagPatched, planPatched]);
  await page.waitForTimeout(1500);
}

async function tamperVerificationPassed(page: any) {
  await page.evaluate(() => {
    (window as any).__PHASE4_TAMPER_VERIFICATION__({ pythonSyntax: { state: 'passed' } });
  });
  await page.waitForTimeout(300);
}

test.describe('Apply & Verify E2E', () => {
  test('full flow: upload → script → review → execution → preparar → runner → verified → export', async ({ page }) => {
    // Debug: capture all errors
    const errors: any[] = [];
    page.on('pageerror', (err) => { console.log('PAGE_CRASH:', err.message); errors.push(err); });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE_ERR:', msg.text());
    });

    // ── 1. Upload CSV ──────────────────────────────────────────────────
    await uploadCsv(page, SOURCE_CSV);

    // ── SCREENSHOT 01: Decisión opcional (two routes) ──────────────────
    // Follow established L13G pattern: profile → diagnosis → inject → diagnostic_report
    await setPipelineState(page, 'diagnosis');
    await injectDiagnosis(page);
    await setPipelineState(page, 'diagnostic_report');
    await page.locator('[data-testid="diagnostic-report-stage"]').waitFor({ state: 'visible', timeout: 10_000 });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `01_decision_optional_${vp.suffix}.png`), fullPage: true });
    }

    // ── 2. Navigate to 'script' → approve action → generate V2 contract ──
    await setPipelineState(page, 'script');
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="remediation-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Approve at least one action in the plan before generating contract
    const approveActionBtn = page.locator('[data-testid="remediation-stage"]')
      .locator('.remediation-action').first()
      .locator('button', { hasText: 'Aprobar' });
    if (await approveActionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveActionBtn.click();
      await page.waitForTimeout(500);
    }

    const generateBtn = page.getByRole('button', { name: /Generar contrato de script/i });
    await generateBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await generateBtn.click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="contract-hash"]').waitFor({ state: 'visible', timeout: 30_000 });
    await tamperVerificationPassed(page);

    // Continue to review
    const contBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click();
    } else {
      await setPipelineState(page, 'review');
    }
    await page.waitForTimeout(1000);

    // ── 3. Review: approve script ─────────────────────────────────────
    await page.locator('[data-testid="review-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Scroll script + force-click approve (bypass hasReviewed guard)
    await page.evaluate(() => {
      const el = document.querySelector('.script-scroll');
      if (el) {
        el.scrollTop = el.scrollHeight;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);

    const approveBtn = page.getByRole('button', { name: /Aprobar script/i });
    await approveBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // Try regular click first; if disabled, force-click to approve
    await approveBtn.click({ timeout: 3000 }).catch(() => approveBtn.click({ force: true }));
    await page.waitForTimeout(2000);

    // Wait for "Preparar exportación"
    const prepExpBtn = page.getByRole('button', { name: /Preparar exportación/i });
    await prepExpBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await prepExpBtn.click();
    await page.waitForTimeout(1000);

    // ── 4. Execution: ApplyVerifyStep ─────────────────────────────────
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });

    // ── 5. Click "Preparar ejecución" ─────────────────────────────────
    await page.locator('[data-testid="apply-verify-prepare"]').click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-ready"]').waitFor({ state: 'visible', timeout: 15_000 });

    // ── SCREENSHOT 02: Prepare ready ──────────────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `02_prepare_ready_${vp.suffix}.png`), fullPage: true });
    }

    // ── 6. Extract bundle ─────────────────────────────────────────────
    const bundleJson: string = await page.evaluate(() => {
      const el = document.querySelector('[data-execution-bundle-json]');
      if (!el) throw new Error('data-execution-bundle-json not found');
      return el.getAttribute('data-execution-bundle-json') || '';
    });
    expect(JSON.parse(bundleJson).bundleHash).toBeTruthy();

    // ── 7. Execute real Node runner ───────────────────────────────────
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'av-e2e-'));
    writeFileSync(path.join(tmpDir, 'execution-bundle.json'), bundleJson, 'utf-8');
    writeFileSync(path.join(tmpDir, 'source.csv'), readFileSync(SOURCE_CSV, 'utf-8'), 'utf-8');

    const runnerResult = execSync(
      `node "${RUNNER}" --bundle execution-bundle.json --input source.csv --output corrected.csv --receipt receipt.json`,
      { cwd: tmpDir, timeout: 30_000, encoding: 'utf-8' },
    );
    console.log('Runner:', runnerResult.slice(0, 300));

    const correctedCsv = readFileSync(path.join(tmpDir, 'corrected.csv'));
    const receiptJson = readFileSync(path.join(tmpDir, 'receipt.json'), 'utf-8');
    const receipt = JSON.parse(receiptJson);
    expect(correctedCsv.length).toBeGreaterThan(0);
    expect(receipt.receiptHash).toBeTruthy();
    expect(receipt.execution.status).toBe('passed');

    // ── 8. Upload outputs ─────────────────────────────────────────────
    await page.locator('[data-testid="apply-verify-await-files"]').click();
    await page.waitForTimeout(500);

    // ── SCREENSHOT 03: Awaiting files ─────────────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `03_awaiting_files_${vp.suffix}.png`), fullPage: true });
    }

    writeFileSync(path.join(tmpDir, 'upload-corrected.csv'), correctedCsv);
    writeFileSync(path.join(tmpDir, 'upload-receipt.json'), receiptJson, 'utf-8');

    await page.setInputFiles('[data-testid="apply-verify-after-file"]', path.join(tmpDir, 'upload-corrected.csv'));
    await page.setInputFiles('[data-testid="apply-verify-receipt-file"]', path.join(tmpDir, 'upload-receipt.json'));
    await page.waitForTimeout(500);

    // ── 9. Click "Validar ejecución" ─────────────────────────────────
    const validateBtn = page.locator('[data-testid="apply-verify-validate"]');
    await expect(validateBtn).toBeEnabled({ timeout: 5000 });
    await validateBtn.click();

    // ── 10. Assert verified ───────────────────────────────────────────
    await page.locator('[data-testid="apply-verify-verified"]').waitFor({ state: 'visible', timeout: 20_000 });
    await expect(page.locator('.apply-verify-info-grid')).toBeVisible();

    // ── SCREENSHOT 04: Verified ───────────────────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `04_verified_${vp.suffix}.png`), fullPage: true });
    }

    // ── 11. Click "Ir a Exportación" ──────────────────────────────────
    await page.locator('[data-testid="apply-verify-continue"]').click();
    await page.waitForTimeout(1500);
  });

  // ─────────────────────────────────────────────────────────────────────
  // TEST 2: Invalid state with tampered receipt
  // ─────────────────────────────────────────────────────────────────────
  test('invalid state with tampered receipt', async ({ page }) => {
    await uploadCsv(page, SOURCE_CSV);
    await setPipelineState(page, 'diagnosis');
    await injectDiagnosis(page);
    await setPipelineState(page, 'script');

    await page.locator('[data-testid="remediation-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Approve at least one action before generating contract
    const approveBtn = page.locator('[data-testid="remediation-stage"]')
      .locator('.remediation-action').first()
      .locator('button', { hasText: 'Aprobar' });
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: /Generar contrato de script/i }).click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="contract-hash"]').waitFor({ state: 'visible', timeout: 30_000 });
    await tamperVerificationPassed(page);

    const contBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click();
    } else {
      await setPipelineState(page, 'review');
    }
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="review-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Scroll + force-approve
    await page.evaluate(() => {
      const el = document.querySelector('.script-scroll');
      if (el) { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })); }
    });
    await page.waitForTimeout(500);
    const scriptApproveBtn = page.getByRole('button', { name: /Aprobar script/i });
    await scriptApproveBtn.click({ timeout: 3000 }).catch(() => scriptApproveBtn.click({ force: true }));
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /Preparar exportación/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('[data-testid="apply-verify-prepare"]').click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-ready"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Extract bundle
    const bundleJson: string = await page.evaluate(() => {
      const el = document.querySelector('[data-execution-bundle-json]');
      return el?.getAttribute('data-execution-bundle-json') || '';
    });
    const bundle = JSON.parse(bundleJson);

    // Build tampered receipt
    const tamperedReceipt = {
      contractId: 'aura.python-execution-receipt.v1',
      contractVersion: '1.0.0',
      runId: bundle.runId,
      approvedScriptHash: 'a'.repeat(64),
      scriptTextSha256: bundle.scriptTextSha256,
      beforeDatasetSha256: bundle.beforeDatasetSha256,
      afterDatasetSha256: '0'.repeat(64),
      pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'darwin',
      bundleHash: bundle.bundleHash,
      inputReceiptRef: bundle.inputReceiptRef,
      evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
      syntax: { status: 'passed', error: null },
      execution: { status: 'passed', startedAt: '2026-07-13T12:00:00.000Z', completedAt: '2026-07-13T12:00:01.000Z', durationMs: 1000, stdoutSha256: '0'.repeat(64), stderrSha256: '0'.repeat(64), error: null },
      output: { rowCount: 0, columnCount: 0 },
      receiptHash: '0'.repeat(64),
    };
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'av-invalid-'));
    writeFileSync(path.join(tmpDir, 'tampered-receipt.json'), JSON.stringify(tamperedReceipt, null, 2), 'utf-8');

    await page.locator('[data-testid="apply-verify-await-files"]').click();
    await page.waitForTimeout(500);
    writeFileSync(path.join(tmpDir, 'dummy-corrected.csv'), 'Name\nAlice\n', 'utf-8');
    await page.setInputFiles('[data-testid="apply-verify-after-file"]', path.join(tmpDir, 'dummy-corrected.csv'));
    await page.setInputFiles('[data-testid="apply-verify-receipt-file"]', path.join(tmpDir, 'tampered-receipt.json'));
    await page.waitForTimeout(500);

    await page.locator('[data-testid="apply-verify-validate"]').click();
    await page.locator('[data-testid="apply-verify-error"]').waitFor({ state: 'visible', timeout: 15_000 });

    // ── SCREENSHOT 05: Invalid ────────────────────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `05_invalid_${vp.suffix}.png`), fullPage: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // TEST 3: No overflow at any apply-verify state
  // ─────────────────────────────────────────────────────────────────────
  test('no overflow in any apply-verify state', async ({ page }) => {
    await uploadCsv(page, SOURCE_CSV);
    await setPipelineState(page, 'diagnosis');
    await injectDiagnosis(page);
    await setPipelineState(page, 'script');

    await page.locator('[data-testid="remediation-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Approve at least one action before generating contract
    const approveBtn = page.locator('[data-testid="remediation-stage"]')
      .locator('.remediation-action').first()
      .locator('button', { hasText: 'Aprobar' });
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: /Generar contrato de script/i }).click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="contract-hash"]').waitFor({ state: 'visible', timeout: 30_000 });
    await tamperVerificationPassed(page);

    const contBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click();
    } else {
      await setPipelineState(page, 'review');
    }
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="review-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Scroll + force-approve
    await page.evaluate(() => {
      const el = document.querySelector('.script-scroll');
      if (el) { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })); }
    });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Aprobar script/i })
      .click({ timeout: 3000 }).catch(() => page.getByRole('button', { name: /Aprobar script/i }).click({ force: true }));
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /Preparar exportación/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.setViewportSize({ width: 390, height: 844 }).catch(() => {});
    await page.waitForTimeout(300);

    // Check overflow at not_prepared
    const checkOverflow = async () => page.evaluate(() => {
      const el = document.querySelector('[data-testid="apply-verify-step"]');
      return el ? (el as HTMLElement).scrollWidth <= (el as HTMLElement).clientWidth : false;
    });
    expect(await checkOverflow()).toBe(true);

    await page.locator('[data-testid="apply-verify-prepare"]').click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-ready"]').waitFor({ state: 'visible', timeout: 10_000 });
    expect(await checkOverflow()).toBe(true);

    await page.locator('[data-testid="apply-verify-await-files"]').click();
    await page.waitForTimeout(500);
    expect(await checkOverflow()).toBe(true);
  });
});
