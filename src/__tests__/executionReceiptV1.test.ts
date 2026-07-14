import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2, exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { buildExecutionReceiptV1, validateExecutionReceiptV1 } from '../contracts/llm/executionReceiptV1';
import type { InferenceSnapshotV1 } from '../contracts/llm/types';
import { IssueCategory, IssueSeverity, type AuditReport } from '../types';

const report: AuditReport = {
  score: 90,
  rowCount: 2,
  colCount: 1,
  duplicateRows: 0,
  delimiterDetected: ',',
  columnStats: {
    email: { name: 'email', inferredType: 'string', nullCount: 0, uniqueCount: 2, sampleValues: ['bad'] },
  },
  issues: [{
    id: 'invalid-email', column: 'email', ruleName: 'Invalid email', ruleId: 'rule:invalid-email',
    category: IssueCategory.LOGIC, description: 'Invalid.', severity: IssueSeverity.WARNING,
    count: 1, affectedPercentage: 50, sampleValues: ['bad'],
  }],
  scoreBreakdown: [],
  datasetProfile: {
    totalRows: 2, totalColumns: 1,
    columns: [{ name: 'email', cardinality: 'unique', uniqueRatio: 1, sparsity: 0, inferredType: 'string', isCandidateForCoalescence: false, pruneRecommendation: 'keep' }],
    coalescencePairs: [], pruningCandidates: [], generatedAt: '2026-07-11T00:00:00.000Z',
  },
};

const envelope = _buildEvidenceEnvelopeV2({
  ...report,
  columnStats: { email: { inferredType: 'string', distinctCount: 2, nullCount: 0, nullPercentage: 0, topValues: [], stats: {} } },
  datasetProfile: { columns: [{ name: 'email', inferredType: 'string', cardinality: 2 }] },
}, { privacyLevel: 'local_full', datasetSha256: 'a'.repeat(64), delimiter: ',' });

const inference: InferenceSnapshotV1 = {
  temperature: 0.2, topP: 0.9, numCtx: 16384, numPredict: 1600,
  think: false, seed: null, keepAlive: '10m', timeoutSeconds: 600,
};

describe('ExecutionReceiptV1', () => {
  it('certifies the exact effective package and detects tampering', () => {
    const input = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const exactPrompt = exactDiagnosisPromptV2(input);
    const receipt = buildExecutionReceiptV1({
      input, requestedInputMode: 'smart_sample', exactPrompt,
      provider: 'Ollama', requestedModel: 'model-a', observedModel: 'model-a',
      modelDigest: 'b'.repeat(64), inference,
      startedAt: '2026-07-11T00:00:00.000Z', completedAt: '2026-07-11T00:00:01.000Z',
      rawResponse: '{"contractId":"aura.diagnosis.v2"}', validationStatus: 'valid',
    });

    expect(validateExecutionReceiptV1(receipt, input, exactPrompt, inference)).toEqual({ valid: true, errors: [] });
    expect(validateExecutionReceiptV1({ ...receipt, inputHash: 'c'.repeat(64) }, input, exactPrompt, inference).valid).toBe(false);
    expect(validateExecutionReceiptV1({ ...receipt, requestedModel: 'model-b' }, input, exactPrompt, inference).valid).toBe(false);
    expect(validateExecutionReceiptV1({ ...receipt, includedSections: [] }, input, exactPrompt, inference).valid).toBe(false);
  });

  it('fails closed when requested and effective methods differ', () => {
    const input = buildDiagnosisInputPackageV2(report, envelope, 'recommended');
    expect(() => buildExecutionReceiptV1({
      input, requestedInputMode: 'prompt_libre', exactPrompt: exactDiagnosisPromptV2(input),
      provider: 'Ollama', requestedModel: 'model-a', observedModel: 'model-a', inference,
      startedAt: '2026-07-11T00:00:00.000Z', completedAt: '2026-07-11T00:00:01.000Z',
      rawResponse: '{}', validationStatus: 'invalid', validationErrorCodes: ['TRACE_INPUT_MODE_MISMATCH'],
    })).toThrow(/TRACE_INPUT_MODE_MISMATCH/);
  });

  it('rejects impossible valid and invalid receipt states at construction', () => {
    const input = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const base = {
      input, requestedInputMode: 'smart_sample' as const, exactPrompt: exactDiagnosisPromptV2(input),
      provider: 'Ollama', requestedModel: 'model-a', observedModel: 'model-a' as string | null, inference,
      startedAt: '2026-07-11T00:00:00.000Z', completedAt: '2026-07-11T00:00:01.000Z', rawResponse: '{}',
    };
    expect(() => buildExecutionReceiptV1({ ...base, observedModel: null, validationStatus: 'valid' })).toThrow(/VALID_RECEIPT_REQUIRES_OBSERVED_MODEL/);
    expect(() => buildExecutionReceiptV1({ ...base, validationStatus: 'valid', validationErrorCodes: ['ERROR'] })).toThrow(/VALID_RECEIPT_REQUIRES_EMPTY_ERROR_CODES/);
    expect(() => buildExecutionReceiptV1({ ...base, observedModel: 'model-b', validationStatus: 'valid' })).toThrow(/VALID_RECEIPT_REQUIRES_MODEL_MATCH/);
    expect(() => buildExecutionReceiptV1({ ...base, validationStatus: 'invalid', validationErrorCodes: [] })).toThrow(/INVALID_RECEIPT_REQUIRES_ERROR_CODES/);
  });

  it('certifies effective validation separately from an invalid raw response', () => {
    const input = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const exactPrompt = exactDiagnosisPromptV2(input);
    const receipt = buildExecutionReceiptV1({
      input,
      requestedInputMode: 'smart_sample',
      exactPrompt,
      provider: 'Ollama',
      requestedModel: 'model-a',
      observedModel: 'model-a',
      inference,
      startedAt: '2026-07-11T00:00:00.000Z',
      completedAt: '2026-07-11T00:00:01.000Z',
      rawResponse: '{"contractId":"aura.diagnosis.v2"}',
      validationStatus: 'valid',
      validationErrorCodes: [],
      normalizationApplied: true,
      rawValidationStatus: 'invalid',
      rawValidationErrorCodes: ['DIAGNOSIS_REVIEW_DOWNGRADE'],
    });

    expect(receipt.validationStatus).toBe('valid');
    expect(receipt.validationErrorCodes).toEqual([]);
    expect(receipt.rawValidationStatus).toBe('invalid');
    expect(receipt.rawValidationErrorCodes).toEqual(['DIAGNOSIS_REVIEW_DOWNGRADE']);
    expect(receipt.normalizationApplied).toBe(true);
    expect(validateExecutionReceiptV1(receipt, input, exactPrompt, inference)).toEqual({ valid: true, errors: [] });

    const tampered = {
      ...receipt,
      rawValidationErrorCodes: ['DIAGNOSIS_REFERENCE_INVALID'],
    };
    expect(validateExecutionReceiptV1(tampered, input, exactPrompt, inference).valid).toBe(false);
  });

  it('rejects incoherent raw validation metadata', () => {
    const input = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const base = {
      input,
      requestedInputMode: 'smart_sample' as const,
      exactPrompt: exactDiagnosisPromptV2(input),
      provider: 'Ollama',
      requestedModel: 'model-a',
      observedModel: 'model-a',
      inference,
      startedAt: '2026-07-11T00:00:00.000Z',
      completedAt: '2026-07-11T00:00:01.000Z',
      rawResponse: '{}',
      validationStatus: 'valid' as const,
    };

    expect(() => buildExecutionReceiptV1({
      ...base,
      normalizationApplied: true,
      rawValidationStatus: 'invalid',
      rawValidationErrorCodes: ['DIAGNOSIS_REFERENCE_INVALID'],
    })).toThrow(/NORMALIZED_RECEIPT_REQUIRES_REVIEW_DOWNGRADE/);

    expect(() => buildExecutionReceiptV1({
      ...base,
      rawValidationErrorCodes: ['DIAGNOSIS_REVIEW_DOWNGRADE'],
    })).toThrow(/RAW_ERROR_CODES_REQUIRE_STATUS/);

    expect(() => buildExecutionReceiptV1({
      ...base,
      rawValidationStatus: 'valid',
      rawValidationErrorCodes: ['DIAGNOSIS_REVIEW_DOWNGRADE'],
    })).toThrow(/VALID_RAW_REQUIRES_EMPTY_ERROR_CODES/);

    expect(() => buildExecutionReceiptV1({
      ...base,
      rawValidationStatus: 'invalid',
      rawValidationErrorCodes: ['DIAGNOSIS_REVIEW_DOWNGRADE'],
    })).toThrow(/INVALID_RAW_WITHOUT_NORMALIZATION/);
  });
});
