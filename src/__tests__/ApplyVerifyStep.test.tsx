// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ApplyVerifyStep from '../components/ApplyVerifyStep';
import type { PythonExecutionReceiptV1, PythonExecutionBundleV1 } from '../services/remediationExecution/pythonExecutionContract';
import { buildPythonExecutionBundle, buildPythonExecutionReceipt } from '../services/remediationExecution/pythonExecutionContract';
import { sha256hex } from '../contracts/llm/hash';
import { computeScriptHashV2 } from '../contracts/llm/scriptBuilderV2';
import { buildVerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import type { VerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import type { ScriptContractV2 } from '../contracts/llm';
import type { AuditReport } from '../types';

const SCRIPT_TEXT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';
const canonicalScriptHash = (text: string) => sha256hex(JSON.stringify({ scriptText: text }));
const SCRIPT_HASH = canonicalScriptHash(SCRIPT_TEXT);
const BEFORE_CSV = 'Name\n Alice \n';
const AFTER_CSV = 'Name\nAlice\n';
const FINGERPRINT = sha256hex(BEFORE_CSV);
const DIAG_RECEIPT_HASH = 'b'.repeat(64);
const ENVELOPE_REF = 'env:' + 'c'.repeat(64);

const buildCanonicalContract = (): ScriptContractV2 => {
  const draft: ScriptContractV2 = {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    scriptText: SCRIPT_TEXT,
    scriptHash: '0'.repeat(64),
    acceptedActionIds: ['action:trim'],
    rejectedActionIds: [],
    excludedActionIds: [],
    columnRefs: [],
    cleanDatasetFn: 'clean_dataset',
    rendererVersion: '1.0.0',
    placeholderVocabularyVersion: '1.0.0',
    remediationRef: 'plan:test',
    datasetFingerprint: FINGERPRINT,
    generatedAt: '2026-07-12T12:00:00.000Z',
    inputReceiptRef: DIAG_RECEIPT_HASH,
    inputTrace: { envelopeRef: ENVELOPE_REF, fingerprint: FINGERPRINT, promptHash: 'd'.repeat(64) },
    validationResult: { pythonSyntax: { state: 'passed' } } as any,
  } as unknown as ScriptContractV2;
  draft.scriptHash = computeScriptHashV2(draft);
  return draft;
};

const buildCanonicalBundle = (): PythonExecutionBundleV1 => buildPythonExecutionBundle({
  generatedAt: '2026-07-12T12:05:00.000Z',
  executionId: 'run:verified',
  approvedScriptHash: SCRIPT_HASH,
  beforeDatasetSha256: FINGERPRINT,
  scriptText: SCRIPT_TEXT,
  scriptHashPayload: { scriptText: SCRIPT_TEXT },
  inputReceiptRef: DIAG_RECEIPT_HASH,
  evidenceEnvelopeRef: ENVELOPE_REF,
});

const makeReceipt = (bundle: PythonExecutionBundleV1, overrides: Partial<PythonExecutionReceiptV1> = {}): PythonExecutionReceiptV1 => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: bundle.runId,
  approvedScriptHash: bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256,
  afterDatasetSha256: sha256hex(AFTER_CSV),
  pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'darwin',
  bundleHash: bundle.bundleHash,
  inputReceiptRef: bundle.inputReceiptRef,
  evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed', startedAt: '2026-07-12T12:10:00.000Z', completedAt: '2026-07-12T12:10:01.000Z',
    durationMs: 1000, stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
  },
  output: { rowCount: 1, columnCount: 1 },
  ...overrides,
});

const sourceFile = new File([BEFORE_CSV], 'source.csv', { type: 'text/csv' });
const afterFile = new File([AFTER_CSV], 'corrected.csv', { type: 'text/csv' });

const defaultProps = {
  state: 'not_prepared' as const,
  report: null as unknown as AuditReport,
  sourceFile: null,
  sourceDatasetFingerprint: FINGERPRINT,
  onStateChange: vi.fn(),
  onReceiptChange: vi.fn(),
  onErrorChange: vi.fn(),
  onBundleJsonChange: vi.fn(),
  onAfterFileChange: vi.fn(),
  onSourceFileChange: vi.fn(),
  onVerifiedExecution: vi.fn(),
  onLog: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const fullVerif = { valid: true, pythonSyntax: { state: 'passed' as const } } as any;
const fullDiag = { executionReceipt: { receiptHash: DIAG_RECEIPT_HASH }, evidenceEnvelopeRef: ENVELOPE_REF } as any;

describe('ApplyVerifyStep R3', () => {
  describe('preconditions — strict format validation', () => {
    it('blocks when sourceDatasetFingerprint is not 64-hex', () => {
      render(<ApplyVerifyStep {...defaultProps} sourceDatasetFingerprint="bad" sourceFile={sourceFile} />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });

    it('blocks when evidenceEnvelopeRef is malformed', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={{ executionReceipt: { receiptHash: DIAG_RECEIPT_HASH }, evidenceEnvelopeRef: 'env:test' } as any}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });

    it('blocks when inputReceiptRef is malformed', () => {
      const badContract = buildCanonicalContract();
      (badContract as any).inputReceiptRef = 'not-hex';
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={badContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });

    it('blocks when verification.valid !== true', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={{ valid: false, pythonSyntax: { state: 'passed' } } as any}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });

    it('accepts pythonSyntax.state === passed → shows prepare', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={{ valid: true, pythonSyntax: { state: 'passed' } } as any}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
      />);
      expect(screen.getByTestId('apply-verify-prepare')).toBeTruthy();
    });

    it('accepts pythonSyntax.state === not_run → shows prepare', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={{ valid: true, pythonSyntax: { state: 'not_run' } } as any}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
      />);
      expect(screen.getByTestId('apply-verify-prepare')).toBeTruthy();
    });

    it('blocks pythonSyntax.state === failed', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={{ valid: true, pythonSyntax: { state: 'failed' } } as any}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });

    it('shows prepare button when all preconditions are met', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
      />);
      expect(screen.getByTestId('apply-verify-prepare')).toBeTruthy();
    });
  });

  describe('click Preparar emits canonical bundle', () => {
    it('captures onBundleJsonChange and revalidates with buildPythonExecutionBundle', async () => {
      const onBundleJsonChange = vi.fn();
      const onStateChange = vi.fn();
      render(<ApplyVerifyStep
        {...defaultProps}
        state="not_prepared"
        sourceFile={sourceFile}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
        onBundleJsonChange={onBundleJsonChange}
        onStateChange={onStateChange}
      />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-verify-prepare'));
      });

      expect(onBundleJsonChange).toHaveBeenCalled();
      const emittedJson = onBundleJsonChange.mock.calls[0][0];
      const parsed = JSON.parse(emittedJson);
      expect(parsed.contractId).toBe('aura.python-execution-bundle.v1');
      expect(parsed.scriptHashPayload.scriptText).toBe(SCRIPT_TEXT);
      expect(parsed.inputReceiptRef).toBe(DIAG_RECEIPT_HASH);
      expect(parsed.evidenceEnvelopeRef).toBe(ENVELOPE_REF);
      expect(parsed.beforeDatasetSha256).toBe(FINGERPRINT);

      // canonical guard: bundle must validate as a valid PythonExecutionBundleV1
      const { validatePythonExecutionBundle, parsePythonExecutionBundle } = await import('../services/remediationExecution/pythonExecutionContract');
      const errors = validatePythonExecutionBundle(parsePythonExecutionBundle(emittedJson));
      expect(errors).toEqual([]);
      expect(onStateChange).toHaveBeenCalledWith('ready');
    });
  });

  describe('re-selección real', () => {
    it('accepts correct file and calls onSourceFileChange; rejects tampered', async () => {
      const onSourceFileChange = vi.fn();
      const onErrorChange = vi.fn();
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={null}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
        onSourceFileChange={onSourceFileChange}
        onErrorChange={onErrorChange}
      />);

      const input = screen.getByTestId('apply-verify-reselect-source') as HTMLInputElement;

      const correctFile = new File([BEFORE_CSV], 'correct.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [correctFile], configurable: true });
      await act(async () => {
        fireEvent.change(input);
      });
      expect(onSourceFileChange).toHaveBeenCalledWith(correctFile);

      onSourceFileChange.mockClear();
      onErrorChange.mockClear();
      const tamperedFile = new File(['Name\n Eve \n'], 'tampered.csv', { type: 'text/csv' });
      Object.defineProperty(input, 'files', { value: [tamperedFile], configurable: true });
      await act(async () => {
        fireEvent.change(input);
      });
      expect(onSourceFileChange).not.toHaveBeenCalled();
      expect(onErrorChange).toHaveBeenCalledWith(expect.stringContaining('no coincide'));
    });
  });

  describe('validation chain', () => {
    it('valid chain → verified emits onVerifiedExecution with typed result', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle);
      const receiptJson = JSON.stringify(receipt);
      const receiptFile = new File([receiptJson], 'receipt.json', { type: 'application/json' });

      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        scriptContractV2={buildCanonicalContract()}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={fullDiag}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);

      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => {
        fireEvent.change(afterInput);
        fireEvent.change(receiptInput);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-verify-validate'));
      });

      expect(onVerifiedExecution).toHaveBeenCalledTimes(1);
      const result = onVerifiedExecution.mock.calls[0][0];
      expect(result.bundle.bundleHash).toBe(bundle.bundleHash);
      expect(result.receipt.receiptHash).toBe(receipt.receiptHash);
      expect(result.afterFile).toBe(afterFile);
      expect(onStateChange).toHaveBeenCalledWith('verified');
    });

    it('tampered bundleHash → invalid, no verified execution emitted', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const tamperedBundle = { ...bundle, bundleHash: 'z'.repeat(64) };
      const receipt = makeReceipt(bundle);
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });

      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(tamperedBundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);

      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => {
        fireEvent.change(afterInput);
        fireEvent.change(receiptInput);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-verify-validate'));
      });

      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered runId → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle, { runId: 'run:TAMPERED' });
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });

      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);

      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => {
        fireEvent.change(afterInput);
        fireEvent.change(receiptInput);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-verify-validate'));
      });

      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered afterCsv (output bytes) → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle);
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });
      const tamperedAfter = new File(['Name\nEve\n'], 'corrected.csv', { type: 'text/csv' });

      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);

      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [tamperedAfter], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => {
        fireEvent.change(afterInput);
        fireEvent.change(receiptInput);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-verify-validate'));
      });

      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered approvedScriptHash → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle, { approvedScriptHash: 'z'.repeat(64) });
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });
      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);
      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => { fireEvent.change(afterInput); fireEvent.change(receiptInput); });
      await act(async () => { fireEvent.click(screen.getByTestId('apply-verify-validate')); });
      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered scriptTextSha256 → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle, { scriptTextSha256: 'z'.repeat(64) });
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });
      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);
      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => { fireEvent.change(afterInput); fireEvent.change(receiptInput); });
      await act(async () => { fireEvent.click(screen.getByTestId('apply-verify-validate')); });
      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered beforeDatasetSha256 in receipt → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle, { beforeDatasetSha256: 'z'.repeat(64) });
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });
      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);
      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => { fireEvent.change(afterInput); fireEvent.change(receiptInput); });
      await act(async () => { fireEvent.click(screen.getByTestId('apply-verify-validate')); });
      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered inputReceiptRef → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle, { inputReceiptRef: 'z'.repeat(64) });
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });
      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);
      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => { fireEvent.change(afterInput); fireEvent.change(receiptInput); });
      await act(async () => { fireEvent.click(screen.getByTestId('apply-verify-validate')); });
      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });

    it('tampered evidenceEnvelopeRef → invalid', async () => {
      const onVerifiedExecution = vi.fn();
      const onStateChange = vi.fn();
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle, { evidenceEnvelopeRef: 'env:' + 'z'.repeat(64) });
      const receiptFile = new File([JSON.stringify(receipt)], 'receipt.json', { type: 'application/json' });
      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        executionBundleJson={JSON.stringify(bundle)}
        onVerifiedExecution={onVerifiedExecution}
        onStateChange={onStateChange}
      />);
      const afterInput = screen.getByTestId('apply-verify-after-file') as HTMLInputElement;
      const receiptInput = screen.getByTestId('apply-verify-receipt-file') as HTMLInputElement;
      Object.defineProperty(afterInput, 'files', { value: [afterFile], configurable: true });
      Object.defineProperty(receiptInput, 'files', { value: [receiptFile], configurable: true });
      await act(async () => { fireEvent.change(afterInput); fireEvent.change(receiptInput); });
      await act(async () => { fireEvent.click(screen.getByTestId('apply-verify-validate')); });
      expect(onVerifiedExecution).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('invalid');
    });
  });

  describe('download and copy', () => {
    it('download source.csv byte-equal to original File with forced name', async () => {
      const originalBytes = new Uint8Array([78, 97, 109, 101, 10, 65, 108, 105, 99, 101, 10]);
      const original = new File([originalBytes], 'controlled_customers_phase8.csv', { type: 'text/csv' });
      let capturedBlob: Blob | null = null;
      let capturedDownloadName = '';
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      const origClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = vi.fn((b: any) => { capturedBlob = b; return 'blob:test'; }) as any;
      URL.revokeObjectURL = vi.fn();
      HTMLAnchorElement.prototype.click = vi.fn(function(this: HTMLAnchorElement) { capturedDownloadName = this.download; });

      try {
        render(<ApplyVerifyStep
          {...defaultProps}
          state="ready"
          executionBundleJson={'{"contractId":"test"}'}
          sourceFile={original}
        />);
        fireEvent.click(screen.getByTestId('apply-verify-download-source'));
        expect(capturedDownloadName).toBe('source.csv');
        expect(capturedBlob).not.toBeNull();
        const blobBuf = new Uint8Array(await (capturedBlob as Blob).arrayBuffer());
        expect(blobBuf).toEqual(originalBytes);
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
        HTMLAnchorElement.prototype.click = origClick;
      }
    });

    it('copy command writes exact CLI string', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      render(<ApplyVerifyStep
        {...defaultProps}
        state="ready"
        executionBundleJson={'{"contractId":"test"}'}
        sourceFile={sourceFile}
      />);
      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-verify-copy-command'));
      });
      expect(writeText).toHaveBeenCalledWith('node experiments/runners/run-aura-remediation.mjs --bundle ./execution-bundle.json --input ./source.csv --output ./corrected.csv --receipt ./receipt.json');
    });
  });

  describe('reaudit results after verification', () => {
    const REAUDIT_BEFORE = 'id,name,email\n1,John,not_an_email\n2,Jane,jane@example.com\n';
    const REAUDIT_AFTER = 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com\n';
    const encode = (text: string) => new TextEncoder().encode(text);

    const buildEvidence = (): VerifiedRemediationEvidence => {
      const bundle = buildCanonicalBundle();
      const receipt = makeReceipt(bundle);
      return buildVerifiedRemediationEvidence({
        bundle,
        receipt,
        sourceCsv: encode(REAUDIT_BEFORE),
        correctedCsv: encode(REAUDIT_AFTER),
        evidenceEnvelopeRef: ENVELOPE_REF,
      });
    };

    it('shows a running indicator while reaudit is in progress', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        state="verified"
        executionReceipt={makeReceipt(buildCanonicalBundle())}
        reauditState="running"
      />);
      expect(screen.getByTestId('apply-verify-reaudit-running')).toBeTruthy();
      expect(screen.queryByTestId('apply-verify-continue')).toBeFalsy();
    });

    it('renders before/after score, findings and rule sets when completed', () => {
      const evidence = buildEvidence();
      render(<ApplyVerifyStep
        {...defaultProps}
        state="verified"
        executionReceipt={evidence.receipt}
        reauditState="completed"
        verifiedEvidence={evidence}
      />);
      expect(screen.getByTestId('reaudit-before-score').textContent).toBe(String(evidence.beforeAfterSummary.beforeScore));
      expect(screen.getByTestId('reaudit-after-score').textContent).toBe(String(evidence.beforeAfterSummary.afterScore));
      expect(screen.getByTestId('reaudit-before-issues').textContent).toBe(String(evidence.beforeAfterSummary.beforeIssueCount));
      expect(screen.getByTestId('reaudit-after-issues').textContent).toBe(String(evidence.beforeAfterSummary.afterIssueCount));
      expect(screen.getByTestId('reaudit-corrected-rules')).toBeTruthy();
      expect(screen.getByTestId('reaudit-persistent-rules')).toBeTruthy();
      expect(screen.getByTestId('reaudit-new-rules')).toBeTruthy();
    });

    it('enables "Ir a Exportación" only when reaudit is completed', () => {
      const evidence = buildEvidence();
      const { rerender } = render(<ApplyVerifyStep
        {...defaultProps}
        state="verified"
        executionReceipt={evidence.receipt}
        reauditState="running"
      />);
      expect(screen.queryByTestId('apply-verify-continue')).toBeFalsy();

      rerender(<ApplyVerifyStep
        {...defaultProps}
        state="verified"
        executionReceipt={evidence.receipt}
        reauditState="completed"
        verifiedEvidence={evidence}
      />);
      expect(screen.getByTestId('apply-verify-continue')).toBeTruthy();
    });

    it('keeps the Python receipt but blocks export when reaudit fails', () => {
      const receipt = makeReceipt(buildCanonicalBundle());
      render(<ApplyVerifyStep
        {...defaultProps}
        state="verified"
        executionReceipt={receipt}
        reauditState="failed"
        reauditError="El CSV corregido está vacío o no es válido."
      />);
      expect(screen.getByTestId('apply-verify-reaudit-failed')).toBeTruthy();
      expect(screen.getByTestId('apply-verify-verified')).toBeTruthy();
      expect(screen.queryByTestId('apply-verify-continue')).toBeFalsy();
    });
  });
});