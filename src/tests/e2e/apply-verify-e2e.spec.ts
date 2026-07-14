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
 *   9. Download ZIP and verify artefacts
 *   10. Second test: tampered receipt → invalid state
 *   11. Third test: overflow check at all apply-verify states
 *
 * Screenshots captured at 5 key states × 2 viewports = 10 images.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';
import { sha256BytesHex, sha256hex } from '../../contracts/llm/hash';
import { buildExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import type { DiagnosisInputPackageV2 } from '../../contracts/llm/types';

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

const OBSERVED_MODEL = 'test-model';
const RAW_RESPONSE = JSON.stringify({ diagnosis: { status: 'completed' } });

function buildCanonicalExecutionReceipt(evidenceEnvelopeRef: string): {
  inputSnapshot: DiagnosisInputPackageV2;
  exactPrompt: string;
  inputHash: string;
  receipt: ReturnType<typeof buildExecutionReceiptV1>;
} {
  // Stage 1: build input without computed hashes
  const inputSnapshot: DiagnosisInputPackageV2 = {
    contractId: 'aura.input-snapshot.v2',
    contractVersion: '2.0.0',
    inputMode: 'prompt_libre',
    includedSections: ['profile'],
    systemInstruction: '',
    userPayload: 'E2E fixed test payload',
    responseSchema: {},
    evidenceEnvelopeRef,
    promptVersion: '2.0.0',
    promptHash: '',
    responseSchemaHash: sha256hex(canonicalJson({})),
    inputHash: '',
  };

  // Stage 2: compute exactPrompt, set promptHash
  const exactPrompt = exactDiagnosisPromptV2(inputSnapshot);
  inputSnapshot.promptHash = sha256hex(exactPrompt);

  // Stage 3: compute stableInput for inputHash
  const stableInput = {
    contractId: inputSnapshot.contractId,
    contractVersion: inputSnapshot.contractVersion,
    inputMode: inputSnapshot.inputMode,
    includedSections: inputSnapshot.includedSections,
    systemInstruction: inputSnapshot.systemInstruction,
    userPayload: inputSnapshot.userPayload,
    responseSchema: inputSnapshot.responseSchema,
    evidenceEnvelopeRef: inputSnapshot.evidenceEnvelopeRef,
    promptVersion: inputSnapshot.promptVersion,
    promptHash: inputSnapshot.promptHash,
    responseSchemaHash: inputSnapshot.responseSchemaHash,
  };
  inputSnapshot.inputHash = sha256hex(canonicalJson(stableInput));

  // Stage 4: build receipt
  const receipt = buildExecutionReceiptV1({
    input: inputSnapshot,
    requestedInputMode: 'prompt_libre',
    exactPrompt,
    provider: 'fixture',
    requestedModel: OBSERVED_MODEL,
    observedModel: OBSERVED_MODEL,
    inference: {
      temperature: 0,
      topP: 0,
      think: false as const,
      numCtx: 2048,
      numPredict: 1024,
      seed: null,
      keepAlive: '5m',
      timeoutSeconds: 60,
    },
    startedAt: '2026-07-13T00:00:00.000Z',
    completedAt: '2026-07-13T00:00:01.000Z',
    rawResponse: RAW_RESPONSE,
    validationStatus: 'valid',
  });

  return { inputSnapshot, exactPrompt, inputHash: inputSnapshot.inputHash, receipt };
}

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

  const { inputSnapshot, exactPrompt, inputHash, receipt } = buildCanonicalExecutionReceipt(diag.evidenceEnvelopeRef);

  const diagPatched = {
    ...diag,
    // Fields validated against receipt
    rawResponseHash: receipt.rawResponseHash,
    rawResponse: RAW_RESPONSE,
    inputMode: 'prompt_libre',
    inputHash,
    promptHash: inputSnapshot.promptHash,
    // Override metrics.model to match observedModel
    metrics: {
      ...diag.metrics,
      model: OBSERVED_MODEL,
    },
    inputSnapshot,
    executionReceipt: receipt,
    remediationContext: {
      ...diag.remediationContext,
      inputReceiptRef: receipt.receiptHash,
    },
  };

  const planPatched = {
    ...planData,
    inputReceiptRef: receipt.receiptHash,
  };

  await page.evaluate(([d, p]: any[]) => {
    (window as any).__PHASE4_INJECT__(d, p, { analysisText: 'Diagnóstico E2E — Titanic mini' });
  }, [diagPatched, planPatched]);
  await page.waitForTimeout(1500);
}

test.describe('Apply & Verify E2E', () => {
  test('full flow: upload → script → review → execution → runner → verified → export → ZIP', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => { console.log('PAGE_CRASH:', err.message); errors.push(err); });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE_ERR:', msg.text());
    });

    // ── 1. Upload CSV ──────────────────────────────────────────────────
    await uploadCsv(page, SOURCE_CSV);

    // ── SCREENSHOT 01 ──────────────────────────────────────────────────
    await setPipelineState(page, 'diagnosis');
    await injectDiagnosis(page);
    await setPipelineState(page, 'diagnostic_report');
    await page.locator('[data-testid="diagnostic-report-stage"]').waitFor({ state: 'visible', timeout: 10_000 });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `01_decision_optional_${vp.suffix}.png`), fullPage: true });
    }

    // ── 2. Script stage ───────────────────────────────────────────────
    await setPipelineState(page, 'script');
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="remediation-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    const approveActionBtn = page.locator('[data-testid="remediation-stage"]')
      .locator('.remediation-action').first()
      .locator('button', { hasText: 'Aprobar' });
    if (await approveActionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveActionBtn.click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: /Generar contrato de script/i }).click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="contract-hash"]').waitFor({ state: 'visible', timeout: 30_000 });

    // not_run accepted by the gate — no tamper needed
    const contBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click();
    } else {
      await setPipelineState(page, 'review');
    }
    await page.waitForTimeout(1000);

    // ── 3. Review: scroll script fully → approve (no force) ──────────
    await page.locator('[data-testid="review-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

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
    await approveBtn.click();
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /Preparar exportación/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(1000);

    // ── 4. ApplyVerifyStep ────────────────────────────────────────────
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('[data-testid="apply-verify-prepare"]').click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-ready"]').waitFor({ state: 'visible', timeout: 15_000 });

    // ── SCREENSHOT 02 ─────────────────────────────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `02_prepare_ready_${vp.suffix}.png`), fullPage: true });
    }

    // ── 5. Extract bundle + run real Node runner ──────────────────────
    const bundleJson: string = await page.evaluate(() => {
      const el = document.querySelector('[data-execution-bundle-json]');
      if (!el) throw new Error('data-execution-bundle-json not found');
      return el.getAttribute('data-execution-bundle-json') || '';
    });
    expect(JSON.parse(bundleJson).bundleHash).toBeTruthy();

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
    expect(receipt.syntax.status).toBe('passed');

    // ── 6. Upload outputs ─────────────────────────────────────────────
    await page.locator('[data-testid="apply-verify-await-files"]').click();
    await page.waitForTimeout(500);

    // ── SCREENSHOT 03 ─────────────────────────────────────────────────
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

    await page.locator('[data-testid="apply-verify-validate"]').click();

    // ── 7. Assert verified ────────────────────────────────────────────
    await page.locator('[data-testid="apply-verify-verified"]').waitFor({ state: 'visible', timeout: 20_000 });
    await expect(page.locator('.apply-verify-info-grid').first()).toBeVisible();

    // ── SCREENSHOT 04 ─────────────────────────────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `04_verified_${vp.suffix}.png`), fullPage: true });
    }

    // ── 8. Reaudit ────────────────────────────────────────────────────
    await page.locator('[data-testid="apply-verify-reaudit-summary"]').waitFor({ state: 'visible', timeout: 20_000 });
    await expect(page.getByTestId('reaudit-before-score')).toBeVisible();
    await expect(page.getByTestId('reaudit-after-score')).toBeVisible();

    await page.locator('[data-testid="apply-verify-continue"]').click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="export-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    // ── 9. Download and verify evidence ZIP ──────────────────────────
    const capturedWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') capturedWarnings.push(msg.text());
    });
    await page.locator('[data-testid="export-download-evidence-package"]').click();
    await page.waitForTimeout(2000);
    const preflightWarning = capturedWarnings.find(w => w.includes('evidence-package.preflight'));
    if (preflightWarning) {
      // Log the exact preflight errors and fail the test
      console.log('PREFLIGHT ERRORS:', preflightWarning);
      throw new Error(`Export preflight failed: ${preflightWarning}`);
    }
    // No preflight error shown; wait for the download event
    const [zipDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.locator('[data-testid="export-download-evidence-package"]').click(),
    ]);
    const zipPath = await zipDownload.path();
    console.log('ZIP downloaded:', zipDownload.suggestedFilename(), zipPath);
    expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/);
    expect(existsSync(zipPath)).toBe(true);

    const zipTmp = mkdtempSync(path.join(tmpdir(), 'av-zip-'));
    execSync(`unzip -o "${zipPath}" -d "${zipTmp}"`, { encoding: 'utf-8', timeout: 10_000 });

    const expectedFiles = [
      'remediation/approved-script.py',
      'execution/execution-bundle.json',
      'execution/receipt.json',
      'execution/corrected.csv',
      'execution/reaudit-result.json',
      'execution/before-after-summary.json',
    ];
    for (const f of expectedFiles) {
      const fullPath = path.join(zipTmp, f);
      expect(existsSync(fullPath)).toBe(true);
      expect(readFileSync(fullPath).length).toBeGreaterThan(0);
    }

    // manifest.json
    const manifestPath = path.join(zipTmp, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.privacy.correctedDatasetIncluded).toBe(true);
    expect(manifest.privacy.correctedDatasetMayContainPersonalData).toBe(true);

    // files is an array
    expect(Array.isArray(manifest.files)).toBe(true);
    for (const entry of manifest.files) {
      expect(typeof entry.path).toBe('string');
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof entry.bytes).toBe('number');
      const artifactPath = path.join(zipTmp, entry.path);
      if (existsSync(artifactPath)) {
        const actualBytes = readFileSync(artifactPath);
        expect(sha256BytesHex(new Uint8Array(actualBytes))).toBe(entry.sha256);
        expect(actualBytes.byteLength).toBe(entry.bytes);
      }
    }

    // source.csv must NOT be present
    expect(existsSync(path.join(zipTmp, 'execution/source.csv'))).toBe(false);
    // reaudit-result.json must not contain rawCsv / beforeOutput / afterOutput
    const reauditResult = JSON.parse(readFileSync(path.join(zipTmp, 'execution/reaudit-result.json'), 'utf-8'));
    expect(reauditResult).not.toHaveProperty('rawCsv');
    expect(reauditResult).not.toHaveProperty('beforeOutput');
    expect(reauditResult).not.toHaveProperty('afterOutput');
  });

  // ─────────────────────────────────────────────────────────────────────
  // TEST 2: Invalid state with tampered receipt (no pythonSyntax tamper)
  // ─────────────────────────────────────────────────────────────────────
  test('invalid state with tampered receipt', async ({ page }) => {
    await uploadCsv(page, SOURCE_CSV);
    await setPipelineState(page, 'diagnosis');
    await injectDiagnosis(page);
    await setPipelineState(page, 'script');

    await page.locator('[data-testid="remediation-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

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

    const contBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click();
    } else {
      await setPipelineState(page, 'review');
    }
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="review-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    await page.evaluate(() => {
      const el = document.querySelector('.script-scroll');
      if (el) { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })); }
    });
    await page.waitForTimeout(500);
    const scriptApproveBtn = page.getByRole('button', { name: /Aprobar script/i });
    await scriptApproveBtn.click();
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /Preparar exportación/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('[data-testid="apply-verify-prepare"]').click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-ready"]').waitFor({ state: 'visible', timeout: 15_000 });

    const bundleJson: string = await page.evaluate(() => {
      const el = document.querySelector('[data-execution-bundle-json]');
      return el?.getAttribute('data-execution-bundle-json') || '';
    });
    const bundle = JSON.parse(bundleJson);

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

    // ── SCREENSHOT 05 ─────────────────────────────────────────────────
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

    const contBtn = page.getByRole('button', { name: /Continuar a revisión/i });
    if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contBtn.click();
    } else {
      await setPipelineState(page, 'review');
    }
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="review-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

    await page.evaluate(() => {
      const el = document.querySelector('.script-scroll');
      if (el) { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })); }
    });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Aprobar script/i }).click();
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /Preparar exportación/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Preparar exportación/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="apply-verify-step"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.setViewportSize({ width: 390, height: 844 }).catch(() => {});
    await page.waitForTimeout(300);

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
