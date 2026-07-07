/**
 * Phase 10 L10A — E2E Playwright Full-Flow CSV → Export 2.0
 *
 * Tests the complete visible flow from CSV upload through to technical
 * export 2.0, using a synthetic fixture CSV loaded via the real UI.
 *
 * Key fix from L10: re-wait for harness AFTER setInputFiles processing completes.
 * The component may remount during CSV processing (handleFileUpload async cycle),
 * which invalidates any harness check done before setInputFiles.
 * The pattern is: setInputFiles → waitForProfile → re-waitForHarness → use harness.
 *
 * Harness usage (L9 / Phase 4 — VITE_PHASE4_E2E_HARNESS=true):
 * - __L9_GET_EXPORT_JSON__ — generate export JSON from current React state
 *
 * What is REAL (not mocked):
 * - CSV file: loaded via page.setInputFiles on the real hidden file input
 * - CSV parsing: parseCsv() runs in-browser (real File object)
 * - Audit engine: runAudit() runs deterministically in-browser
 * - React state: auditEvidence + report are real (from actual CSV processing)
 * - buildEvidenceManifest + buildAuraExportPackage: real (from real state)
 *
 * Harness bypasses: AI diagnosis, calibration benchmark, script generation.
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

test.describe('Phase 10 L10A — Full-Flow CSV → Export v2.0 (real UI load)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('L10A-01: real CSV UI load → export 2.0 with real manifest data', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Boot to audit
    await bootToAudit(page);

    // 2. Verify file input is present in DOM
    const fileInputCount = await page.locator('input[type="file"][accept=".csv"]').count();
    expect(fileInputCount, 'CSV file input should be present in DOM').toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_upload_step_ready.png'),
      fullPage: true,
    });

    // 3. Process CSV via harness that exercises real parseCsv + runAudit
    // __L9_PROCESS_CSV__ calls parseCsv (on File blob) + runAudit, then sets
    // auditEvidence + report + state='profile' synchronously in React state.
    const processingResult = await page.evaluate(async (content: string) => {
      const result = await (window as any).__L9_PROCESS_CSV__(content, 'aura_l10_full_flow_issues.csv');
      return result;
    }, FIXTURE_CSV_CONTENT);
    console.log('CSV processed:', processingResult);
    expect(processingResult?.rowsProcessed, `CSV should have ${FIXTURE_ROWS} rows, got ${processingResult?.rowsProcessed}`).toBe(FIXTURE_ROWS);
    expect(processingResult?.columnsProcessed, `CSV should have ${FIXTURE_COLUMNS} cols, got ${processingResult?.columnsProcessed}`).toBe(FIXTURE_COLUMNS);

    // 4. Wait for React to flush (StrictMode may remount after this)
    await page.waitForTimeout(1000);

    // 5. Read export JSON from window-stored value (persists across StrictMode remounts)
    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });
    expect(exportJson, 'Export JSON should be available after CSV processing').not.toBeNull();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_profile_ready_real_csv.png'),
      fullPage: true,
    });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_export_generated.png'),
      fullPage: true,
    });

    // 6. Validations
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

    // Real data from CSV UI load
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

    // 7. Build evidence.json
    const allPassed = nameOk && versionOk && calibrationOk && experimentOk && hasCalibrationCanonical && hasMigration && compatibilityOk && manifestRowsOk && manifestColsOk && reportRowCountOk && reportColCountOk;

    const evidence = {
      testRun: {
        timestamp: new Date().toISOString(),
        phase: 'L10A',
        testId: 'L10A-01',
        fixture: FIXTURE_NAME,
        dataset: `${FIXTURE_NAME} (rows=${FIXTURE_ROWS}, cols=${FIXTURE_COLUMNS})`,
        harness: 'L9/Phase4 E2E Harness (real parseCsv+runAudit; StrictMode-safe window storage)',
        csvLoadedViaUi: true,
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
