import { describe, expect, it } from 'vitest';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2_5 } from '../contracts/llm/diagnosisInputPackageV2_5';
import { processDiagnosisResponseV2_5 } from '../contracts/llm/diagnosisProjectedPipelineV2_5';
import {
  buildExecutionReceiptV1,
  validateExecutionReceiptV1,
} from '../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import type { DiagnosisResponseV2, InferenceSnapshotV1 } from '../contracts/llm/types';

const report: AuditReportInput = {
  score: 88,
  rowCount: 5,
  colCount: 1,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [{
    id: 'issue:trim',
    column: 'Name',
    ruleName: 'Whitespace',
    ruleId: 'rule:trim-whitespace',
    category: 'Higiene',
    description: 'Whitespace detected',
    severity: 'info',
    count: 2,
    affectedPercentage: 40,
    sampleValues: [' Alice ', ' Bob '],
    automaticAuthorization: {
      actionType: 'trim_whitespace',
      authorized: true,
      conditionsMet: ['string-column'],
      reason: 'Lossless normalization',
    },
  }],
  columnStats: {
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 5,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
  },
  datasetProfile: { columns: [{ name: 'Name' }] },
};
const envelope = _buildEvidenceEnvelopeV2(report, {
  privacyLevel: 'local_full',
  datasetSha256: '9'.repeat(64),
  delimiter: ',',
});
const input = buildDiagnosisInputPackageV2_5(report, envelope, 'smart_sample');
const alias = input.evidenceAliasMap.entries[0].alias;
const issue = envelope.issues[0];
const response: DiagnosisResponseV2 = {
  contractId: 'aura.diagnosis.v2',
  contractVersion: '2.0.0',
  evidenceEnvelopeRef: input.evidenceEnvelopeRef,
  responseId: 'trace:v2.5:test',
  issues: [{
    issueId: issue.issueId,
    evidenceRefs: [alias],
    hypothesis: 'Whitespace is present in the visible sample.',
    confidence: 0.8,
    requiresHumanReview: true,
    limits: [],
  }],
  diagnosisBlocks: [{
    issueId: issue.issueId,
    ruleId: issue.ruleId,
    columnId: issue.columnId,
    scope: issue.scope,
    observation: 'Whitespace was detected.',
    recommendation: 'Review normalization with the dataset owner.',
  }],
  limitations: [],
  generatedAt: '2026-07-19T23:00:00.000Z',
};
const raw = JSON.stringify(response);
const inference: InferenceSnapshotV1 = {
  temperature: 0.1,
  topP: 0.9,
  numCtx: 16384,
  numPredict: 4096,
  think: false,
  seed: null,
  keepAlive: '10m',
  timeoutSeconds: 600,
};

describe('Diagnosis V2.5-C stable trace', () => {
  it('keeps raw aliases, source refs and stable refs in separate views', () => {
    const outcome = processDiagnosisResponseV2_5(envelope, raw, input);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    expect(outcome.rawResponse.issues[0].evidenceRefs).toEqual([alias]);
    expect(outcome.response.issues[0].evidenceRefs).toEqual(issue.evidenceRefs);
    expect(outcome.evidenceResolution?.stableDiagnosis.issues[0].evidenceRefs)
      .toEqual([input.evidenceAliasMap.entries[0].stableEvidenceRef]);
    expect(outcome.evidenceResolution?.resolvedCitationsHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('derives and validates the same resolution hash in the receipt', () => {
    const outcome = processDiagnosisResponseV2_5(envelope, raw, input);
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    const receipt = buildExecutionReceiptV1({
      input,
      requestedInputMode: input.inputMode,
      exactPrompt: exactDiagnosisPromptV2(input),
      provider: 'test',
      requestedModel: 'model:test',
      observedModel: 'model:test',
      modelDigest: null,
      inference,
      startedAt: '2026-07-19T23:00:00.000Z',
      completedAt: '2026-07-19T23:00:01.000Z',
      rawResponse: raw,
      validationStatus: 'valid',
      validationErrorCodes: [],
    });

    expect(receipt.evidenceAliasContract).toBe('aura.evidence-alias.v1');
    expect(receipt.evidenceAliasMapHash).toBe(input.evidenceAliasMapHash);
    expect(receipt.projectionHash).toBe(input.projectionHash);
    expect(receipt.resolvedCitationsHash)
      .toBe(outcome.evidenceResolution?.resolvedCitationsHash);
    expect(validateExecutionReceiptV1(
      receipt,
      input,
      exactDiagnosisPromptV2(input),
      inference,
    ).valid).toBe(true);
  });

  it('detects a mutated alias-map trace in the receipt', () => {
    const receipt = buildExecutionReceiptV1({
      input,
      requestedInputMode: input.inputMode,
      exactPrompt: exactDiagnosisPromptV2(input),
      provider: 'test',
      requestedModel: 'model:test',
      observedModel: 'model:test',
      inference,
      startedAt: '2026-07-19T23:00:00.000Z',
      completedAt: '2026-07-19T23:00:01.000Z',
      rawResponse: raw,
      validationStatus: 'valid',
      validationErrorCodes: [],
    });
    const mutated = {
      ...receipt,
      evidenceAliasMapHash: '0'.repeat(64),
    };

    const validation = validateExecutionReceiptV1(
      mutated,
      input,
      exactDiagnosisPromptV2(input),
      inference,
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      'evidence alias map hash mismatch',
      'receipt hash mismatch',
    ]));
  });
});
