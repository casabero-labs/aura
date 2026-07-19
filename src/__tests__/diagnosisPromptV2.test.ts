import { describe, expect, it } from 'vitest';
import {
  buildCompactDiagnosisPromptV2,
  buildDiagnosisPromptV2,
  buildEnvelopeRef,
  canonicalJson,
  CHROME_TOKEN_BUDGET,
  estimatePromptTokens,
  shouldUseCompactPrompt,
} from '../contracts/llm/diagnosisPromptV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';

const opts = (overrides: Record<string, unknown> = {}) => ({
  privacyLevel: 'local_full' as const,
  datasetSha256: 'abc123',
  delimiter: ',',
  ...overrides,
});

const minimalReport: AuditReportInput = {
  score: 85,
  rowCount: 100,
  colCount: 5,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [
    {
      id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto',
      ruleName: 'Espacios Fantasma (Trim)', description: 'whitespace padding', severity: 'info',
      count: 2, affectedPercentage: 2, sampleValues: ['Braund, Mr. Owen Harris'],
      ruleId: 'rule:trim-whitespace',
      automaticAuthorization: {
        actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'],
        reason: 'Deterministic lossless normalization',
      },
    },
    {
      id: 'integrity-null-Age', column: 'Age', category: 'Integridad',
      ruleName: 'Valores Nulos', description: 'nulls in Age', severity: 'warning',
      count: 177, affectedPercentage: 19.9, sampleValues: [null, 22, 38],
      ruleId: 'rule:null-values',
      automaticAuthorization: {
        actionType: 'null_values', authorized: false, conditionsMet: [],
        reason: 'No auto_safe for nulls',
      },
    },
  ],
  columnStats: {
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0,
      nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {},
    },
    Age: {
      inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177,
      nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {},
    },
  },
  datasetProfile: { columns: [{ name: 'PassengerId' }, { name: 'Name' }, { name: 'Age' }] },
};

const envelope = _buildEvidenceEnvelopeV2(minimalReport, opts());

const parsePayload = (payload: string) => JSON.parse(payload) as {
  inputMode: string;
  evidenceEnvelopeRef: string;
  task: {
    requiredIssueIds: string[];
    issueIdsRequiringHumanReview: string[];
    maximumConfidence: number;
    visualizationInstruction: string;
  };
  visibleEvidence: {
    ruleActivations?: Array<Record<string, unknown>>;
    evidenceSamples?: Array<Record<string, unknown>>;
    columnStatistics?: Record<string, unknown>;
    authorizationEvidence?: Array<Record<string, unknown>>;
  };
};

describe('canonicalJson', () => {
  it('sorts object keys and preserves array order', () => {
    expect(canonicalJson({ z: [3, 1], a: { b: 1, a: 2 } }))
      .toBe('{"a":{"a":2,"b":1},"z":[3,1]}');
  });

  it('normalizes unsupported numeric values to null', () => {
    expect(canonicalJson({ nan: Number.NaN, infinite: Number.POSITIVE_INFINITY }))
      .toBe('{"infinite":null,"nan":null}');
  });
});

describe('buildEnvelopeRef', () => {
  it('is deterministic and content-addressed', () => {
    expect(buildEnvelopeRef(envelope)).toMatch(/^env:[a-f0-9]{64}$/);
    expect(buildEnvelopeRef(envelope)).toBe(buildEnvelopeRef(structuredClone(envelope)));
  });
});

describe('Diagnosis V2 compatibility adapters', () => {
  it('routes the historical builder through the canonical recommended snapshot', () => {
    const pkg = buildDiagnosisPromptV2(envelope);
    const payload = parsePayload(pkg.userPayload);

    expect(pkg).toEqual(expect.objectContaining({
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      promptVersion: '1.7.0',
      evidenceEnvelopeRef: buildEnvelopeRef(envelope),
    }));
    expect(pkg.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.inputMode).toBe('recommended');
    expect(payload.task.requiredIssueIds).toEqual(envelope.issues.map((issue) => issue.issueId));
    expect(payload.task.issueIdsRequiringHumanReview.length).toBeGreaterThan(0);
    expect(payload.task.visualizationInstruction).toContain('visualizations.issueIds');
  });

  it('routes the compact builder through smart_sample without changing coverage', () => {
    const pkg = buildCompactDiagnosisPromptV2(envelope);
    const payload = parsePayload(pkg.userPayload);
    const schema = pkg.responseSchema as {
      properties: { issues: { minItems: number; maxItems: number } };
    };

    expect(pkg.promptVersion).toBe('1.7.0');
    expect(payload.inputMode).toBe('smart_sample');
    expect(payload.task.requiredIssueIds).toEqual(envelope.issues.map((issue) => issue.issueId));
    expect(schema.properties.issues.minItems).toBe(envelope.issues.length);
    expect(schema.properties.issues.maxItems).toBe(envelope.issues.length);
  });

  it('uses the same canonical payload shape in both adapters', () => {
    const recommended = parsePayload(buildDiagnosisPromptV2(envelope).userPayload);
    const compact = parsePayload(buildCompactDiagnosisPromptV2(envelope).userPayload);

    expect(recommended.visibleEvidence.ruleActivations).toHaveLength(envelope.issues.length);
    expect(recommended.visibleEvidence.evidenceSamples?.length).toBeGreaterThan(0);
    expect(recommended.visibleEvidence.columnStatistics).toBeTypeOf('object');
    expect(recommended.visibleEvidence.authorizationEvidence).toHaveLength(envelope.issues.length);
    expect(compact.visibleEvidence.ruleActivations).toHaveLength(envelope.issues.length);
    expect(compact.visibleEvidence.evidenceSamples?.length).toBeGreaterThan(0);
    expect(compact.visibleEvidence.authorizationEvidence).toBeUndefined();
  });

  it('keeps compact smaller than recommended while preserving every issue', () => {
    const recommended = buildDiagnosisPromptV2(envelope);
    const compact = buildCompactDiagnosisPromptV2(envelope);

    expect(compact.userPayload.length).toBeLessThan(recommended.userPayload.length);
    expect(compact.promptHash).not.toBe(recommended.promptHash);
  });

  it('applies maxConfidence to task metadata and the response schema', () => {
    const pkg = buildDiagnosisPromptV2(envelope, { maxConfidence: 0.75 });
    const payload = parsePayload(pkg.userPayload);
    const schema = pkg.responseSchema as {
      properties: { issues: { items: { properties: { confidence: { maximum: number } } } } };
    };

    expect(payload.task.maximumConfidence).toBe(0.75);
    expect(schema.properties.issues.items.properties.confidence.maximum).toBe(0.75);
  });

  it('rejects invalid maxConfidence rather than emitting a contradictory contract', () => {
    expect(() => buildDiagnosisPromptV2(envelope, { maxConfidence: 2 })).toThrow(/maxConfidence/);
  });

  it('keeps prompt hashes deterministic', () => {
    expect(buildDiagnosisPromptV2(envelope).promptHash)
      .toBe(buildDiagnosisPromptV2(envelope).promptHash);
  });

  it('keeps the nested response schemas closed', () => {
    const schema = buildDiagnosisPromptV2(envelope).responseSchema as any;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.issues.items.additionalProperties).toBe(false);
    expect(schema.properties.diagnosisBlocks.items.additionalProperties).toBe(false);
    expect(schema.properties.visualizations.items.additionalProperties).toBe(false);
  });

  it('retains privacy-filtered empty samples for cloud_no_samples', () => {
    const privateEnvelope = _buildEvidenceEnvelopeV2(
      minimalReport,
      opts({ privacyLevel: 'cloud_no_samples' }),
    );
    const payload = parsePayload(buildDiagnosisPromptV2(privateEnvelope).userPayload);
    expect(payload.visibleEvidence.evidenceSamples).toEqual([]);
  });

  it('retains prompt-injection and executable-content guards', () => {
    const instruction = buildDiagnosisPromptV2(envelope).systemInstruction;
    expect(instruction).toContain('UNTRUSTED CONTENT');
    expect(instruction).toContain('NO Python');
    expect(instruction).toContain('NO eval');
    expect(instruction).toContain('MUST NOT write D3');
  });
});

describe('prompt size routing', () => {
  it('estimates one token per four characters', () => {
    expect(estimatePromptTokens('hello')).toBe(2);
    expect(estimatePromptTokens('a'.repeat(100))).toBe(25);
  });

  it('routes oversized Chrome and bounded Ollama prompts to compact mode', () => {
    expect(shouldUseCompactPrompt('a'.repeat(CHROME_TOKEN_BUDGET * 4 + 1), 'chrome')).toBe(true);
    expect(shouldUseCompactPrompt('a'.repeat(16_384 * 4), 'ollama', 16_384)).toBe(true);
    expect(shouldUseCompactPrompt('a'.repeat(100_000), 'cloud')).toBe(false);
  });
});
