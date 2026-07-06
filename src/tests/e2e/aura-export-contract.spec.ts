/**
 * Phase 10 L9 — E2E Playwright Export Contract Evidence
 *
 * Validates in a real Chromium browser that the technical export
 * (`aura-technical-export` v2.0) produces the correct contract structure:
 * - exportContract.name === 'aura-technical-export'
 * - exportContract.version === '2.0'
 * - calibrationEvidence block exists at root
 * - experiment block does NOT exist at root
 *
 * Uses synthetic dataset and E2E harness (no real AI provider, no model download).
 *
 * Evidence artifacts:
 *   test-results/aura-l9-evidence/evidence.json
 *   test-results/aura-l9-evidence/screenshots/
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../../../test-results/aura-l9-evidence');
const SCREENSHOT_DIR = path.resolve(EVIDENCE_DIR, 'screenshots');

const fs = await import('node:fs');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function bootToAudit(page: any) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await page.waitForTimeout(500);
}

async function waitForHarness(page: any) {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE4_INJECT__ === 'function' &&
           typeof (window as any).__L9_SET_REPORT__ === 'function' &&
           typeof (window as any).__L9_GET_EXPORT_JSON__ === 'function',
    { timeout: 20_000 }
  );
}

async function injectMinimalDiagnosis(page: any, envId: string) {
  await page.evaluate((id: string) => {
    const diagnosis = {
      version: 2,
      diagnosis: {
        contractId: 'aura.diagnosis.v2',
        contractVersion: '2.0.0',
        evidenceEnvelopeRef: `env:${id}`,
        responseId: `diag-${id}`,
        issues: [],
        diagnosisBlocks: [],
        limitations: [],
        generatedAt: new Date().toISOString(),
      },
      metrics: { latencyMs: 0, tokensGenerated: 0, model: 'e2e-harness', provider: 'fixture', isLocal: true },
      promptHash: `harness-${id}`,
      evidenceEnvelopeRef: `env:${id}`,
      promptVersion: '2.0.0',
      rawResponseHash: `harness-${id}`,
      remediationContext: {
        evidenceEnvelopeRef: `env:${id}`,
        datasetFingerprint: `l9-control-fingerprint-0001`,
        columns: [],
        issues: [],
      },
    };
    (window as any).__PHASE4_INJECT__(diagnosis, null);
  }, envId);
}

async function setFakeReport(page: any) {
  await page.evaluate(() => {
    const fakeReport = {
      score: 88,
      rowCount: 5,
      colCount: 4,
      duplicateRows: 0,
      issues: [],
      columnStats: {},
      scoreBreakdown: [],
      delimiterDetected: ',',
    };
    (window as any).__L9_SET_REPORT__(fakeReport);
  });
}

test.describe('Phase 10 L9 — Export Contract v2.0 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('L9-01: export contract name is aura-technical-export', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await bootToAudit(page);
    await waitForHarness(page);
    await injectMinimalDiagnosis(page, 'l9-e2e-001');
    await setFakeReport(page);
    await page.waitForTimeout(500);

    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });

    expect(exportJson.exportContract?.name).toBe('aura-technical-export');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_l9_export_name_validated.png'),
      fullPage: true,
    });

    if (errors.length > 0) console.warn('Console errors:', errors);
  });

  test('L9-02: export contract version is 2.0', async ({ page }) => {
    await bootToAudit(page);
    await waitForHarness(page);
    await injectMinimalDiagnosis(page, 'l9-e2e-002');
    await setFakeReport(page);
    await page.waitForTimeout(500);

    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });

    expect(exportJson.exportContract?.version).toBe('2.0');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_l9_version_validated.png'),
      fullPage: true,
    });
  });

  test('L9-03: calibrationEvidence block exists at root', async ({ page }) => {
    await bootToAudit(page);
    await waitForHarness(page);
    await injectMinimalDiagnosis(page, 'l9-e2e-003');
    await setFakeReport(page);
    await page.waitForTimeout(500);

    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });

    expect(exportJson).toHaveProperty('calibrationEvidence');
    expect(exportJson.calibrationEvidence).toHaveProperty('classification', 'experimental');
    expect(exportJson.calibrationEvidence).toHaveProperty('summary');
    expect(exportJson.calibrationEvidence).toHaveProperty('results');
    expect(exportJson.calibrationEvidence).toHaveProperty('improvementRun');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_l9_calibration_evidence_validated.png'),
      fullPage: true,
    });
  });

  test('L9-04: experiment block does NOT exist at root', async ({ page }) => {
    await bootToAudit(page);
    await waitForHarness(page);
    await injectMinimalDiagnosis(page, 'l9-e2e-004');
    await setFakeReport(page);
    await page.waitForTimeout(500);

    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });

    expect(exportJson).not.toHaveProperty('experiment');
    expect(Object.keys(exportJson)).not.toContain('experiment');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_l9_no_experiment_validated.png'),
      fullPage: true,
    });
  });

  test('L9-05: generate evidence.json with all contract validations', async ({ page }) => {
    await bootToAudit(page);
    await waitForHarness(page);
    await injectMinimalDiagnosis(page, 'l9-e2e-005');
    await setFakeReport(page);
    await page.waitForTimeout(500);

    const exportJson = await page.evaluate(() => {
      return (window as any).__L9_GET_EXPORT_JSON__();
    });

    const nameOk = exportJson.exportContract?.name === 'aura-technical-export';
    const versionOk = exportJson.exportContract?.version === '2.0';
    const calibrationOk = exportJson.calibrationEvidence != null;
    const experimentOk = exportJson.experiment == null;
    const canonicalBlocks = exportJson.exportContract?.canonicalBlocks;
    const hasCalibrationCanonical = canonicalBlocks?.includes('calibrationEvidence');
    const deprecatedBlocks = exportJson.exportContract?.deprecatedBlocks ?? [];
    const hasMigration = deprecatedBlocks.some(
      (b: any) => b.from === 'experiment' && b.to === 'calibrationEvidence'
    );
    const compatibilityOk = exportJson.exportContract?.compatibility?.legacyAliasIncluded === false;

    const evidence = {
      testRun: {
        timestamp: new Date().toISOString(),
        phase: 'L9',
        dataset: 'synthetic (harness-injected)',
        harness: 'Phase4/Phase10 E2E Harness',
      },
      validations: {
        exportContract_name_correct: { passed: nameOk, expected: 'aura-technical-export', actual: exportJson.exportContract?.name },
        exportContract_version_correct: { passed: versionOk, expected: '2.0', actual: exportJson.exportContract?.version },
        calibrationEvidence_exists: { passed: calibrationOk, actual: calibrationOk ? 'present' : 'missing' },
        experiment_block_absent: { passed: experimentOk, actual: experimentOk ? 'absent' : 'present' },
        calibrationEvidence_canonical: { passed: hasCalibrationCanonical, actual: canonicalBlocks },
        deprecated_migration_declared: { passed: hasMigration, actual: deprecatedBlocks },
        legacyAlias_notIncluded: { passed: compatibilityOk, actual: exportJson.exportContract?.compatibility?.legacyAliasIncluded },
      },
      exportContract: {
        name: exportJson.exportContract?.name,
        version: exportJson.exportContract?.version,
        canonicalBlocks: exportJson.exportContract?.canonicalBlocks,
        deprecatedBlocks: exportJson.exportContract?.deprecatedBlocks,
        compatibility: exportJson.exportContract?.compatibility,
      },
      calibrationEvidence: {
        classification: exportJson.calibrationEvidence?.classification,
        summaryStatus: exportJson.calibrationEvidence?.summary?.status,
        resultsCount: exportJson.calibrationEvidence?.results?.length ?? 0,
      },
      allPassed: nameOk && versionOk && calibrationOk && experimentOk && hasCalibrationCanonical && hasMigration && compatibilityOk,
    };

    const evidencePath = path.resolve(EVIDENCE_DIR, 'evidence.json');
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05_l9_evidence_complete.png'),
      fullPage: true,
    });

    expect(evidence.allPassed).toBe(true);
    expect(fs.existsSync(evidencePath)).toBe(true);
  });
});
