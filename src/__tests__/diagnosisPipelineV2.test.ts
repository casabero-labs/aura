/**
 * Diagnosis Pipeline v2 — Unit Tests.
 *
 * Tests: runDiagnosisPipeline, diagnoseWithV2, DiagnosisAdapter.
 * Tests flag behavior, adapter gating, schema safety, and HITL enforcement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock contractRegistry BEFORE importing the pipeline
vi.mock('../contracts/llm/contractRegistry', () => ({
  isContractsV2Enabled: vi.fn(),
}));

import { runDiagnosisPipeline, diagnoseWithV2, type DiagnosisAdapter } from '../contracts/llm/diagnosisPipelineV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { buildEnvelopeRef, buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import { isContractsV2Enabled } from '../contracts/llm/contractRegistry';

// ── Fixtures ──

const opts = (overrides: Record<string, unknown> = {}) => ({
  privacyLevel: 'local_full' as const,
  datasetSha256: 'abc123',
  delimiter: ',',
  ...overrides,
});

const minimalReport: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto', ruleName: 'Espacios Fantasma', description: 'whitespace', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['test'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic lossless normalization' } },
    { id: 'integrity-null-Age', column: 'Age', category: 'Integridad', ruleName: 'Valores Nulos', description: 'nulls', severity: 'warning', count: 177, affectedPercentage: 19.9, sampleValues: [null, 22], ruleId: 'rule:null-values', automaticAuthorization: { actionType: 'null_values', authorized: false, conditionsMet: [], reason: 'No auto_safe for nulls' } },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} },
    Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
  },
  datasetProfile: { columns: [{ name: 'PassengerId' }, { name: 'Name' }, { name: 'Age' }] },
};

const envelope = _buildEvidenceEnvelopeV2(minimalReport, opts());
const envRef = buildEnvelopeRef(envelope);
const issue1 = envelope.issues[0];
const issue2 = envelope.issues[1];
const promptPackage = buildDiagnosisPromptV2(envelope);

// Mock adapter helpers

function mockAdapter(validResponse: object): DiagnosisAdapter {
  return async () => JSON.stringify(validResponse);
}

function brokenAdapter(): DiagnosisAdapter {
  return async () => { throw new Error('Adapter network failure'); };
}

function validResponseForEnvelope() {
  return {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: envRef,
    responseId: 'diag-001',
    issues: [
      {
        issueId: issue1.issueId,
        evidenceRefs: issue1.evidenceRefs,
        hypothesis: 'Whitespace in Name',
        confidence: 0.9,
        requiresHumanReview: true, // Name column is ambiguous → must be true
        limits: [],
      },
      {
        issueId: issue2.issueId,
        evidenceRefs: issue2.evidenceRefs,
        hypothesis: 'Missing age values',
        confidence: 0.7,
        requiresHumanReview: true,
        limits: [],
      },
    ],
    diagnosisBlocks: [
      {
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: issue1.columnId,
        scope: issue1.scope,
        observation: '2 whitespace values detected',
        recommendation: 'Trim whitespace at ingestion',
      },
      {
        issueId: issue2.issueId,
        ruleId: issue2.ruleId,
        columnId: issue2.columnId,
        scope: issue2.scope,
        observation: '177 null values',
        recommendation: 'Investigate collection process',
      },
    ],
    limitations: [],
    generatedAt: new Date().toISOString(),
  };
}

// ── Tests ──

describe('runDiagnosisPipeline — imports and execution', () => {
  it('imports and runs without crashing (flag may be true or false)', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    const result = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter(validResponseForEnvelope()));
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });
});

describe('runDiagnosisPipeline — flag integration', () => {
  it('returns CONTRACTS_V2_DISABLED when flag is false', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(false);
    const result = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter({}));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('CONTRACTS_V2_DISABLED');
  });

  it('does not call adapter when flag is false', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(false);
    let adapterCalled = false;
    const trackingAdapter: DiagnosisAdapter = async () => { adapterCalled = true; return '{}'; };
    await runDiagnosisPipeline(envelope, promptPackage, trackingAdapter);
    expect(adapterCalled).toBe(false);
  });

  it('calls adapter when flag is true', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    let adapterCalled = false;
    const trackingAdapter: DiagnosisAdapter = async () => { adapterCalled = true; return JSON.stringify(validResponseForEnvelope()); };
    await runDiagnosisPipeline(envelope, promptPackage, trackingAdapter);
    expect(adapterCalled).toBe(true);
  });
});

describe('runDiagnosisPipeline — schema safety', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('rejects issues:[null] with DIAGNOSIS_SCHEMA_INVALID', async () => {
    const result = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter({
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: envRef,
      responseId: 'diag-001',
      issues: [null],
      diagnosisBlocks: [],
      limitations: [],
      generatedAt: new Date().toISOString(),
    }));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_SCHEMA_INVALID');
  });

  it('rejects issues:["x"] with DIAGNOSIS_SCHEMA_INVALID', async () => {
    const result = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter({
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: envRef,
      responseId: 'diag-001',
      issues: ['x'],
      diagnosisBlocks: [],
      limitations: [],
      generatedAt: new Date().toISOString(),
    }));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_SCHEMA_INVALID');
  });

  it('rejects diagnosisBlocks:[null] with DIAGNOSIS_SCHEMA_INVALID', async () => {
    const result = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter({
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: envRef,
      responseId: 'diag-001',
      issues: [{ issueId: issue1.issueId, evidenceRefs: issue1.evidenceRefs, hypothesis: 'x', confidence: 0.5, requiresHumanReview: false, limits: [] }],
      diagnosisBlocks: [null],
      limitations: [],
      generatedAt: new Date().toISOString(),
    }));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_SCHEMA_INVALID');
  });

  it('rejects primitive issue items with structured error (not TypeError)', async () => {
    const result = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter({
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: envRef,
      responseId: 'diag-001',
      issues: [42],
      diagnosisBlocks: [],
      limitations: [],
      generatedAt: new Date().toISOString(),
    }));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_SCHEMA_INVALID');
  });

  it('returns DIAGNOSIS_SCHEMA_INVALID for invalid JSON', async () => {
    const badAdapter: DiagnosisAdapter = async () => 'not json {{{';
    const result = await runDiagnosisPipeline(envelope, promptPackage, badAdapter);
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_JSON_INVALID');
  });
});

describe('runDiagnosisPipeline — adapter error handling', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('returns DIAGNOSIS_ADAPTER_ERROR when adapter throws', async () => {
    const result = await runDiagnosisPipeline(envelope, promptPackage, brokenAdapter());
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });

  it('returns DIAGNOSIS_ADAPTER_ERROR when adapter returns non-string', async () => {
    const result = await runDiagnosisPipeline(envelope, promptPackage, async () => ({ raw: 'not a string' }) as any);
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });
});

describe('diagnoseWithV2', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('returns structured outcome when flag is true and adapter returns valid response', async () => {
    const result = await diagnoseWithV2(envelope, mockAdapter(validResponseForEnvelope()));
    expect(result.success).toBe(true);
  });

  it('returns CONTRACTS_V2_DISABLED when flag is false', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(false);
    const result = await diagnoseWithV2(envelope, mockAdapter({}));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('CONTRACTS_V2_DISABLED');
  });
});

describe('HITL — ambiguous column forces review before auto_safe check', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('rejects requiresHumanReview=false for ambiguous column even with auto_safe authorized=true', async () => {
    // 'name' matches AMBIGUOUS_PATTERNS regex (case-insensitive)
    const ambiguousReport: AuditReportInput = {
      score: 80, rowCount: 50, colCount: 2, duplicateRows: 0, delimiterDetected: ',',
      issues: [
        { id: 'col-ambiguous', column: 'name', category: 'Columna Ambigua', ruleName: 'Ambiguous Column', description: 'ambiguous', severity: 'warning', count: 1, affectedPercentage: 100, sampleValues: ['x'], ruleId: 'rule:ambiguous-column', automaticAuthorization: { actionType: 'review_column', authorized: true, conditionsMet: [], reason: 'Ambiguous name' } },
      ],
      columnStats: { name: { inferredType: 'string', semanticType: 'unknown', distinctCount: 1, nullCount: 0, nullPercentage: 0, topValues: [], stats: {} } },
      datasetProfile: { columns: [{ name: 'name' }] },
    };
    const ambEnvelope = _buildEvidenceEnvelopeV2(ambiguousReport, opts());
    const ambIssue = ambEnvelope.issues[0];
    const ambCol = ambEnvelope.columns.find(c => c.columnId === ambIssue.columnId);
    expect(ambCol?.isAmbiguous).toBe(true);

    const ambPrompt = buildDiagnosisPromptV2(ambEnvelope);

    const resp = {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: buildEnvelopeRef(ambEnvelope),
      responseId: 'diag-amb',
      issues: [{
        issueId: ambIssue.issueId,
        evidenceRefs: ambIssue.evidenceRefs,
        hypothesis: 'Ambiguous column name',
        confidence: 0.5,
        requiresHumanReview: false, // WRONG — column is ambiguous
        limits: [],
      }],
      diagnosisBlocks: [{
        issueId: ambIssue.issueId,
        ruleId: ambIssue.ruleId,
        columnId: ambIssue.columnId,
        scope: ambIssue.scope,
        observation: 'Column name is ambiguous',
        recommendation: 'Rename column to be descriptive',
      }],
      limitations: [],
      generatedAt: new Date().toISOString(),
    };

    const result = await runDiagnosisPipeline(ambEnvelope, ambPrompt, mockAdapter(resp));
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_REVIEW_DOWNGRADE');
  });
});
