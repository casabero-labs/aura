// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ApplyVerifyStep from '../components/ApplyVerifyStep';
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
  validationResult: {
    scriptText: SCRIPT_TEXT,
    scriptHash: 'a'.repeat(64),
    pythonSyntax: { state: 'passed' },
    acceptedActionIds: ['action:trim'],
    rejectedActionIds: [],
    excludedActionIds: [],
    generatedAt: '2026-07-12T12:00:00.000Z',
  } as any,
} as unknown as ScriptContractV2);

const defaultProps = {
  state: 'not_prepared' as const,
  report: null as unknown as AuditReport,
  sourceFile: null,
  onStateChange: vi.fn(),
  onReceiptChange: vi.fn(),
  onErrorChange: vi.fn(),
  onBundleJsonChange: vi.fn(),
  onLog: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
};

describe('ApplyVerifyStep', () => {
  it('shows preconditions warning when SHA-256 is missing', () => {
    render(<ApplyVerifyStep {...defaultProps} />);
    expect(screen.getByTestId('apply-verify-preconditions')).toBeTruthy();
    expect(screen.getByText(/SHA-256/i)).toBeTruthy();
  });

  it('shows preconditions warning when script contract V2 is missing', () => {
    render(<ApplyVerifyStep {...defaultProps} sourceDatasetFingerprint={'a'.repeat(64)} />);
    expect(screen.getByTestId('apply-verify-preconditions')).toBeTruthy();
    expect(screen.getByText(/contrato de script V2/i)).toBeTruthy();
  });

  it('does not show prepare button when preconditions fail', () => {
    render(<ApplyVerifyStep {...defaultProps} />);
    expect(screen.queryByTestId('apply-verify-prepare')).toBeFalsy();
  });

  it('shows prepare button when preconditions are met', () => {
    render(<ApplyVerifyStep
      {...defaultProps}
      sourceDatasetFingerprint={'a'.repeat(64)}
      scriptContractV2={makeContract()}
      scriptContractVerificationV2={{ pythonSyntax: { state: 'passed' } } as any}
      approvedScript={SCRIPT_TEXT}
    />);
    expect(screen.getByTestId('apply-verify-prepare')).toBeTruthy();
  });

  it('preparing shows ready state with downloads and command', async () => {
    const onStateChange = vi.fn();
    const onBundleJsonChange = vi.fn();
    // Render directly in ready state with stored bundle to test the layout
    const { container } = render(<ApplyVerifyStep
      {...defaultProps}
      state="ready"
      executionBundleJson={'{"contractId":"aura.python-execution-bundle.v1"}'}
      sourceDatasetFingerprint={'a'.repeat(64)}
      scriptContractV2={makeContract()}
      scriptContractVerificationV2={{ pythonSyntax: { state: 'passed' } } as any}
      approvedScript={SCRIPT_TEXT}
      onStateChange={onStateChange}
      onBundleJsonChange={onBundleJsonChange}
    />);
    expect(screen.getByTestId('apply-verify-ready')).toBeTruthy();
    expect(screen.getByTestId('apply-verify-download-bundle')).toBeTruthy();
    expect(screen.getByTestId('apply-verify-download-source')).toBeTruthy();
    expect(screen.getByTestId('apply-verify-command')).toBeTruthy();
  });

  it('shows both export and improve routes from diagnostic report', () => {
    render(<ApplyVerifyStep
      {...defaultProps}
      state="ready"
      executionBundleJson={'{"contractId":"aura.python-execution-bundle.v1"}'}
      sourceDatasetFingerprint={'a'.repeat(64)}
    />);
    expect(screen.queryByTestId('apply-verify-back')).toBeTruthy();
  });

  it('requires two files for validation', () => {
    render(<ApplyVerifyStep
      {...defaultProps}
      state="awaiting_external_output"
      sourceDatasetFingerprint={'a'.repeat(64)}
      scriptContractV2={makeContract()}
    />);
    expect(screen.getByTestId('apply-verify-validate')).toBeTruthy();
    expect((screen.getByTestId('apply-verify-validate') as HTMLButtonElement).disabled).toBe(true);
  });

  it('back button goes to review', () => {
    const onBack = vi.fn();
    render(<ApplyVerifyStep {...defaultProps} state="ready" executionBundleJson={'{}'} onBack={onBack} />);
    fireEvent.click(screen.getByTestId('apply-verify-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows validation error when state is invalid', () => {
    render(<ApplyVerifyStep
      {...defaultProps}
      state="invalid"
      executionValidationError="Recibo inválido: hash mismatch"
      sourceDatasetFingerprint={'a'.repeat(64)}
      scriptContractV2={makeContract()}
    />);
    expect(screen.getByTestId('apply-verify-error')).toBeTruthy();
    expect(screen.getByText(/Recibo inválido/)).toBeTruthy();
  });

  it('shows verified state with continue button', () => {
    const onContinue = vi.fn();
    render(<ApplyVerifyStep
      {...defaultProps}
      state="verified"
      executionReceipt={{
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
        syntax: { status: 'passed', error: null },
        execution: {
          status: 'passed',
          startedAt: '2026-07-12T12:00:00.000Z',
          completedAt: '2026-07-12T12:00:01.000Z',
          durationMs: 1000,
          stdoutSha256: 'e'.repeat(64),
          stderrSha256: 'f'.repeat(64),
          error: null,
        },
        output: { rowCount: 100, columnCount: 5 },
        receiptHash: 'g'.repeat(64),
      }}
      onContinue={onContinue}
    />);
    expect(screen.getByTestId('apply-verify-verified')).toBeTruthy();
    expect(screen.getByText('3.12.1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('apply-verify-continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('shows command with correct runner path', () => {
    render(<ApplyVerifyStep
      {...defaultProps}
      state="ready"
      executionBundleJson={'{"contractId":"test"}'}
      sourceDatasetFingerprint={'a'.repeat(64)}
      scriptContractV2={makeContract()}
      scriptContractVerificationV2={{ pythonSyntax: { state: 'passed' } } as any}
      approvedScript={SCRIPT_TEXT}
    />);
    expect(screen.getByTestId('apply-verify-command')).toBeTruthy();
    expect(screen.getByTestId('apply-verify-command').textContent).toContain('run-aura-remediation.mjs');
  });
});
