import { describe, expect, it } from 'vitest';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2_5 } from '../contracts/llm/diagnosisInputPackageV2_5';
import { exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { buildExecutionReceiptV1 } from '../contracts/llm/executionReceiptV1';
import type { DiagnosisResponseV2, InferenceSnapshotV1 } from '../contracts/llm/types';
import { extractCompatibleFormalDiagnosisEvidence } from '../services/benchmark/formalDiagnosisEvidenceV2_5';
import { FINAL_EVALUATION_PROTOCOL } from '../services/benchmark/finalEvaluationProtocol';
import type { ExperimentRunV1 } from '../services/benchmark/experimentTypes';

const report: AuditReportInput = {
  score: 75,
  rowCount: 4,
  colCount: 2,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [
    {
      id: 'issue:name-trim',
      column: 'Name',
      ruleName: 'Whitespace',
      ruleId: 'rule:trim-whitespace',
      category: 'Higiene',
      description: 'Whitespace detected',
      severity: 'info',
      count: 1,
      affectedPercentage: 25,
      sampleValues: [' Alice '],
      automaticAuthorization: {
        actionType: 'trim_whitespace',
        authorized: true,
        conditionsMet: ['string-column'],
        reason: 'Lossless normalization',
      },
    },
    {
      id: 'issue:age-null',
      column: 'Age',
      ruleName: 'Nulls',
      ruleId: 'rule:null-values',
      category: 'Integridad',
      description: 'Null detected',
      severity: 'warning',
      count: 1,
      affectedPercentage: 25,
      sampleValues: [null],
    },
  ],
  columnStats: {
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 4,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
    Age: {
      inferredType: 'number', semanticType: 'age', distinctCount: 3,
      nullCount: 1, nullPercentage: 25, topValues: [], stats: {},
    },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
};

const envelope = _buildEvidenceEnvelopeV2(report, {
  privacyLevel: 'local_full',
  datasetSha256: 'c'.repeat(64),
  delimiter: ',',
});
const input = buildDiagnosisInputPackageV2_5(report, envelope, 'smart_sample');
const aliasesByIssue = new Map<string, string[]>();
for (const entry of input.evidenceAliasMap.entries) {
  aliasesByIssue.set(entry.issueId, [
    ...(aliasesByIssue.get(entry.issueId) ?? []),
    entry.alias,
  ]);
}
const diagnosis: DiagnosisResponseV2 = {
  contractId: 'aura.diagnosis.v2',
  contractVersion: '2.0.0',
  evidenceEnvelopeRef: input.evidenceEnvelopeRef,
  responseId: 'formal:v2.5:test',
  issues: envelope.issues.map((issue) => ({
    issueId: issue.issueId,
    evidenceRefs: aliasesByIssue.get(issue.issueId) ?? [],
    hypothesis: `Interpretation for ${issue.issueId}`,
    confidence: 0.5,
    requiresHumanReview: true,
    limits: [],
  })),
  diagnosisBlocks: envelope.issues.map((issue) => ({
    issueId: issue.issueId,
    ruleId: issue.ruleId,
    columnId: issue.columnId,
    scope: issue.scope,
    observation: `Observed ${issue.ruleName}`,
    recommendation: 'Review the finding with the dataset owner',
  })),
  limitations: [],
  generatedAt: '2026-07-19T20:00:00.000Z',
};
const rawOutput = JSON.stringify(diagnosis);
const inference: InferenceSnapshotV1 = {
  temperature: 0.1,
  topP: 0.9,
  think: false,
  numCtx: 16384,
  numPredict: 4096,
  seed: null,
  keepAlive: '10m',
  timeoutSeconds: 600,
};
const modelId = FINAL_EVALUATION_PROTOCOL.models[0];
const receipt = buildExecutionReceiptV1({
  input,
  requestedInputMode: input.inputMode,
  exactPrompt: exactDiagnosisPromptV2(input),
  provider: 'ollama',
  requestedModel: modelId,
  observedModel: modelId,
  modelDigest: 'd'.repeat(64),
  inference,
  startedAt: '2026-07-19T20:00:00.000Z',
  completedAt: '2026-07-19T20:01:00.000Z',
  rawResponse: rawOutput,
  validationStatus: 'valid',
  validationErrorCodes: [],
});

const run: ExperimentRunV1 = {
  contractId: 'aura.experiment-run.v1',
  contractVersion: '1.0.0',
  campaignId: 'campaign:v2.5:test',
  runId: 'run:v2.5:test',
  protocolId: FINAL_EVALUATION_PROTOCOL.id,
  protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
  modelId,
  inputMode: 'smart_sample',
  repetition: 1,
  sequence: 1,
  status: 'completed',
  createdAt: '2026-07-19T20:00:00.000Z',
  updatedAt: '2026-07-19T20:01:00.000Z',
  environment: {
    contractId: 'aura.environment-snapshot.v1',
    capturedAt: '2026-07-19T20:00:00.000Z',
    appCommit: 'abcdef1',
    dataset: {
      id: FINAL_EVALUATION_PROTOCOL.dataset.id,
      sha256: 'c'.repeat(64),
      schemaSha256: 'e'.repeat(64),
      groundTruthSha256: 'f'.repeat(64),
    },
    hardware: { machine: 'test', cpu: 'test', memoryBytes: 1 },
    runtime: { provider: 'ollama', ollamaVersion: '0.5.0', clientVersion: 'test' },
    model: {
      id: modelId,
      quantization: 'UD-Q4_K_XL',
      expectedGgufSha256: 'd'.repeat(64),
      localDigest: 'd'.repeat(64),
    },
    inference,
  },
  input,
  warmupReceipt: null,
  diagnosis: {
    contractId: 'aura.llm-stage-result.v1',
    stage: 'diagnosis',
    status: 'completed',
    attemptId: 'attempt:v2.5:test',
    startedAt: '2026-07-19T20:00:00.000Z',
    completedAt: '2026-07-19T20:01:00.000Z',
    rawOutput,
    parsedOutput: diagnosis,
    validationErrors: [],
    metrics: null,
    error: null,
  },
  executionReceipt: receipt,
  script: null,
  automaticEvaluation: null,
  humanReview: null,
  hitl: null,
  execution: null,
  attempts: [],
};

describe('formal Diagnosis V2.5-C evidence', () => {
  it('keeps the raw alias response while scoring resolved source refs', () => {
    const result = extractCompatibleFormalDiagnosisEvidence(
      diagnosis,
      envelope,
      run,
      receipt,
    );

    expect(result.evidence.contract.contractCompliant).toBe(true);
    expect(result.resolvedDiagnosis.issues.flatMap((issue) => issue.evidenceRefs).sort())
      .toEqual(envelope.issues.flatMap((issue) => issue.evidenceRefs).sort());
    expect(result.evidence.anchors.anchoredEvidenceRefs.sort())
      .toEqual(envelope.issues.flatMap((issue) => issue.evidenceRefs).sort());
    expect(new Set(diagnosis.issues.flatMap((issue) => issue.evidenceRefs)))
      .toEqual(new Set(input.evidenceAliasMap.entries.map((entry) => entry.alias)));
  });
});
