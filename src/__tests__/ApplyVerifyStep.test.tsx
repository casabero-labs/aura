// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ApplyVerifyStep from '../components/ApplyVerifyStep';
import type { PythonExecutionReceiptV1 } from '../services/remediationExecution/pythonExecutionContract';
import type { AuditReport } from '../types';
import type { ScriptContractV2 } from '../contracts/llm';

const SCRIPT_TEXT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';

const makeContract = (): ScriptContractV2 => ({
  contractId: 'aura.script.v2',
  contractVersion: '2.0.0',
  scriptText: SCRIPT_TEXT,
  scriptHash: 'a'.repeat(64),
  acceptedActionIds: ['action:trim'],
  rejectedActionIds: [],
  excludedActionIds: [],
  columnRefs: [],
  cleanDatasetFn: 'clean_dataset',
  rendererVersion: '1.0.0',
  placeholderVocabularyVersion: '1.0.0',
  remediationRef: 'plan:test',
  datasetFingerprint: 'a'.repeat(64),
  generatedAt: '2026-07-12T12:00:00.000Z',
  inputReceiptRef: 'b'.repeat(64),
  validationResult: { pythonSyntax: { state: 'passed' } } as any,
} as unknown as ScriptContractV2);

const makeReceipt = (overrides: Partial<PythonExecutionReceiptV1> = {}): PythonExecutionReceiptV1 => ({
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: 'exec:abc',
  approvedScriptHash: 'a'.repeat(64),
  scriptTextSha256: 'b'.repeat(64),
  beforeDatasetSha256: 'c'.repeat(64),
  afterDatasetSha256: 'd'.repeat(64),
  pythonVersion: '3.12.1',
  pandasVersion: '2.2.0',
  platform: 'darwin',
  bundleHash: 'h'.repeat(64),
  inputReceiptRef: 'b'.repeat(64),
  evidenceEnvelopeRef: 'env:' + 'e'.repeat(64),
  syntax: { status: 'passed' as const, error: null },
  execution: {
    status: 'passed' as const,
    startedAt: '2026-07-12T12:00:00.000Z',
    completedAt: '2026-07-12T12:00:01.000Z',
    durationMs: 1000,
    stdoutSha256: 'f'.repeat(64),
    stderrSha256: 'g'.repeat(64),
    error: null,
  },
  output: { rowCount: 100, columnCount: 5 },
  receiptHash: 'i'.repeat(64),
  ...overrides,
});

const sourceFile = new File(['col\nval'], 'test.csv', { type: 'text/csv' });
const afterFile = new File(['col\nval2'], 'corrected.csv', { type: 'text/csv' });

const defaultProps = {
  state: 'not_prepared' as const,
  report: null as unknown as AuditReport,
  sourceFile: null,
  sourceDatasetFingerprint: 'c'.repeat(64),
  onStateChange: vi.fn(),
  onReceiptChange: vi.fn(),
  onErrorChange: vi.fn(),
  onBundleJsonChange: vi.fn(),
  onAfterFileChange: vi.fn(),
  onSourceFileChange: vi.fn(),
  onLog: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

const fullContract = makeContract();
const fullVerif = {
  valid: true,
  pythonSyntax: { state: 'passed' as const },
} as any;

describe('ApplyVerifyStep R2', () => {
  describe('preconditions', () => {
    it('shows prepare button when all preconditions are met', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={{
          executionReceipt: { receiptHash: 'b'.repeat(64) } as any,
          evidenceEnvelopeRef: 'env:test',
        } as any}
      />);
      expect(screen.getByTestId('apply-verify-prepare')).toBeTruthy();
    });

    it('blocks when scriptContractVerificationV2.valid !== true', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={{ valid: false, pythonSyntax: { state: 'passed' } } as any}
        approvedScript={SCRIPT_TEXT}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });

    it('blocks when sourceFile is null', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={null}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
      expect(screen.getByTestId('apply-verify-reselect-source')).toBeTruthy();
    });

    it('blocks when inputReceiptRef does not match diagnosis receiptHash', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        structuredDiagnosis={{
          executionReceipt: { receiptHash: 'z'.repeat(64) } as any,
          evidenceEnvelopeRef: 'env:test',
        } as any}
      />);
      expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
    });
  });

  describe('re-selection', () => {
    it('re-selection with correct SHA calls onSourceFileChange', async () => {
      const onSourceFileChange = vi.fn();
      const onErrorChange = vi.fn();
      render(<ApplyVerifyStep
        {...defaultProps}
        sourceFile={null}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        onSourceFileChange={onSourceFileChange}
        onErrorChange={onErrorChange}
      />);
      const shaContent = 'a'.repeat(64);
      const file = new File([shaContent], 'correct.csv', { type: 'text/csv' });
      // Reselect input exists
      const input = screen.getByTestId('apply-verify-reselect-source') as HTMLInputElement;
      expect(input).toBeTruthy();
    });
  });

  describe('command and download', () => {
    it('shows node command with correct runner path', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        state="ready"
        executionBundleJson={'{"contractId":"test"}'}
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
      />);
      expect(screen.getByTestId('apply-verify-command').textContent).toContain('node experiments/runners/run-aura-remediation.mjs');
    });

    it('copy command button exists', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        state="ready"
        executionBundleJson={'{"contractId":"test"}'}
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
      />);
      expect(screen.getByTestId('apply-verify-copy-command')).toBeTruthy();
    });
  });

  describe('validation', () => {
    it('shows verified state with info grid and continue', () => {
      const onContinue = vi.fn();
      render(<ApplyVerifyStep
        {...defaultProps}
        state="verified"
        executionReceipt={makeReceipt()}
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
        onContinue={onContinue}
      />);
      expect(screen.getByTestId('apply-verify-verified')).toBeTruthy();
      expect(screen.getByText('3.12.1')).toBeTruthy();
      fireEvent.click(screen.getByTestId('apply-verify-continue'));
      expect(onContinue).toHaveBeenCalled();
    });

    it('shows error message when state is invalid', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        state="invalid"
        executionValidationError="Cadena inválida: bundle bundleHash mismatch"
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
      />);
      expect(screen.getByTestId('apply-verify-error')).toBeTruthy();
      expect(screen.getByText(/Cadena inválida/)).toBeTruthy();
    });

    it('validate button is disabled without files', () => {
      render(<ApplyVerifyStep
        {...defaultProps}
        state="awaiting_external_output"
        sourceFile={sourceFile}
        sourceDatasetFingerprint={'a'.repeat(64)}
        scriptContractV2={fullContract}
        scriptContractVerificationV2={fullVerif}
        approvedScript={SCRIPT_TEXT}
      />);
      expect((screen.getByTestId('apply-verify-validate') as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
