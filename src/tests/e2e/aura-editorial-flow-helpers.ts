import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { expect, type Page } from '@playwright/test';
import { buildPhase4TitanicFixture } from './harness/Phase4EvidenceHarness';
import { sha256BytesHex, sha256hex } from '../../contracts/llm/hash';
import { buildExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import type { DiagnosisInputPackageV2 } from '../../contracts/llm/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const RUNNER = path.resolve(PROJECT_ROOT, 'experiments/runners/run-aura-remediation.mjs');
export const L10_CSV = path.resolve(__dirname, './fixtures/aura_l10_full_flow_issues.csv');

export const PRESERVATION_CSV = [
  'PassengerId,Survived,Pclass,Name,Sex,Age,SibSp,Parch,Ticket,Fare,Cabin,Embarked',
  '001,0,3," Braund, Mr. Owen Harris ",male,22,1,0,A/5 21171,120.00,,S',
  '002,1,1," Cumings, Mrs. John Bradley ",female,38,1,0,PC 17599,71.2833,C85,C',
].join('\n') + '\n';

const OBSERVED_MODEL = 'test-model';
const RAW_RESPONSE = JSON.stringify({ diagnosis: { status: 'completed' } });

export type UploadTarget = string | {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

export interface ExecutionArtifacts {
  tempDir: string;
  correctedPath: string;
  receiptPath: string;
  correctedBytes: Buffer;
  receiptText: string;
  receipt: Record<string, any>;
}

export async function openAudit(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.sys-nav').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Empezar auditoría/i }).click();
  await expect(page.locator('[data-testid="csv-file-input"]')).toBeAttached({ timeout: 10_000 });
}

export async function uploadAuditFile(page: Page, target: UploadTarget): Promise<void> {
  await openAudit(page);
  await page.locator('[data-testid="csv-file-input"]').setInputFiles(target);
  await expect(page.locator('.profile-editorial-header').first()).toBeVisible({ timeout: 30_000 });
}

export async function setPipelineState(page: Page, state: string): Promise<void> {
  await page.evaluate((nextState) => {
    (window as any).__PHASE4_SET_STATE__(nextState);
  }, state);
  await page.waitForTimeout(700);
}

function buildCanonicalExecutionReceipt(evidenceEnvelopeRef: string): {
  inputSnapshot: DiagnosisInputPackageV2;
  exactPrompt: string;
  receipt: ReturnType<typeof buildExecutionReceiptV1>;
} {
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

  const exactPrompt = exactDiagnosisPromptV2(inputSnapshot);
  inputSnapshot.promptHash = sha256hex(exactPrompt);
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

  return { inputSnapshot, exactPrompt, receipt };
}

export async function injectPhase4Diagnosis(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as any).__PHASE4_INJECT__ === 'function',
    { timeout: 15_000 },
  );
  const fingerprint: string | null = await page.evaluate(
    () => (window as any).__PHASE4_GET_STATE__?.().fingerprint ?? null,
  );
  expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);

  const { diagnosis, plan } = buildPhase4TitanicFixture(fingerprint!);
  const { inputSnapshot, exactPrompt, receipt } = buildCanonicalExecutionReceipt(diagnosis.evidenceEnvelopeRef);
  const patchedDiagnosis = {
    ...diagnosis,
    rawResponseHash: receipt.rawResponseHash,
    rawResponse: RAW_RESPONSE,
    inputMode: 'prompt_libre',
    inputHash: inputSnapshot.inputHash,
    promptHash: inputSnapshot.promptHash,
    metrics: { ...diagnosis.metrics, model: OBSERVED_MODEL },
    inputSnapshot,
    executionReceipt: receipt,
    remediationContext: {
      ...diagnosis.remediationContext,
      inputReceiptRef: receipt.receiptHash,
    },
  };
  const patchedPlan = {
    ...plan,
    inputReceiptRef: receipt.receiptHash,
  };

  await page.evaluate(([nextDiagnosis, nextPlan]) => {
    (window as any).__PHASE4_INJECT__(nextDiagnosis, nextPlan, {
      analysisText: 'Diagnóstico controlado para verificación Editorial.',
    });
  }, [patchedDiagnosis, patchedPlan]);
  await page.waitForTimeout(1_000);
}

export async function moveFromReportToExecution(page: Page): Promise<void> {
  await page.getByTestId('diagnostic-report-generate-script-top').click();
  await page.locator('[data-testid="remediation-stage"]').waitFor({ state: 'visible', timeout: 15_000 });

  const approveAction = page.locator('[data-testid="remediation-stage"]')
    .locator('.remediation-action').first()
    .getByRole('button', { name: 'Aprobar', exact: true });
  if (await approveAction.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await approveAction.click();
  }

  await page.getByRole('button', { name: /Generar contrato de script/i }).click();
  await page.getByTestId('contract-hash').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: /Continuar a revisión/i }).click();
  await page.getByTestId('review-stage').waitFor({ state: 'visible', timeout: 15_000 });

  await page.evaluate(() => {
    const script = document.querySelector('.script-scroll');
    if (script) {
      script.scrollTop = script.scrollHeight;
      script.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  });
  await page.getByRole('button', { name: /Aprobar script/i }).click();
  await page.getByRole('button', { name: /Preparar exportación/i }).click();
  await page.getByTestId('apply-verify-step').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function prepareExternalExecution(page: Page, sourceBytes: Buffer): Promise<ExecutionArtifacts> {
  await page.getByTestId('apply-verify-prepare').click();
  await page.getByTestId('apply-verify-ready').waitFor({ state: 'visible', timeout: 15_000 });
  const bundleJson = await page.locator('[data-execution-bundle-json]').getAttribute('data-execution-bundle-json');
  expect(bundleJson).toBeTruthy();

  const tempDir = mkdtempSync(path.join(tmpdir(), 'aura-editorial-flow-'));
  const bundlePath = path.join(tempDir, 'execution-bundle.json');
  const sourcePath = path.join(tempDir, 'source.csv');
  const correctedPath = path.join(tempDir, 'corrected.csv');
  const receiptPath = path.join(tempDir, 'receipt.json');
  writeFileSync(bundlePath, bundleJson!, 'utf8');
  writeFileSync(sourcePath, sourceBytes);

  execFileSync('node', [
    RUNNER,
    '--bundle', bundlePath,
    '--input', sourcePath,
    '--output', correctedPath,
    '--receipt', receiptPath,
  ], { cwd: tempDir, timeout: 30_000, encoding: 'utf8' });

  expect(existsSync(correctedPath)).toBe(true);
  expect(existsSync(receiptPath)).toBe(true);
  const correctedBytes = readFileSync(correctedPath);
  const receiptText = readFileSync(receiptPath, 'utf8');
  const receipt = JSON.parse(receiptText);
  expect(receipt.execution.status).toBe('passed');
  expect(receipt.syntax.status).toBe('passed');

  return { tempDir, correctedPath, receiptPath, correctedBytes, receiptText, receipt };
}

export async function submitExternalExecution(page: Page, artifacts: ExecutionArtifacts, receiptPath = artifacts.receiptPath): Promise<void> {

  await page.getByTestId('apply-verify-await-files').click();
  await page.setInputFiles('[data-testid="apply-verify-after-file"]', artifacts.correctedPath);
  await page.setInputFiles('[data-testid="apply-verify-receipt-file"]', receiptPath);
  await page.getByTestId('apply-verify-validate').click();
}

export async function runExternalExecution(page: Page, sourceBytes: Buffer): Promise<ExecutionArtifacts> {
  const artifacts = await prepareExternalExecution(page, sourceBytes);
  await submitExternalExecution(page, artifacts);
  await page.getByTestId('apply-verify-verified').waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByTestId('apply-verify-reaudit-summary').waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByTestId('apply-verify-continue').click();
  await page.getByTestId('export-stage').waitFor({ state: 'visible', timeout: 15_000 });

  return artifacts;
}

export async function downloadEvidencePackage(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByTestId('export-download-evidence-package').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  expect(downloadPath).toBeTruthy();
  return downloadPath!;
}
