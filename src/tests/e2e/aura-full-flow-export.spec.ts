/**
 * Phase 10 L10B — E2E Playwright Full-Flow CSV → Export 2.0 (real file input)
 *
 * Tests the complete visible flow from CSV upload via the real file input
 * through to technical export 2.0, using a synthetic fixture CSV.
 *
 * What is REAL (not mocked, not harness):
 * - CSV file: loaded via page.setInputFiles on the real hidden <input> (data-testid="csv-file-input")
 * - File selection: the browser's native file input change event
 * - Upload handler: processFile() on MainPipeline — real async parseCsv + runAudit
 * - React state: auditEvidence, report, rawData are real (from actual CSV processing)
 * - buildEvidenceManifest + buildAuraExportPackage: real functions called by harness
 *
 * Harness usage (after real upload completes):
 * - __L9_GET_STATE__ — reads React state via refs (always fresh, survives StrictMode remounts)
 * - __L9_GET_EXPORT_JSON__ — builds export JSON from current React state via refs
 *
 * Harness bypasses: AI diagnosis, calibration benchmark, script generation.
 * Harness does NOT replace: file upload, CSV parsing, audit execution.
 *
 * Key fix from L10/L10A:
 *   L10 used __L9_PROCESS_CSV__ which bypassed the real file input.
 *   L10A stored export JSON in window to survive StrictMode remounts.
 *   L10B adds refs for auditEvidence/report/structuredDiagnosis so harness
 *   always reads FRESH state values, not stale closures from the initial mount.
 *   With refs, setInputFiles → real processFile → state updates → refs update
 *   on every render → harness reads current values. Works WITH StrictMode.
 *
 * Evidence artifacts:
 *   docs/product/aura/phase_10/l10_evidence/evidence.json
 *   docs/product/aura/phase_10/l10_evidence/screenshots/
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/product/aura/phase_10/l10_evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');
const FIXTURE_CSV = path.resolve(__dirname, './fixtures/aura_l10_full_flow_issues.csv');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FIXTURE_CSV_CONTENT = fs.readFileSync(FIXTURE_CSV, 'utf8');
const FIXTURE_LINES = FIXTURE_CSV_CONTENT.trim().split('\n');
const FIXTURE_ROWS = FIXTURE_LINES.length - 1;
const FIXTURE_HEADER_FIELDS = FIXTURE_LINES[0].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) ?? [];
const FIXTURE_COLUMNS = FIXTURE_HEADER_FIELDS.length;
const FIXTURE_NAME = 'aura_l10_full_flow_issues.csv';

async function bootToAudit(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
}

async function waitForPipelineState(page: any, targetState: string, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const current = await page.evaluate(() => (window as any).__PHASE4_GET_STATE__?.()?.pipelineState);
    if (current === targetState) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function waitForHarness(page: any) {
  await page.waitForFunction(
    () =>
      typeof (window as any).__L9_GET_EXPORT_JSON__ === 'function' &&
      typeof (window as any).__PHASE4_GET_STATE__ === 'function' &&
      typeof (window as any).__L9_GET_STATE__ === 'function',
    { timeout: 20_000 }
  );
  await page.waitForTimeout(200);
}

async function waitForReportState(page: any, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => (window as any).__L9_GET_STATE__?.() ?? null);
    if (state?.hasReport && state?.rowCount > 0) return state;
    await page.waitForTimeout(300);
  }
  return null;
}

test.describe('Phase 10 L10B — Full-Flow CSV → Export v2.0 (real file input)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('L10B-01: real CSV file input → upload → parseCsv → runAudit → export 2.0', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Boot to audit
    await bootToAudit(page);

    // 2. Verify file input is present in DOM with data-testid
    await expect(page.locator('[data-testid="csv-file-input"]')).toBeAttached({ timeout: 10_000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_upload_step_ready.png'),
      fullPage: true,
    });

    // 3. Use setInputFiles on the real hidden file input
    // This triggers the browser's native change event → handleChange → acceptFile → processFile
    // processFile is the real async handler that calls parseCsv + runAudit and sets React state.
    await page.locator('[data-testid="csv-file-input"]').setInputFiles(FIXTURE_CSV);
    console.log('setInputFiles done');

    // 4. Wait for real profile state via __PHASE4_GET_STATE__ (ref-based, survives StrictMode)
    const profileReached = await waitForPipelineState(page, 'profile', 25_000);
    expect(profileReached, 'Pipeline should reach profile state after CSV file input').toBe(true);
    console.log('Profile state reached');

    // 5. Verify real report state via __L9_GET_STATE__ (now reads from refs — always fresh)
    const reportState = await waitForReportState(page, 20_000);
    expect(reportState, 'Report state should be populated after real file upload').not.toBeNull();
    expect(reportState?.rowsProcessed, `rowsProcessed should be ${FIXTURE_ROWS}, got ${reportState?.rowsProcessed}`).toBe(FIXTURE_ROWS);
    expect(reportState?.columnsProcessed, `columnsProcessed should be ${FIXTURE_COLUMNS}, got ${reportState?.columnsProcessed}`).toBe(FIXTURE_COLUMNS);
    expect(reportState?.rowCount, `rowCount should be ${FIXTURE_ROWS}, got ${reportState?.rowCount}`).toBe(FIXTURE_ROWS);
    expect(reportState?.colCount, `colCount should be ${FIXTURE_COLUMNS}, got ${reportState?.colCount}`).toBe(FIXTURE_COLUMNS);
    console.log('Real report state verified:', reportState);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_profile_ready_real_csv.png'),
      fullPage: true,
    });

    // 6. Get export JSON from harness (built from current React state via refs)
    await waitForHarness(page);
    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });
    expect(exportJson, 'Export JSON should be available after real file upload').not.toBeNull();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_export_generated.png'),
      fullPage: true,
    });

    // 7. Validations
    const nameOk = exportJson.exportContract?.name === 'aura-technical-export';
    const versionOk = exportJson.exportContract?.version === '2.0';
    const calibrationOk = exportJson.calibrationEvidence != null;
    const experimentOk = exportJson.experiment == null;
    const canonicalBlocks = exportJson.exportContract?.canonicalBlocks ?? [];
    const hasCalibrationCanonical = canonicalBlocks.includes('calibrationEvidence');
    const deprecatedBlocks = exportJson.exportContract?.deprecatedBlocks ?? [];
    const hasMigration = deprecatedBlocks.some(
      (d: any) => d.from === 'experiment' && d.to === 'calibrationEvidence'
    );
    const compatibilityOk = exportJson.exportContract?.compatibility?.legacyAliasIncluded === false;

    // Real data from CSV upload
    const manifest = exportJson.manifest;
    const manifestRowsOk = manifest?.dataset?.rows === FIXTURE_ROWS;
    const manifestColsOk = manifest?.dataset?.columns === FIXTURE_COLUMNS;
    const profileReport = exportJson.profile?.report;
    const reportRowCountOk = profileReport?.rowCount === FIXTURE_ROWS;
    const reportColCountOk = profileReport?.colCount === FIXTURE_COLUMNS;

    expect(nameOk, `exportContract.name should be 'aura-technical-export', got '${exportJson.exportContract?.name}'`).toBe(true);
    expect(versionOk, `exportContract.version should be '2.0', got '${exportJson.exportContract?.version}'`).toBe(true);
    expect(calibrationOk, 'calibrationEvidence should exist at root').toBe(true);
    expect(experimentOk, 'experiment block should NOT exist at root').toBe(true);
    expect(hasCalibrationCanonical, `calibrationEvidence should be in canonicalBlocks, got ${JSON.stringify(canonicalBlocks)}`).toBe(true);
    expect(hasMigration, `experiment→calibrationEvidence migration should be declared, got ${JSON.stringify(deprecatedBlocks)}`).toBe(true);
    expect(compatibilityOk, 'legacyAliasIncluded should be false').toBe(true);
    expect(manifestRowsOk, `manifest.dataset.rows should be ${FIXTURE_ROWS}, got ${manifest?.dataset?.rows}`).toBe(true);
    expect(manifestColsOk, `manifest.dataset.columns should be ${FIXTURE_COLUMNS}, got ${manifest?.dataset?.columns}`).toBe(true);
    expect(reportRowCountOk, `profile.report.rowCount should be ${FIXTURE_ROWS}, got ${profileReport?.rowCount}`).toBe(true);
    expect(reportColCountOk, `profile.report.colCount should be ${FIXTURE_COLUMNS}, got ${profileReport?.colCount}`).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_contract_validated.png'),
      fullPage: true,
    });

    // 8. Build evidence.json with L10B semantics
    const allPassed = nameOk && versionOk && calibrationOk && experimentOk && hasCalibrationCanonical && hasMigration && compatibilityOk && manifestRowsOk && manifestColsOk && reportRowCountOk && reportColCountOk;

    const evidence = {
      testRun: {
        timestamp: new Date().toISOString(),
        phase: 'L10B',
        testId: 'L10B-01',
        fixture: FIXTURE_NAME,
        dataset: `${FIXTURE_NAME} (rows=${FIXTURE_ROWS}, cols=${FIXTURE_COLUMNS})`,
        harness: 'L9/Phase4 E2E Harness (reads state via refs; used only after real file input)',
        csvLoadedViaUi: true,
        fileInputInteraction: 'setInputFiles',
        harnessProcessedCsv: false,
        providerMode: 'real',
      },
      fixtureProvenance: {
        fixtureRead: true,
        fixtureName: FIXTURE_NAME,
        fixtureRows: FIXTURE_ROWS,
        fixtureColumns: FIXTURE_COLUMNS,
        fixtureDelimiter: ',',
      },
      validations: {
        csv_loaded_via_file_input: { passed: true },
        real_profile_state_reached: { passed: profileReached },
        exportContract_name_correct: { passed: nameOk, expected: 'aura-technical-export', actual: exportJson.exportContract?.name },
        exportContract_version_correct: { passed: versionOk, expected: '2.0', actual: exportJson.exportContract?.version },
        calibrationEvidence_exists: { passed: calibrationOk, actual: calibrationOk ? 'present' : 'absent' },
        experiment_block_absent: { passed: experimentOk, actual: experimentOk ? 'absent' : 'present' },
        calibrationEvidence_canonical: { passed: hasCalibrationCanonical, actual: canonicalBlocks },
        deprecated_migration_declared: { passed: hasMigration, actual: deprecatedBlocks },
        legacyAlias_notIncluded: { passed: compatibilityOk, actual: exportJson.exportContract?.compatibility?.legacyAliasIncluded },
        manifest_dataset_rows_correct: { passed: manifestRowsOk, expected: FIXTURE_ROWS, actual: manifest?.dataset?.rows },
        manifest_dataset_columns_correct: { passed: manifestColsOk, expected: FIXTURE_COLUMNS, actual: manifest?.dataset?.columns },
        profile_rowCount_correct: { passed: reportRowCountOk, expected: FIXTURE_ROWS, actual: profileReport?.rowCount },
        profile_colCount_correct: { passed: reportColCountOk, expected: FIXTURE_COLUMNS, actual: profileReport?.colCount },
      },
      exportContract: exportJson.exportContract,
      calibrationEvidence: exportJson.calibrationEvidence,
      manifest: exportJson.manifest,
      profile: exportJson.profile,
      screenshots: {
        uploadStepReady: '01_upload_step_ready.png',
        profileReadyRealCsv: '02_profile_ready_real_csv.png',
        exportGenerated: '03_export_generated.png',
        contractValidated: '04_contract_validated.png',
      },
      allPassed,
    };

    fs.writeFileSync(path.join(EVIDENCE_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2));

    if (errors.length > 0) console.warn('Console errors:', errors);
    expect(allPassed, `allPassed should be true. Validations: ${JSON.stringify(evidence.validations)}`).toBe(true);
  });
});
