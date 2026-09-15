import React from 'react';
import ApplyVerifyStep from './ApplyVerifyStep';
import type { AuditReport } from '../types';
import type { ScriptContractV2, ScriptValidationResultV2, DiagnosisExecutionResult } from '../contracts/llm';
import { computeScriptHashV2 } from '../contracts/llm/scriptBuilderV2';
import { sha256hex } from '../contracts/llm/hash';
import type { PythonExecutionReceiptV1 } from '../services/remediationExecution/pythonExecutionContract';
import { buildPythonExecutionBundle, buildPythonExecutionReceipt } from '../services/remediationExecution/pythonExecutionContract';
import { buildVerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';

const SCRIPT_TEXT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';
const BEFORE_CSV = 'Name\n Alice \n';
const AFTER_CSV = 'Name\nAlice\n';
const FINGERPRINT = sha256hex(BEFORE_CSV);
const DIAG_RECEIPT_HASH = 'b'.repeat(64);
const ENVELOPE_REF: string = 'env:' + 'c'.repeat(64);

const buildContract = (): ScriptContractV2 => {
  const contract: ScriptContractV2 = {
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
    generatedAt: '2026-07-13T12:00:00.000Z',
    inputReceiptRef: DIAG_RECEIPT_HASH,
    inputTrace: { envelopeRef: ENVELOPE_REF, fingerprint: FINGERPRINT, promptHash: 'd'.repeat(64) },
    validationResult: { pythonSyntax: { state: 'passed' } },
  } as unknown as ScriptContractV2;
  contract.scriptHash = computeScriptHashV2(contract);
  return contract;
};

const contract = buildContract();
const SCRIPT_HASH = sha256hex(JSON.stringify({ scriptText: SCRIPT_TEXT }));

const fullVerif: ScriptValidationResultV2 = { valid: true, pythonSyntax: { state: 'passed' } } as any;
const fullDiag: DiagnosisExecutionResult = {
  executionReceipt: { receiptHash: DIAG_RECEIPT_HASH },
  evidenceEnvelopeRef: ENVELOPE_REF,
} as any;

const sourceFile = new File([BEFORE_CSV], 'source.csv', { type: 'text/csv' });
const bundle = buildPythonExecutionBundle({
  generatedAt: '2026-07-13T12:05:00.000Z',
  executionId: 'run:verified',
  approvedScriptHash: SCRIPT_HASH,
  beforeDatasetSha256: FINGERPRINT,
  scriptText: SCRIPT_TEXT,
  scriptHashPayload: { scriptText: SCRIPT_TEXT },
  inputReceiptRef: DIAG_RECEIPT_HASH,
  evidenceEnvelopeRef: ENVELOPE_REF,
});
const bundleJson = JSON.stringify(bundle, null, 2);

const makeReceipt = (tampered: boolean): PythonExecutionReceiptV1 => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1',
  contractVersion: '1.0.0',
  runId: bundle.runId,
  approvedScriptHash: tampered ? 'a'.repeat(64) : bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256,
  afterDatasetSha256: sha256hex(AFTER_CSV),
  pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'darwin',
  bundleHash: bundle.bundleHash,
  inputReceiptRef: bundle.inputReceiptRef,
  evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed', startedAt: '2026-07-13T12:10:00.000Z', completedAt: '2026-07-13T12:10:01.000Z',
    durationMs: 1000, stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
  },
  output: { rowCount: 1, columnCount: 1 },
});

const validReceipt = makeReceipt(false);
const invalidReceipt = makeReceipt(true);
const verifiedEvidence = buildVerifiedRemediationEvidence({
  bundle,
  receipt: validReceipt,
  sourceCsv: new TextEncoder().encode(BEFORE_CSV),
  correctedCsv: new TextEncoder().encode(AFTER_CSV),
  evidenceEnvelopeRef: ENVELOPE_REF,
});

type AvState = 'not_prepared' | 'ready' | 'awaiting_external_output' | 'validating' | 'verified' | 'invalid';

const sharedProps = {
  report: null as unknown as AuditReport,
  auditEvidence: { datasetSha256: FINGERPRINT } as any,
  structuredDiagnosis: fullDiag,
  sourceFile,
  sourceDatasetFingerprint: FINGERPRINT,
  scriptContractV2: contract,
  scriptContractVerificationV2: fullVerif,
  approvedScript: SCRIPT_TEXT,
  onStateChange: () => {},
  onReceiptChange: () => {},
  onErrorChange: () => {},
  onBundleJsonChange: () => {},
  onAfterFileChange: () => {},
  onSourceFileChange: () => {},
  onVerifiedExecution: () => {},
  onLog: () => {},
  onContinue: () => {},
  onBack: () => {},
};

const states: { name: string; state: AvState; extra: Record<string, any> }[] = [
  { name: 'ready', state: 'ready', extra: { executionBundleJson: bundleJson } },
  { name: 'awaiting_external_output', state: 'awaiting_external_output', extra: { executionBundleJson: bundleJson } },
  { name: 'verified', state: 'verified', extra: { executionBundleJson: bundleJson, executionReceipt: validReceipt } },
  {
    name: 'verified-reaudited',
    state: 'verified',
    extra: {
      executionBundleJson: bundleJson,
      executionReceipt: validReceipt,
      reauditState: 'completed',
      verifiedEvidence,
    },
  },
  { name: 'invalid', state: 'invalid', extra: { executionBundleJson: bundleJson, executionReceipt: invalidReceipt, executionValidationError: 'La cadena criptográfica no es válida: el approvedScriptHash no coincide.' } },
];

export default function AvFixturePage() {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get('av-fixture') || 'ready';
  const found = states.find(s => s.name === fixture);

  if (!found) {
    return <div className="step-card" style={{ padding: '2rem' }}>Estado desconocido: {fixture}</div>;
  }

  return (
    <div className="apply-verify-fixture" style={{ maxWidth: 960, margin: '1.5rem auto' }}>

      <ApplyVerifyStep
        key={fixture}
        {...sharedProps}
        state={found.state}
        {...found.extra}
      />
    </div>
  );
}
