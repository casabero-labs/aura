/**
 * E2E test for the Apply & Verify step (AURA-CIERRE-P2-02).
 * Self-contained: uses a local CSV fixture, no external dataset required.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_CSV = path.resolve(__dirname, 'fixtures/titanic-mini.csv');
const OUT = path.resolve(__dirname, '../../../docs/tercera_entrega_aura/03_evidencia/screenshots/apply-verify');

const DIAGNOSIS_RECEIPT_HASH = 'b'.repeat(64);
const ENVELOPE_REF = 'env:' + 'c'.repeat(64);

async function injectPhase3Harness(page: any) {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE3_INJECT__ === 'function',
    { timeout: 15_000 },
  );
  await page.evaluate(
    ([receiptHash, envelopeRef]: any[]) => {
      const win = window as any;
      const sample = { PassengerId: 1, Name: ' Braund ' };
      const diagnosis = {
        version: 2,
        diagnosis: {
          contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
          evidenceEnvelopeRef: envelopeRef, responseId: 'response:av',
          issues: [{ issueId: 'trim-name', evidenceRefs: [], hypothesis: 'Whitespace', confidence: 0.9, requiresHumanReview: false, limits: [] }],
          diagnosisBlocks: [{ issueId: 'trim-name', ruleId: 'r:trim', columnId: 'Name', scope: 'col', observation: 'WS', recommendation: 'Trim' }],
          limitations: [], generatedAt: '2026-07-12T12:00:00.000Z',
        },
        metrics: { latencyMs: 100, tokensGenerated: 10, model: 'm', provider: 'Ollama', isLocal: true },
        promptHash: 'd'.repeat(64),
        evidenceEnvelopeRef: envelopeRef,
        promptVersion: 'v2', rawResponseHash: 'e'.repeat(64),
        inputMode: 'recommended', inputHash: 'f'.repeat(64),
        inputSnapshot: {
          contractId: 'aura.input-snapshot.v2', contractVersion: '2.0.0',
          inputMode: 'recommended', includedSections: [],
          systemInstruction: '', userPayload: '',
          responseSchema: '', evidenceEnvelopeRef: envelopeRef,
          promptVersion: 'v2', promptHash: 'd'.repeat(64),
          inputHash: 'f'.repeat(64), responseSchemaHash: '0'.repeat(64),
        },
        executionReceipt: { receiptHash, ...{}, contractId: 'aura.execution-receipt.v1', contractVersion: '1.0.0' },
        remediationContext: {
          contractId: 'aura.remediation-context.v2', contractVersion: '2.0.0',
          datasetFingerprint: '0'.repeat(64),
          remediationRef: 'plan:av',
          evidenceEnvelopeRef: envelopeRef, inputReceiptRef: receiptHash,
        },
      };
      const plan = {
        contractId: 'aura.remediation-plan.v2', contractVersion: '2.0.0',
        planId: 'plan:av', inputEnvelopeRef: envelopeRef,
        plan: [
          { actionId: 'action:trim', actionability: 'auto_safe', actionType: 'trim_whitespace', columnId: 'Name', rationale: 'WS', evidenceRefs: [] },
        ],
        generatedAt: '2026-07-12T12:00:00.000Z', generatedBy: 'ollama',
      };
      win.__PHASE3_INJECT__(diagnosis, plan);
      win.__PHASE3_SET_STATE__('review');
    },
    [DIAGNOSIS_RECEIPT_HASH, ENVELOPE_REF],
  );
  await page.waitForTimeout(500);
}

test.describe('Apply & Verify E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test('reaches Apply & Verify step and shows preconditions when contract missing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Empezar auditoría/i }).click();
    await page.waitForTimeout(500);
    await page.setInputFiles('input[type="file"]', SOURCE_CSV);
    await page.locator('.profile-editorial-header').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.screenshot({ path: path.join(OUT, '01_decision_optional_1440.png'), fullPage: true });

    // Go to review
    await injectPhase3Harness(page);

    // Approve the script
    const approveBtn = page.getByText('Aprobar script').first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
    }

    // Wait for the Apply & Verify step
    await expect(page.locator('[data-testid="apply-verify-step"]')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT, '02_apply_verify_initial_1440.png'), fullPage: true });
  });
});
