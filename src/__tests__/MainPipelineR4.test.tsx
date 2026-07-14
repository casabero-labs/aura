// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { savePipelineSession } from '../services/pipelineSession';
import { buildPythonExecutionBundle, buildPythonExecutionReceipt } from '../services/remediationExecution/pythonExecutionContract';
import type { PythonExecutionBundleV1, PythonExecutionReceiptV1 } from '../services/remediationExecution/pythonExecutionContract';
import { buildVerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import { sha256hex, sha256BytesHex } from '../contracts/llm/hash';

const SCRIPT_TEXT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';
const BEFORE_CSV = 'Name\n Alice \n';
const AFTER_CSV = 'Name\nAlice\n';
const FINGERPRINT = sha256hex(BEFORE_CSV);
const SCRIPT_HASH = sha256hex(JSON.stringify({ scriptText: SCRIPT_TEXT }));

const buildBundle = (): PythonExecutionBundleV1 => buildPythonExecutionBundle({
  generatedAt: '2026-07-12T12:05:00.000Z',
  executionId: 'run:integration',
  approvedScriptHash: SCRIPT_HASH,
  beforeDatasetSha256: FINGERPRINT,
  scriptText: SCRIPT_TEXT,
  scriptHashPayload: { scriptText: SCRIPT_TEXT },
  inputReceiptRef: 'b'.repeat(64),
  evidenceEnvelopeRef: 'env:' + 'c'.repeat(64),
});

const makeReceipt = (bundle: PythonExecutionBundleV1): PythonExecutionReceiptV1 => buildPythonExecutionReceipt({
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
});

describe('MainPipeline R4', () => {
  it('savePipelineSession excludes verifiedExecution from JSON', () => {
    const sourceFile = new File([BEFORE_CSV], 'source.csv', { type: 'text/csv' });
    const bundle = buildBundle();
    const receipt = makeReceipt(bundle);
    const afterFile = new File([AFTER_CSV], 'corrected.csv', { type: 'text/csv' });
    savePipelineSession({
      state: 'execution',
      file: sourceFile,
      report: null, auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null, diagnosisFailureEvidence: null,
      diagnosticReport: null, remediationPlan: null,
      scriptContractV2: null, scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
      executionState: 'verified',
      executionBundleJson: JSON.stringify(bundle),
      executionReceipt: receipt,
      executionValidationError: '',
      verifiedExecution: { bundle, receipt, afterFile },
    });
    const stored = localStorage.getItem('aura_pipeline_session_v1') ?? '';
    expect(stored).not.toContain('verifiedExecution');
    expect(stored).not.toContain('afterFile');
  });

  it('savePipelineSession excludes verifiedEvidence (corrected CSV bytes) from JSON', () => {
    const sourceFile = new File([BEFORE_CSV], 'source.csv', { type: 'text/csv' });
    const bundle = buildBundle();
    const receipt = makeReceipt(bundle);
    const afterFile = new File([AFTER_CSV], 'corrected.csv', { type: 'text/csv' });
    const verifiedEvidence = buildVerifiedRemediationEvidence({
      bundle,
      receipt,
      sourceCsv: new TextEncoder().encode(BEFORE_CSV),
      correctedCsv: new TextEncoder().encode(AFTER_CSV),
      evidenceEnvelopeRef: bundle.evidenceEnvelopeRef!,
    });
    savePipelineSession({
      state: 'execution',
      file: sourceFile,
      report: null, auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null, diagnosisFailureEvidence: null,
      diagnosticReport: null, remediationPlan: null,
      scriptContractV2: null, scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
      executionState: 'verified',
      executionBundleJson: JSON.stringify(bundle),
      executionReceipt: receipt,
      executionValidationError: '',
      verifiedExecution: { bundle, receipt, afterFile },
      reauditState: 'completed',
      reauditError: '',
      verifiedEvidence,
    });
    const stored = localStorage.getItem('aura_pipeline_session_v1') ?? '';
    expect(stored).not.toContain('verifiedEvidence');
    expect(stored).not.toContain('correctedCsv');
    expect(stored).not.toContain('beforeReport');
    expect(stored).not.toContain('afterReport');
    expect(stored).not.toContain(AFTER_CSV.trim());
  });
});