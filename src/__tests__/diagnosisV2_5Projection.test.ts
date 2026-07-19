import { describe, expect, it } from 'vitest';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../contracts/llm/evidenceEnvelopeV2';
import {
  buildDiagnosisInputPackageV2_5,
  validateDiagnosisInputSnapshotIntegrityV2_5,
} from '../contracts/llm/diagnosisInputPackageV2_5';
import {
  processDiagnosisResponseV2_5,
} from '../contracts/llm/diagnosisProjectedPipelineV2_5';
import type { DiagnosisResponseV2 } from '../contracts/llm/types';

const report: AuditReportInput = {
  score: 70,
  rowCount: 10,
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
      count: 2,
      affectedPercentage: 20,
      sampleValues: [' Alice ', ' Bob '],
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
      affectedPercentage: 10,
      sampleValues: [null],
    },
  ],
  columnStats: {
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 8,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
    Age: {
      inferredType: 'number', semanticType: 'age', distinctCount: 9,
      nullCount: 1, nullPercentage: 10, topValues: [], stats: {},
    },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
};

const envelope = _buildEvidenceEnvelopeV2(report, {
  privacyLevel: 'local_full',
  datasetSha256: 'b'.repeat(64),
  delimiter: ',',
});

const buildInput = (mode: 'prompt_libre' | 'smart_sample' | 'recommended' = 'smart_sample') =>
  buildDiagnosisInputPackageV2_5(report, envelope, mode);

const responseFor = (input = buildInput()): DiagnosisResponseV2 => {
  const aliasesByIssue = new Map<string, string[]>();
  for (const entry of input.evidenceAliasMap.entries) {
    aliasesByIssue.set(entry.issueId, [
      ...(aliasesByIssue.get(entry.issueId) ?? []),
      entry.alias,
    ]);
  }
  return {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: input.evidenceEnvelopeRef,
    responseId: 'response:v2.5:test',
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
      recommendation: 'Review the deterministic finding with the dataset owner',
    })),
    limitations: [],
    generatedAt: '2026-07-19T20:00:00.000Z',
  };
};

describe('Diagnosis V2.5-C projected input', () => {
  it('keeps internal refs out of the prompt while retaining them in the snapshot map', () => {
    const input = buildInput('recommended');

    expect(input.evidenceAliasMap.entries.length).toBeGreaterThan(0);
    expect(input.userPayload).not.toContain('ev-0000');
    expect(input.userPayload).not.toContain('ev:v1:');
    expect(input.userPayload).toContain('"evidenceReferenceMode":"aura.evidence-alias.v1"');
    expect(input.responseSchema).toEqual(expect.objectContaining({ type: 'object' }));
  });

  it('is deterministic for the same envelope and mode', () => {
    expect(buildInput()).toEqual(buildInput());
  });

  it('produces an empty alias map and zero evidence refs for prompt_libre', () => {
    const input = buildInput('prompt_libre');
    const schema = input.responseSchema as any;

    expect(input.evidenceAliasMap.entries).toEqual([]);
    expect(schema.properties.issues.items.properties.evidenceRefs.maxItems).toBe(0);
  });

  it('accepts an intact snapshot and rejects a mutated projection', () => {
    const input = buildInput();
    expect(validateDiagnosisInputSnapshotIntegrityV2_5(input, envelope).valid).toBe(true);

    const tampered = {
      ...input,
      userPayload: input.userPayload.replace('"e1"', '"e999"'),
    };
    const result = validateDiagnosisInputSnapshotIntegrityV2_5(tampered, envelope);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code.includes('HASH_MISMATCH')
      || error.code === 'DIAGNOSIS_INPUT_SNAPSHOT_INVALID')).toBe(true);
  });
});

describe('Diagnosis V2.5-C projected pipeline', () => {
  it('resolves valid aliases to the source refs expected by downstream V2', () => {
    const input = buildInput();
    const response = responseFor(input);
    const result = processDiagnosisResponseV2_5(envelope, JSON.stringify(response), input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.response.issues.flatMap((issue) => issue.evidenceRefs))
      .toEqual(envelope.issues.flatMap((issue) => issue.evidenceRefs));
    expect(result.rawResponse.issues.flatMap((issue) => issue.evidenceRefs))
      .toEqual(response.issues.flatMap((issue) => issue.evidenceRefs));
    expect(result.evidenceResolution?.citations.length)
      .toBe(input.evidenceAliasMap.entries.length);
  });

  it('rejects an alias assigned to another issue', () => {
    const input = buildInput();
    const response = responseFor(input);
    const firstAlias = input.evidenceAliasMap.entries[0];
    const otherIssueIndex = response.issues.findIndex((issue) => issue.issueId !== firstAlias.issueId);
    response.issues[otherIssueIndex] = {
      ...response.issues[otherIssueIndex],
      evidenceRefs: [firstAlias.alias],
    };

    const result = processDiagnosisResponseV2_5(envelope, JSON.stringify(response), input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('DIAGNOSIS_REFERENCE_INVALID');
    expect(JSON.stringify(result.details)).toContain('DIAGNOSIS_ALIAS_PROJECTION_MISMATCH');
  });

  it('rejects internal or invented refs when the contract expects aliases', () => {
    const input = buildInput();
    const response = responseFor(input);
    response.issues[0] = {
      ...response.issues[0],
      evidenceRefs: [envelope.issues[0].evidenceRefs[0]],
    };

    const result = processDiagnosisResponseV2_5(envelope, JSON.stringify(response), input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.details)).toContain('DIAGNOSIS_ALIAS_REFERENCE_INVALID');
  });

  it('rejects any evidence alias in prompt_libre', () => {
    const input = buildInput('prompt_libre');
    const response = responseFor(input);
    response.issues[0] = { ...response.issues[0], evidenceRefs: ['e1'] };

    const result = processDiagnosisResponseV2_5(envelope, JSON.stringify(response), input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(JSON.stringify(result.details)).toContain('DIAGNOSIS_ALIAS_REFERENCE_INVALID');
  });
});
