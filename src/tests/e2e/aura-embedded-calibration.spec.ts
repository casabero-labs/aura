/**
 * Phase 10 L11 — E2E Playwright Embedded Calibration Pipeline
 *
 * Tests two paths through the calibration opt-in step in the main pipeline:
 *
 * L11-01 (normal path): profile → calibration opt-in → continue without
 *   calibration → export 2.0. Validates calibrationEvidence.status='none'.
 *
 * L11-02 (embedded path): profile → calibration opt-in → activate experimental
 *   comparison → embedded panel visible → inject benchmark result →
 *   continue without running AI → export 2.0. Validates calibrationEvidence
 *   has preliminary result and no formal benchmark claim.
 *
 * What is REAL:
 * - CSV file input via page.setInputFiles on [data-testid="csv-file-input"]
 * - File selection: browser's native change event
 * - Upload handler: processFile() — real parseCsv + runAudit
 * - React state: auditEvidence, report from real CSV processing
 * - Calibration opt-in UI rendering (CalibrationOptInExplainer)
 * - Embedded calibration panel UI rendering (CalibrationEmbeddedPanel)
 *
 * Harness usage (after real upload, for calibration result + export):
 * - __L9_SET_BENCHMARK_RESULTS__ — injects mock benchmark result
 *   (avoids real AI provider dependency)
 * - __L9_GET_EXPORT_JSON__ — builds export JSON from current React state via refs
 *
 * Harness does NOT replace: file upload, CSV parsing, audit execution,
 * calibration opt-in visibility, embedded panel visibility.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/product/aura/phase_10/l11_evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');
const FIXTURE_CSV = path.resolve(__dirname, './fixtures/aura_l11_calibration_flow.csv');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FIXTURE_CSV_CONTENT = fs.readFileSync(FIXTURE_CSV, 'utf8');
const FIXTURE_LINES = FIXTURE_CSV_CONTENT.trim().split('\n');
const FIXTURE_ROWS = FIXTURE_LINES.length - 1;
const FIXTURE_HEADER_FIELDS = FIXTURE_LINES[0].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) ?? [];
const FIXTURE_COLUMNS = FIXTURE_HEADER_FIELDS.length;
const FIXTURE_NAME = 'aura_l11_calibration_flow.csv';

async function bootToAudit(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
}

async function uploadCsvAndWaitForProfile(page: any) {
  await expect(page.locator('[data-testid="csv-file-input"]')).toBeAttached({ timeout: 10_000 });
  await page.locator('[data-testid="csv-file-input"]').setInputFiles(FIXTURE_CSV);
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const current = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState);
    if (current === 'profile') return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function waitForHarness(page: any) {
  await page.waitForFunction(
    () =>
      typeof (window as any).__L9_GET_EXPORT_JSON__ === 'function' &&
      typeof (window as any).__L9_SET_BENCHMARK_RESULTS__ === 'function',
    { timeout: 20_000 }
  );
  await page.waitForTimeout(200);
}

test.describe('Phase 10 L11 — Embedded Calibration Pipeline E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    page.on('console', msg => {
      if (msg.type() === 'error') console.warn('Console error:', msg.text());
    });
  });

  test('L11-01: normal path — continue without calibration → export 2.0', async ({ page }) => {
    // 1. Boot to audit
    await bootToAudit(page);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_upload_step_ready.png'),
      fullPage: true,
    });

    // 2. Upload CSV via real file input
    const profileReached = await uploadCsvAndWaitForProfile(page);
    expect(profileReached, 'Profile state should be reached after CSV upload').toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_profile_reached.png'),
      fullPage: true,
    });

    // 3. Click "Generar diagnóstico" → navigate to calibration state
    await page.getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(500);

    // 4. Verify calibration opt-in explainer is visible
    await expect(page.locator('[data-testid="calibration-opt-in-explainer"]')).toBeVisible({ timeout: 10_000 });
    // Verify the opt-in shows the main flow reminder (calibration is optional)
    await expect(page.locator('[data-testid="calibration-main-flow-reminder"]')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_calibration_opt_in_visible.png'),
      fullPage: true,
    });

    // 5. Click "Continuar diagnóstico normal" to bypass calibration
    await page.getByRole('button', { name: /Continuar diagnóstico normal/i }).click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_continue_normal_path.png'),
      fullPage: true,
    });

    // 6. Read export JSON via harness (built from refs with real upload data)
    await waitForHarness(page);
    const exportJson = await page.evaluate(() => (window as any).__L9_GET_EXPORT_JSON__());
    expect(exportJson, 'Export JSON should be available after upload + calibration opt-in').not.toBeNull();

    // 7. Validate contract structure
    expect(exportJson.exportContract?.name, 'exportContract.name should be aura-technical-export').toBe('aura-technical-export');
    expect(exportJson.exportContract?.version, 'exportContract.version should be 2.0').toBe('2.0');
    expect(exportJson.calibrationEvidence != null, 'calibrationEvidence should exist at root').toBe(true);
    expect(exportJson.experiment == null, 'experiment block should NOT exist at root').toBe(true);

    // 8. Validate calibration evidence status = 'none' (no calibration run)
    const calibrationSummary = exportJson.calibrationEvidence?.summary;
    expect(calibrationSummary?.status, 'calibration status should be "none" when skipped').toBe('none');

    // 9. Validate manifest dataset counts from real CSV
    expect(exportJson.manifest?.dataset?.rows, `manifest.dataset.rows should be ${FIXTURE_ROWS}`).toBe(FIXTURE_ROWS);
    expect(exportJson.manifest?.dataset?.columns, `manifest.dataset.columns should be ${FIXTURE_COLUMNS}`).toBe(FIXTURE_COLUMNS);

    // 10. Validate profile reports from real audit
    expect(exportJson.profile?.report?.rowCount, `profile.report.rowCount should be ${FIXTURE_ROWS}`).toBe(FIXTURE_ROWS);
    expect(exportJson.profile?.report?.colCount, `profile.report.colCount should be ${FIXTURE_COLUMNS}`).toBe(FIXTURE_COLUMNS);

    // 11. Validate contract compat + migration
    const canonicalBlocks = exportJson.exportContract?.canonicalBlocks ?? [];
    expect(canonicalBlocks).toContain('calibrationEvidence');
    const deprecatedBlocks = exportJson.exportContract?.deprecatedBlocks ?? [];
    expect(deprecatedBlocks.some((d: any) => d.from === 'experiment' && d.to === 'calibrationEvidence')).toBe(true);
    expect(exportJson.exportContract?.compatibility?.legacyAliasIncluded).toBe(false);
  });

  test('L11-02: embedded calibration path — activate comparison → export 2.0', async ({ page }) => {
    // 1. Boot to audit
    await bootToAudit(page);

    // 2. Upload CSV via real file input
    const profileReached = await uploadCsvAndWaitForProfile(page);
    expect(profileReached, 'Profile state should be reached after CSV upload').toBe(true);

    // 3. Click "Generar diagnóstico" → navigate to calibration state
    await page.getByRole('button', { name: /Generar diagnóstico/i }).click();
    await page.waitForTimeout(500);

    // 4. Verify calibration opt-in explainer is visible
    await expect(page.locator('[data-testid="calibration-opt-in-explainer"]')).toBeVisible({ timeout: 10_000 });

    // 5. Click "Activar comparación experimental"
    await page.getByRole('button', { name: /Activar comparación experimental/i }).click();
    await page.waitForTimeout(500);

    // 6. Verify CalibrationEmbeddedPanel is visible (not navigating to separate BenchmarkLab)
    await expect(page.locator('[data-testid="calibration-embedded-panel"]')).toBeVisible({ timeout: 10_000 });
    // Verify BenchmarkLab is NOT shown as main module anchor
    const benchmarkLabCount = await page.locator('[data-testid="benchmark-lab-anchor"]').count();
    expect(benchmarkLabCount, 'BenchmarkLab main module should NOT be rendered').toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05_embedded_calibration_panel.png'),
      fullPage: true,
    });

    // 7. Inject mock benchmark result via harness (avoids real AI provider)
    await waitForHarness(page);
    await page.evaluate(() => {
      (window as any).__L9_SET_BENCHMARK_RESULTS__([{
        id: 'l11-mock-benchmark',
        provider: 'e2e-harness',
        providerType: 'chrome',
        inputMode: 'smart_sample',
        model: 'test-model',
        temperature: 0.3,
        status: 'completed',
        latencyMs: 100,
        firstTokenMs: 50,
        tokensGenerated: 500,
        tokensPerSecond: 100,
        formatCompliance: true,
        pythonScriptIncluded: false,
        hallucinatedColumns: [],
        unsupportedClaims: 0,
        evidenceStatus: 'preliminary_valid',
        timestamp: new Date().toISOString(),
        score: 85,
        compositeScore: 85,
      }]);
    });
    await page.waitForTimeout(500);

    // 8. Click "Continuar diagnóstico normal" on embedded panel
    await page.getByRole('button', { name: /Continuar diagnóstico normal/i }).click();
    await page.waitForTimeout(500);

    // 9. Read export JSON via harness
    const exportJson = await page.evaluate(() => (window as any).__L9_GET_EXPORT_JSON__());
    expect(exportJson, 'Export JSON should be available after embedded calibration').not.toBeNull();
    console.log('Export debug:', {
      benchmarkCount: (exportJson.benchmarkResults ?? []).length,
      calStatus: exportJson.calibrationEvidence?.summary?.status,
      totalRuns: exportJson.calibrationEvidence?.summary?.totalRuns,
    });

    console.log('Export debug:', {
      benchmarkCount: (exportJson.calibrationEvidence?.results ?? []).length,
      calStatus: exportJson.calibrationEvidence?.summary?.status,
      totalRuns: exportJson.calibrationEvidence?.summary?.totalRuns,
    });

    // 10. Validate contract structure
    expect(exportJson.exportContract?.name, 'exportContract.name should be aura-technical-export').toBe('aura-technical-export');
    expect(exportJson.exportContract?.version, 'exportContract.version should be 2.0').toBe('2.0');
    expect(exportJson.calibrationEvidence != null, 'calibrationEvidence should exist at root').toBe(true);
    expect(exportJson.experiment == null, 'experiment block should NOT exist at root').toBe(true);

    // 11. Validate calibration evidence has results (preliminary)
    const calibrationSummary = exportJson.calibrationEvidence?.summary;
    expect(calibrationSummary?.status, 'calibration status should reflect attempted run').toBe('preliminary');
    expect(calibrationSummary?.totalRuns, 'totalRuns should be 1 after mock injection').toBe(1);

    // 12. Validate manifest dataset counts from real CSV
    expect(exportJson.manifest?.dataset?.rows, `manifest.dataset.rows should be ${FIXTURE_ROWS}`).toBe(FIXTURE_ROWS);
    expect(exportJson.manifest?.dataset?.columns, `manifest.dataset.columns should be ${FIXTURE_COLUMNS}`).toBe(FIXTURE_COLUMNS);

    // 13. Validate profile reports from real audit
    expect(exportJson.profile?.report?.rowCount, `profile.report.rowCount should be ${FIXTURE_ROWS}`).toBe(FIXTURE_ROWS);
    expect(exportJson.profile?.report?.colCount, `profile.report.colCount should be ${FIXTURE_COLUMNS}`).toBe(FIXTURE_COLUMNS);

    // 14. Validate benchmark results present in export (inside calibrationEvidence)
    const calibrationResults = exportJson.calibrationEvidence?.results ?? [];
    expect(calibrationResults.length, 'calibrationEvidence.results should have 1 entry').toBe(1);
    expect(calibrationResults[0].id, 'benchmark id should match injected').toBe('l11-mock-benchmark');
    expect(calibrationResults[0].evidenceStatus, 'evidenceStatus should be preliminary_valid').toBe('preliminary_valid');

    // 15. Validate contract compat + migration
    const canonicalBlocks = exportJson.exportContract?.canonicalBlocks ?? [];
    expect(canonicalBlocks).toContain('calibrationEvidence');
    const deprecatedBlocks = exportJson.exportContract?.deprecatedBlocks ?? [];
    expect(deprecatedBlocks.some((d: any) => d.from === 'experiment' && d.to === 'calibrationEvidence')).toBe(true);
    expect(exportJson.exportContract?.compatibility?.legacyAliasIncluded).toBe(false);

    // 16. Validate no prohibited claims in calibration summary
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06_export_contract_validated.png'),
      fullPage: true,
    });
    expect(exportJson.manifest?.allowedClaims?.calibrationEvidence, 'allowed claim should not claim formal (only preliminary)').toBe('preliminary');
  });
});
