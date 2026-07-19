import { describe, expect, it } from 'vitest';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../contracts/llm/evidenceEnvelopeV2';

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

const refByIssueId = (report: AuditReportInput): Record<string, string | undefined> => {
  const envelope = _buildEvidenceEnvelopeV2(report, options);
  return Object.fromEntries(
    envelope.issues.map((issue) => [issue.issueId, issue.evidenceRefs[0]]),
  );
};

describe('Diagnosis V2.5-C evidence identity reproduction', () => {
  it('keeps the same evidence identity when issue order changes', () => {
    const original = baseReport();
    const reordered = baseReport();
    reordered.issues = [...reordered.issues].reverse();

    expect(refByIssueId(reordered)).toEqual(refByIssueId(original));
  });
});
