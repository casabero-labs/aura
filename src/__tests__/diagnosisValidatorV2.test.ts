/**
 * Diagnosis Validator v2 — Unit Tests.
 *
 * Tests: validateDiagnosisResponseV2 against envelope.
 */

import { describe, it, expect } from 'vitest';
import { validateDiagnosisResponseV2 } from '../contracts/llm/diagnosisValidatorV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { DiagnosisResponseV2 } from '../contracts/llm/types';

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

const envelope = _buildEvidenceEnvelopeV2(minimalReport, opts({ privacyLevel: 'local_full' }));
const envRef = 'env:test123';

// Get the actual envelope issue IDs and column IDs for valid references
const issue1 = envelope.issues[0];
const issue2 = envelope.issues[1];
const col1 = envelope.columns.find(c => c.name === 'Name')!;
const validEvRef = issue1.evidenceRefs[0] || issue2.evidenceRefs[0];

function validResponse(overrides: Partial<DiagnosisResponseV2> = {}): DiagnosisResponseV2 {
  return {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: envRef,
    responseId: 'diag-001',
    issues: [
      {
        issueId: issue1.issueId,
        evidenceRefs: issue1.evidenceRefs,
        hypothesis: 'Leading/trailing whitespace from data entry',
        confidence: 0.9,
        requiresHumanReview: false,
        limits: ['Limited to string columns'],
      },
      {
        issueId: issue2.issueId,
        evidenceRefs: issue2.evidenceRefs,
        hypothesis: 'Missing age data in survey responses',
        confidence: 0.7,
        requiresHumanReview: true,
        limits: ['Null values may be random or structural'],
      },
    ],
    diagnosisBlocks: [
      {
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: col1.columnId,
        scope: 'column',
        observation: '2 values have whitespace',
        recommendation: 'Consider trimming at ingestion',
      },
      {
        issueId: issue2.issueId,
        ruleId: issue2.ruleId,
        columnId: null,
        scope: 'dataset',
        observation: '177 null values in Age column',
        recommendation: 'Investigate data collection process',
      },
    ],
    limitations: ['Analysis based on provided evidence'],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ──

describe('validateDiagnosisResponseV2 — valid cases', () => {
  it('validates a correct response', () => {
    const result = validateDiagnosisResponseV2(validResponse(), envelope);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts requiresHumanReview=true for review_only issue', () => {
    const resp = validResponse({
      issues: validResponse().issues.map(i => ({
        ...i,
        requiresHumanReview: true,
      })),
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(true);
  });
});

describe('validateDiagnosisResponseV2 — reference errors', () => {
  it('rejects non-existent issueId', () => {
    const resp = validResponse({
      issues: [{ issueId: 'nonexistent', evidenceRefs: [], hypothesis: 'x', confidence: 0.5, requiresHumanReview: true, limits: [] }],
      diagnosisBlocks: [{ issueId: 'nonexistent', ruleId: issue1.ruleId, columnId: null, scope: 'dataset', observation: 'x', recommendation: 'x' }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true);
  });

  it('rejects non-existent ruleId', () => {
    const resp = validResponse({
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: 'rule:nonexistent-rule',
        columnId: null,
        scope: 'dataset',
        observation: 'x',
        recommendation: 'x',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects non-existent columnId', () => {
    const resp = validResponse({
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: 'col:nonexistent',
        scope: 'column',
        observation: 'x',
        recommendation: 'x',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects non-existent evidenceRef', () => {
    const resp = validResponse({
      issues: [{
        issueId: issue1.issueId,
        evidenceRefs: ['ref:does-not-exist'],
        hypothesis: 'x',
        confidence: 0.5,
        requiresHumanReview: true,
        limits: [],
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate issueIds', () => {
    const resp = validResponse({
      issues: [
        { issueId: issue1.issueId, evidenceRefs: [], hypothesis: 'a', confidence: 0.5, requiresHumanReview: true, limits: [] },
        { issueId: issue1.issueId, evidenceRefs: [], hypothesis: 'b', confidence: 0.5, requiresHumanReview: true, limits: [] },
      ],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });
});

describe('validateDiagnosisResponseV2 — contract identity', () => {
  it('rejects wrong contractId', () => {
    const resp = validResponse({ contractId: 'aura.evidence.v2' as any });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects wrong contractVersion', () => {
    const resp = validResponse({ contractVersion: '1.0.0' as any });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects empty responseId', () => {
    const resp = validResponse({ responseId: '' });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });
});

describe('validateDiagnosisResponseV2 — confidence', () => {
  it('rejects negative confidence', () => {
    const resp = validResponse({
      issues: [{ issueId: issue1.issueId, evidenceRefs: [], hypothesis: 'x', confidence: -0.1, requiresHumanReview: true, limits: [] }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects confidence > 1', () => {
    const resp = validResponse({
      issues: [{ issueId: issue1.issueId, evidenceRefs: [], hypothesis: 'x', confidence: 1.5, requiresHumanReview: true, limits: [] }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('accepts confidence 0', () => {
    const resp = validResponse({
      issues: [{
        issueId: issue1.issueId,
        evidenceRefs: [],
        hypothesis: 'x',
        confidence: 0,
        requiresHumanReview: true,
        limits: [],
      }],
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: null,
        scope: 'dataset',
        observation: 'x',
        recommendation: 'x',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    // confidence 0 is valid; requiresHumanReview=true meets requirement
    expect(result.valid).toBe(true);
  });
});

describe('validateDiagnosisResponseV2 — scope coherence', () => {
  it('rejects dataset scope with non-null columnId', () => {
    const resp = validResponse({
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: col1.columnId,
        scope: 'dataset',
        observation: 'x',
        recommendation: 'x',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects column scope with null columnId', () => {
    const resp = validResponse({
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: null,
        scope: 'column',
        observation: 'x',
        recommendation: 'x',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });
});

describe('validateDiagnosisResponseV2 — executable content', () => {
  it('rejects Python code in hypothesis', () => {
    const resp = validResponse({
      issues: [{ issueId: issue1.issueId, evidenceRefs: [], hypothesis: 'Use pandas.DataFrame.dropna()', confidence: 0.5, requiresHumanReview: true, limits: [] }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('executable'))).toBe(true);
  });

  it('rejects import os in recommendation', () => {
    const resp = validResponse({
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: null,
        scope: 'dataset',
        observation: 'Nothing',
        recommendation: 'Try: import os; os.system("rm file")',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });

  it('rejects eval in observation', () => {
    const resp = validResponse({
      diagnosisBlocks: [{
        issueId: issue1.issueId,
        ruleId: issue1.ruleId,
        columnId: null,
        scope: 'dataset',
        observation: 'Use eval() to compute',
        recommendation: 'Just clean the data',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });
});

describe('validateDiagnosisResponseV2 — orphaned blocks', () => {
  it('rejects block referencing issue not in response', () => {
    const resp = validResponse({
      // Keep original issues (no new ones)
      diagnosisBlocks: [{
        issueId: 'some-orphan-id',
        ruleId: issue1.ruleId,
        columnId: null,
        scope: 'dataset',
        observation: 'x',
        recommendation: 'x',
      }],
    });
    const result = validateDiagnosisResponseV2(resp, envelope);
    expect(result.valid).toBe(false);
  });
});
