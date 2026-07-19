import { describe, expect, it } from 'vitest';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../contracts/llm/evidenceEnvelopeV2';
import {
  buildEvidenceAliasMapV1,
  buildStableEvidenceRefV1,
} from '../contracts/llm/diagnosisEvidenceIdentityV1';

const baseReport = (): AuditReportInput => ({
  score: 80,
  rowCount: 4,
  colCount: 2,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [
    {
      id: 'issue:a',
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
      id: 'issue:b',
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
      inferredType: 'string',
      semanticType: 'name',
      distinctCount: 4,
      nullCount: 0,
      nullPercentage: 0,
      topValues: [],
      stats: {},
    },
    Age: {
      inferredType: 'number',
      semanticType: 'age',
      distinctCount: 3,
      nullCount: 1,
      nullPercentage: 25,
      topValues: [],
      stats: {},
    },
  },
  datasetProfile: {
    columns: [{ name: 'Name' }, { name: 'Age' }],
  },
});

const options = {
  privacyLevel: 'local_full' as const,
  datasetSha256: 'a'.repeat(64),
  delimiter: ',',
};

const envelopeFor = (report: AuditReportInput) => _buildEvidenceEnvelopeV2(report, options);

const sourceRefsByIssueId = (report: AuditReportInput): Record<string, string | undefined> => {
  const envelope = envelopeFor(report);
  return Object.fromEntries(
    envelope.issues.map((issue) => [issue.issueId, issue.evidenceRefs[0]]),
  );
};

const stableRefsByIssueId = (report: AuditReportInput): Record<string, string | undefined> => {
  const envelope = envelopeFor(report);
  return Object.fromEntries(
    envelope.evidence.samples.map((sample) => [
      sample.issueId,
      buildStableEvidenceRefV1(envelope, sample),
    ]),
  );
};

describe('Diagnosis V2.5-C evidence identity', () => {
  it('reproduces that ordinal source refs change when issue order changes', () => {
    const original = baseReport();
    const reordered = baseReport();
    reordered.issues = [...reordered.issues].reverse();

    expect(sourceRefsByIssueId(reordered)).not.toEqual(sourceRefsByIssueId(original));
  });

  it('keeps stable evidence identity when issue order changes', () => {
    const original = baseReport();
    const reordered = baseReport();
    reordered.issues = [...reordered.issues].reverse();

    expect(stableRefsByIssueId(reordered)).toEqual(stableRefsByIssueId(original));
  });

  it('assigns the same aliases to the same semantic evidence after reordering', () => {
    const original = buildEvidenceAliasMapV1(envelopeFor(baseReport()), 'smart_sample');
    const reorderedReport = baseReport();
    reorderedReport.issues = [...reorderedReport.issues].reverse();
    const reordered = buildEvidenceAliasMapV1(envelopeFor(reorderedReport), 'smart_sample');

    const semanticProjection = (entries: typeof original.entries) => entries.map((entry) => ({
      alias: entry.alias,
      stableEvidenceRef: entry.stableEvidenceRef,
      issueId: entry.issueId,
    }));
    expect(semanticProjection(reordered.entries)).toEqual(semanticProjection(original.entries));
  });

  it('does not expose aliases in prompt_libre', () => {
    expect(buildEvidenceAliasMapV1(envelopeFor(baseReport()), 'prompt_libre').entries).toEqual([]);
  });
});
