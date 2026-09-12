import { describe, expect, it } from 'vitest';
import {
  buildColumnRegistry,
  buildDiagnosisInputPackageV2,
  buildExecutionReceiptV1,
  buildScriptCandidateV2,
  buildScriptContext,
  buildScriptHashPayloadV2,
  exactDiagnosisPromptV2,
  finalizeScriptContractV2,
  sha256hex,
  validateScriptCandidateV2,
  type RemediationPlanV2,
} from '../contracts/llm';
import { sha256BytesHex } from '../contracts/llm/hash';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import { buildAuraExportPackage } from '../services/exportPackage';
import { validateAuraExportPackage } from '../services/exportContractValidation';
import {
  buildPythonExecutionBundle,
  buildPythonExecutionReceipt,
} from '../services/remediationExecution/pythonExecutionContract';
import { buildVerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import type { AuditReport } from '../types';

const SOURCE = new TextEncoder().encode('id,name\n1,Ana\n');
// This export fixture approves no actions: its output must preserve every value.
const CORRECTED = SOURCE.slice();

const report: AuditReport = {
  score: 100, rowCount: 1, colCount: 2, duplicateRows: 0,
  issues: [],
  columnStats: {
    id: { name: 'id', inferredType: 'number', nullCount: 0, uniqueCount: 1, sampleValues: [1] },
    name: { name: 'name', inferredType: 'string', nullCount: 0, uniqueCount: 1, sampleValues: ['Ana'] },
  },
  scoreBreakdown: [], delimiterDetected: ',',
};

const DATASET_HASH = sha256BytesHex(SOURCE);
const envelope = _buildEvidenceEnvelopeV2(report as any, {
  privacyLevel: 'local_full', datasetSha256: DATASET_HASH, delimiter: ',',
});
const inputSnapshot = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
const rawResponse = '{"contractId":"aura.diagnosis.v2"}';
const diagnosisReceipt = buildExecutionReceiptV1({
  input: inputSnapshot, requestedInputMode: 'smart_sample',
  exactPrompt: exactDiagnosisPromptV2(inputSnapshot), provider: 'Ollama',
  requestedModel: 'test', observedModel: 'test',
  inference: { temperature: 0.1, topP: 0.9, numCtx: 4096, numPredict: 800, think: false, seed: null, keepAlive: '10m', timeoutSeconds: 60 },
  startedAt: '2026-07-18T11:59:00.000Z', completedAt: '2026-07-18T11:59:01.000Z',
  rawResponse, validationStatus: 'valid', validationErrorCodes: [],
});
const DIAGNOSIS_RECEIPT = diagnosisReceipt.receiptHash;
const ENVELOPE = inputSnapshot.evidenceEnvelopeRef;
const plan: RemediationPlanV2 = {
  contractId: 'aura.remediation.v2', contractVersion: '2.0.0', planId: 'plan:test',
  diagnosisRef: 'diag:test', evidenceEnvelopeRef: ENVELOPE,
  inputReceiptRef: DIAGNOSIS_RECEIPT, datasetFingerprint: DATASET_HASH,
  plan: [], actionabilityMap: {}, exclusions: [], generatedAt: '2026-07-18T12:00:00.000Z',
};
const scriptContext = buildScriptContext({
  evidenceEnvelopeRef: ENVELOPE, datasetFingerprint: DATASET_HASH, columns: [], issues: [],
}, buildColumnRegistry([]), DATASET_HASH);
const scriptCandidate = buildScriptCandidateV2(plan, scriptContext, { generatedAt: '2026-07-18T12:00:00.000Z' });
const scriptVerification = validateScriptCandidateV2(scriptCandidate, plan, scriptContext);
const scriptContract = finalizeScriptContractV2(scriptCandidate, scriptVerification);
const SCRIPT = scriptContract.scriptText;
const SCRIPT_HASH = scriptContract.scriptHash;
const SCRIPT_PAYLOAD = buildScriptHashPayloadV2(scriptContract);

const bundle = buildPythonExecutionBundle({
  generatedAt: '2026-07-18T12:00:00.000Z',
  executionId: 'execution:test',
  approvedScriptHash: SCRIPT_HASH,
  beforeDatasetSha256: DATASET_HASH,
  scriptText: SCRIPT,
  scriptHashPayload: SCRIPT_PAYLOAD,
  inputReceiptRef: DIAGNOSIS_RECEIPT,
  evidenceEnvelopeRef: ENVELOPE,
});

const receipt = buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0',
  runId: bundle.runId, approvedScriptHash: bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256,
  afterDatasetSha256: sha256BytesHex(CORRECTED),
  pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'darwin',
  bundleHash: bundle.bundleHash, inputReceiptRef: bundle.inputReceiptRef,
  evidenceEnvelopeRef: bundle.evidenceEnvelopeRef,
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed', startedAt: '2026-07-18T12:01:00.000Z',
    completedAt: '2026-07-18T12:01:01.000Z', durationMs: 1000,
    stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
  },
  output: { rowCount: 1, columnCount: 2 },
});

const verified = buildVerifiedRemediationEvidence({
  bundle, receipt, sourceCsv: SOURCE, correctedCsv: CORRECTED,
  evidenceEnvelopeRef: ENVELOPE,
});

const packageFor = (remediationExecution?: unknown) => {
  const exported = buildAuraExportPackage({
    manifest: buildEvidenceManifest({ auditEvidence: null, benchmarkResults: [] }),
    profile: { report, auditEvidence: null },
    diagnosticReport: null,
    diagnosis: {
      status: 'valid', model: 'test', providerType: 'ollama', diagnosisText: 'Diagnóstico válido',
      structuredDiagnosis: {
        version: 2, diagnosis: { contractId: 'aura.diagnosis.v2' },
        metrics: { latencyMs: 1, tokensGenerated: 1, model: 'test', provider: 'Ollama', isLocal: true },
        promptHash: inputSnapshot.promptHash, evidenceEnvelopeRef: ENVELOPE,
        promptVersion: inputSnapshot.promptVersion, rawResponseHash: diagnosisReceipt.rawResponseHash,
        inputMode: inputSnapshot.inputMode, inputHash: inputSnapshot.inputHash,
        inputSnapshot, executionReceipt: diagnosisReceipt,
      } as any,
      failureEvidence: null, inputSnapshot: inputSnapshot as unknown as Record<string, unknown>,
      executionReceipt: diagnosisReceipt as unknown as Record<string, unknown>, rawResponseHash: diagnosisReceipt.rawResponseHash, rawResponse,
    },
    script: {
      generatedScript: SCRIPT, scriptValidation: null, approvedScript: SCRIPT,
      remediationPlan: plan, contract: scriptContract,
      verification: scriptVerification,
    },
    benchmarkResults: [],
    remediationExecution: remediationExecution as any,
  });
  return {
    ...exported,
    artifactIdentity: {
      ...exported.artifactIdentity,
      datasetSha256: bundle.beforeDatasetSha256,
      diagnosisReceiptHash: DIAGNOSIS_RECEIPT,
    },
  };
};

const correctedDataset = {
  sha256: receipt.afterDatasetSha256!, rowCount: 1, columnCount: 2,
  includedInEvidenceArchive: false,
};

describe('aura-technical-export remediationExecution 2.1', () => {
  it.each([
    ['not_run', null, null, null, null],
    ['prepared', bundle, null, null, null],
    ['invalid', bundle, null, null, null],
    ['verified', bundle, receipt, null, correctedDataset],
    ['reaudited', bundle, receipt, verified.verification, correctedDataset],
  ] as const)('construye y valida el estado %s', (status, executionBundle, pythonReceipt, verification, corrected) => {
    const value = packageFor({
      status, executionBundle, pythonReceipt, verification,
      correctedDataset: corrected,
      limitations: status === 'not_run'
        ? ['El análisis fue completado, pero no se ejecutó una remediación sobre el dataset']
        : status === 'invalid' ? ['La ejecución no pudo certificarse.'] : [],
    });
    expect(value.exportContract.version).toBe('2.1');
    const validation = validateAuraExportPackage(value);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it('rechaza verified sin recibo y correctedDataset en invalid', () => {
    const verifiedWithoutReceipt = packageFor({
      status: 'verified', executionBundle: bundle, pythonReceipt: null,
      verification: null, correctedDataset, limitations: [],
    });
    const invalidWithDataset = packageFor({
      status: 'invalid', executionBundle: bundle, pythonReceipt: null,
      verification: null, correctedDataset, limitations: ['falló'],
    });
    expect(validateAuraExportPackage(verifiedWithoutReceipt).valid).toBe(false);
    expect(validateAuraExportPackage(invalidWithDataset).valid).toBe(false);
  });

  it('rechaza un bundle malformado sin lanzar excepción', () => {
    const value = packageFor({
      status: 'prepared', executionBundle: { contractId: 'broken', nested: { value: 1 } },
      pythonReceipt: null, verification: null, correctedDataset: null, limitations: [],
    });
    expect(() => validateAuraExportPackage(value)).not.toThrow();
    expect(validateAuraExportPackage(value).valid).toBe(false);
  });

  it.each([
    ['corrected hash', (value: any) => { value.remediationExecution.correctedDataset.sha256 = 'd'.repeat(64); }],
    ['script hash', (value: any) => { value.remediationExecution.executionBundle.approvedScriptHash = 'e'.repeat(64); }],
    ['diagnosis receipt', (value: any) => { value.artifactIdentity.diagnosisReceiptHash = 'f'.repeat(64); }],
    ['nested apiKey', (value: any) => { value.remediationExecution.verification.secret = { apiKey: 'secret' }; }],
    ['raw stdout', (value: any) => { value.remediationExecution.pythonReceipt.execution.stdout = 'secret output'; }],
  ])('falla cerrado ante adulteración de %s', (_label, tamper) => {
    const value = packageFor({
      status: 'reaudited', executionBundle: structuredClone(bundle),
      pythonReceipt: structuredClone(receipt), verification: structuredClone(verified.verification),
      correctedDataset: { ...correctedDataset }, limitations: [],
    }) as any;
    tamper(value);
    expect(validateAuraExportPackage(value).valid).toBe(false);
  });

  it.each([
    ['before', (verification: any) => { delete verification.before; }],
    ['after', (verification: any) => { delete verification.after; }],
    ['executionId', (verification: any) => { verification.executionId = 'execution:other'; }],
  ])('rechaza reaudited cuando %s no conserva la estructura enlazada', (_label, mutate) => {
    const value = packageFor({
      status: 'reaudited', executionBundle: structuredClone(bundle),
      pythonReceipt: structuredClone(receipt), verification: structuredClone(verified.verification),
      correctedDataset: { ...correctedDataset }, limitations: [],
    }) as any;
    mutate(value.remediationExecution.verification);
    expect(validateAuraExportPackage(value).valid).toBe(false);
  });

  it('acepta exportación histórica 2.0 sin remediationExecution', () => {
    const legacy = packageFor() as any;
    legacy.exportContract.version = '2.0';
    legacy.exportContract.canonicalBlocks = legacy.exportContract.canonicalBlocks.filter(
      (name: string) => name !== 'remediationExecution',
    );
    delete legacy.remediationExecution;
    expect(validateAuraExportPackage(legacy)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('rechaza 2.0 que conserva el bloque remediationExecution', () => {
    const legacy = packageFor() as any;
    legacy.exportContract.version = '2.0';
    legacy.exportContract.canonicalBlocks = legacy.exportContract.canonicalBlocks.filter(
      (name: string) => name !== 'remediationExecution',
    );
    expect(validateAuraExportPackage(legacy).valid).toBe(false);
  });

  it('rechaza 2.0 que declara remediationExecution en canonicalBlocks', () => {
    const legacy = packageFor() as any;
    legacy.exportContract.version = '2.0';
    delete legacy.remediationExecution;
    expect(validateAuraExportPackage(legacy).valid).toBe(false);
  });
});
