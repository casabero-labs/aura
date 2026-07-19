/**
 * Diagnosis Prompt v2 architecture tests.
 *
 * The canonical input snapshot is the only payload builder. Historical public
 * names are compatibility adapters and must delegate to a canonical input mode.
 */

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
import {
  buildDiagnosisInputPackageV2,
  diagnosisInputReportFromEnvelope,
  exactDiagnosisPromptV2,
} from '../contracts/llm/diagnosisInputPackageV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';

const opts = (overrides: Record<string, unknown> = {}) => ({
  privacyLevel: 'local_full' as const,
  datasetSha256: 'a'.repeat(64),
  delimiter: ',',
  ...overrides,
});

const minimalReport: AuditReportInput = {
  score: 85,
  rowCount: 100,
  colCount: 3,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [
    {
      id: 'hygiene-ghost-Name',
      column: 'Name',
      category: 'Higiene de Texto',
      ruleName: 'Espacios Fantasma (Trim)',
      description: 'whitespace padding',
      severity: 'info',
      count: 2,
      affectedPercentage: 2,
      sampleValues: ['Braund, Mr. Owen Harris'],
      ruleId: 'rule:trim-whitespace',
      automaticAuthorization: {
        actionType: 'trim_whitespace',
        authorized: true,
        conditionsMet: ['string-column'],
        reason: 'Deterministic lossless normalization',
      },
    },
    {
      id: 'integrity-null-Age',
      column: 'Age',
      category: 'Integridad',
      ruleName: 'Valores Nulos',
      description: 'nulls in Age',
      severity: 'warning',
      count: 17,
      affectedPercentage: 17,
      sampleValues: [null, 22, 38],
      ruleId: 'rule:null-values',
      automaticAuthorization: {
        actionType: 'null_values',
        authorized: false,
        conditionsMet: [],
        reason: 'No auto_safe for nulls',
      },
    },
  ],
  columnStats: {
    PassengerId: {
      inferredType: 'number', semanticType: 'identifier', distinctCount: 100,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 89,
      nullCount: 0, nullPercentage: 0,
      topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {},
    },
    Age: {
      inferredType: 'number', semanticType: 'age', distinctCount: 88,
      nullCount: 17, nullPercentage: 17,
      topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {},
    },
  },
  datasetProfile: {
    columns: [
      { name: 'PassengerId', inferredType: 'number', semanticType: 'identifier' },
      { name: 'Name', inferredType: 'string', semanticType: 'name' },
      { name: 'Age', inferredType: 'number', semanticType: 'age' },
    ],
  },
};

const envelope = _buildEvidenceEnvelopeV2(minimalReport, opts());

const parsePayload = (payload: string) => JSON.parse(payload) as {
  inputMode: string;
  evidenceEnvelopeRef: string;
  visibleEvidence: Record<string, unknown>;
  task: {
    requiredIssueIds: string[];
    issueIdsRequiringHumanReview: string[];
    samplesVisible: boolean;
    maxConfidence: number;
    whenSamplesAreHidden?: {
      evidenceRefsMustBeEmpty: boolean;
      requiresHumanReviewMustBeTrue: boolean;
      declareEvidenceLimitation: boolean;
    };
  };
};

describe('canonicalJson', () => {
  it('is stable across object insertion order and preserves array order', () => {
    expect(canonicalJson({ z: 1, a: [3, 1, 2] }))
      .toBe(canonicalJson({ a: [3, 1, 2], z: 1 }));
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('normalizes non-finite numbers to null', () => {
    expect(canonicalJson(NaN)).toBe('null');
    expect(canonicalJson(Infinity)).toBe('null');
  });
});

describe('buildEnvelopeRef', () => {
  it('is deterministic and uses env:<sha256>', () => {
    const sameEnvelope = _buildEvidenceEnvelopeV2(minimalReport, opts());
    expect(buildEnvelopeRef(envelope)).toMatch(/^env:[a-f0-9]{64}$/);
    expect(buildEnvelopeRef(envelope)).toBe(buildEnvelopeRef(sameEnvelope));
  });
});

describe('buildDiagnosisInputPackageV2', () => {
  it('builds a frozen, hashed canonical snapshot', () => {
    const input = buildDiagnosisInputPackageV2(minimalReport, envelope, 'smart_sample');
    expect(input.contractId).toBe('aura.input-snapshot.v2');
    expect(input.promptVersion).toBe('1.7.0');
    expect(input.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(input.responseSchemaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(input.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.responseSchema)).toBe(true);
    expect(exactDiagnosisPromptV2(input)).toContain('=== INPUT EVIDENCE ===');
  });

  it('projects exactly the declared sections for every mode', () => {
    const free = buildDiagnosisInputPackageV2(minimalReport, envelope, 'prompt_libre');
    const smart = buildDiagnosisInputPackageV2(minimalReport, envelope, 'smart_sample');
    const recommended = buildDiagnosisInputPackageV2(minimalReport, envelope, 'recommended');

    expect(free.includedSections).toHaveLength(3);
    expect(smart.includedSections).toHaveLength(6);
    expect(recommended.includedSections).toHaveLength(12);

    expect(Object.keys(parsePayload(free.userPayload).visibleEvidence).sort()).toEqual([
      'datasetSchema', 'datasetSummary', 'issueRegistryMinimal',
    ]);
    expect(parsePayload(smart.userPayload).visibleEvidence).toHaveProperty('evidenceSamples');
    expect(parsePayload(recommended.userPayload).visibleEvidence).toHaveProperty('badSampleAnchors');
  });

  it('always emits trusted task metadata', () => {
    for (const mode of ['prompt_libre', 'smart_sample', 'recommended'] as const) {
      const payload = parsePayload(buildDiagnosisInputPackageV2(minimalReport, envelope, mode).userPayload);
      expect(payload.task.requiredIssueIds).toEqual(envelope.issues.map((issue) => issue.issueId));
      expect(Array.isArray(payload.task.issueIdsRequiringHumanReview)).toBe(true);
      expect(payload.task.samplesVisible).toBe(mode !== 'prompt_libre');
    }
  });

  it('encodes hidden-sample obligations in prompt_libre', () => {
    const payload = parsePayload(
      buildDiagnosisInputPackageV2(minimalReport, envelope, 'prompt_libre').userPayload,
    );
    expect(payload.task.whenSamplesAreHidden).toEqual({
      evidenceRefsMustBeEmpty: true,
      requiresHumanReviewMustBeTrue: true,
      declareEvidenceLimitation: true,
    });
  });

  it('applies maxConfidence to task metadata and response schema', () => {
    const input = buildDiagnosisInputPackageV2(
      minimalReport,
      envelope,
      'smart_sample',
      { maxConfidence: 0.75 },
    );
    const payload = parsePayload(input.userPayload);
    const schema = input.responseSchema as any;
    expect(payload.task.maxConfidence).toBe(0.75);
    expect(schema.properties.issues.items.properties.confidence.maximum).toBe(0.75);
  });
});

describe('legacy compatibility facade', () => {
  it('buildDiagnosisPromptV2 delegates to canonical smart_sample', () => {
    const legacy = buildDiagnosisPromptV2(envelope);
    const canonical = buildDiagnosisInputPackageV2(
      diagnosisInputReportFromEnvelope(envelope),
      envelope,
      'smart_sample',
    );
    expect(legacy.promptHash).toBe(canonical.promptHash);
    expect(legacy.userPayload).toBe(canonical.userPayload);
    expect(parsePayload(legacy.userPayload).inputMode).toBe('smart_sample');
  });

  it('buildCompactDiagnosisPromptV2 delegates to safe prompt_libre', () => {
    const compact = buildCompactDiagnosisPromptV2(envelope);
    const canonical = buildDiagnosisInputPackageV2(
      diagnosisInputReportFromEnvelope(envelope),
      envelope,
      'prompt_libre',
    );
    expect(compact.promptHash).toBe(canonical.promptHash);
    expect(compact.userPayload).toBe(canonical.userPayload);
    expect(parsePayload(compact.userPayload).inputMode).toBe('prompt_libre');
  });

  it('compact compatibility preserves exact coverage beyond ten issues', () => {
    const manyIssueReport: AuditReportInput = {
      ...minimalReport,
      issues: Array.from({ length: 12 }, (_, index) => ({
        ...minimalReport.issues[0],
        id: `trim-name-${index}`,
        count: index + 1,
        affectedPercentage: index + 1,
      })),
    };
    const manyEnvelope = _buildEvidenceEnvelopeV2(manyIssueReport, opts());
    const compact = buildCompactDiagnosisPromptV2(manyEnvelope);
    const payload = parsePayload(compact.userPayload);
    const schema = compact.responseSchema as any;

    expect(payload.task.requiredIssueIds).toHaveLength(12);
    expect(schema.properties.issues.minItems).toBe(12);
    expect(schema.properties.issues.maxItems).toBe(12);
    expect(schema.properties.diagnosisBlocks.minItems).toBe(12);
    expect(schema.properties.diagnosisBlocks.maxItems).toBe(12);
  });
});

describe('token estimation compatibility utilities', () => {
  it('estimates tokens as ceil(chars / 4)', () => {
    expect(estimatePromptTokens('hello')).toBe(2);
    expect(estimatePromptTokens('a'.repeat(100))).toBe(25);
  });

  it('retains legacy budget detection without constructing a second payload', () => {
    const largePrompt = 'a'.repeat(CHROME_TOKEN_BUDGET * 4 + 1);
    expect(shouldUseCompactPrompt(largePrompt, 'chrome')).toBe(true);
    expect(shouldUseCompactPrompt('small', 'cloud')).toBe(false);
  });
});
