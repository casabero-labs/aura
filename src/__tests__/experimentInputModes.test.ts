import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildEnvelopeRef } from '../contracts/llm/diagnosisPromptV2';
import {
  buildExperimentInputPackage,
  OE4_INCLUDED_SECTIONS_BY_MODE,
} from '../services/benchmark/experimentInputModes';
import { exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { OE4_INPUT_MODES } from '../services/benchmark/finalEvaluationProtocol';
import type { AuditReport } from '../types';
import { IssueCategory, IssueSeverity } from '../types';

const report: AuditReport = {
  score: 71,
  rowCount: 50,
  colCount: 3,
  duplicateRows: 0,
  delimiterDetected: ',',
  columnStats: {
    customer_id: {
      name: 'customer_id',
      inferredType: 'string',
      nullCount: 0,
      uniqueCount: 50,
      topFreq: [{ value: 'C-001', count: 1 }],
      sampleValues: ['C-001'],
    },
    email: {
      name: 'email',
      inferredType: 'string',
      semanticType: 'email',
      nullCount: 2,
      uniqueCount: 47,
      topFreq: [{ value: 'bad@email', count: 2 }],
      sampleValues: ['bad@email'],
    },
    age: {
      name: 'age',
      inferredType: 'number',
      nullCount: 0,
      uniqueCount: 31,
      min: -5,
      max: 82,
      sampleValues: [-5],
    },
  },
  issues: [
    {
      id: 'invalid-email-email',
      column: 'email',
      ruleName: 'Invalid email',
      ruleId: 'rule:invalid-email',
      category: IssueCategory.LOGIC,
      description: 'Email sin estructura válida.',
      severity: IssueSeverity.CRITICAL,
      count: 2,
      affectedPercentage: 4,
      sampleValues: ['bad@email'],
    },
    {
      id: 'negative-age-age',
      column: 'age',
      ruleName: 'Impossible negatives',
      ruleId: 'rule:impossible-negatives',
      category: IssueCategory.LOGIC,
      description: 'Edad negativa.',
      severity: IssueSeverity.WARNING,
      count: 1,
      affectedPercentage: 2,
      sampleValues: [-5],
    },
  ],
  scoreBreakdown: [],
  datasetProfile: {
    totalRows: 50,
    totalColumns: 3,
    columns: [
      {
        name: 'customer_id', cardinality: 'unique', uniqueRatio: 1, sparsity: 0,
        inferredType: 'string', isCandidateForCoalescence: false, pruneRecommendation: 'keep',
      },
      {
        name: 'email', cardinality: 'high', uniqueRatio: 0.94, sparsity: 0.04,
        inferredType: 'string', semanticType: 'email', isCandidateForCoalescence: false,
        pruneRecommendation: 'keep',
      },
      {
        name: 'age', cardinality: 'high', uniqueRatio: 0.62, sparsity: 0,
        inferredType: 'number', isCandidateForCoalescence: false, pruneRecommendation: 'keep',
      },
    ],
    coalescencePairs: [],
    pruningCandidates: [],
    generatedAt: '2026-07-10T00:00:00.000Z',
  },
};

const envelope = _buildEvidenceEnvelopeV2(
  {
    ...report,
    columnStats: Object.fromEntries(
      Object.entries(report.columnStats).map(([name, stats]) => [
        name,
        {
          inferredType: stats.inferredType,
          semanticType: stats.semanticType,
          distinctCount: stats.uniqueCount,
          nullCount: stats.nullCount,
          nullPercentage: (stats.nullCount / report.rowCount) * 100,
          topValues: (stats.topFreq ?? []).map((value) => ({
            value: value.value,
            count: value.count,
            percentage: (value.count / report.rowCount) * 100,
          })),
          stats: {},
        },
      ]),
    ),
    datasetProfile: {
      columns: report.datasetProfile?.columns.map((column) => ({
        name: column.name,
        inferredType: column.inferredType,
        semanticType: column.semanticType,
        cardinality: report.columnStats[column.name]?.uniqueCount ?? 0,
      })),
    },
  },
  {
    privacyLevel: 'local_full',
    datasetSha256: '7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf',
    delimiter: ',',
  },
);

const packages = OE4_INPUT_MODES.map((mode) =>
  buildExperimentInputPackage(report, envelope, mode),
);

const fifteenIssueReport: AuditReport = {
  ...report,
  issues: Array.from({ length: 15 }, (_, index) => ({
    ...report.issues[index % report.issues.length],
    id: `controlled-issue-${String(index + 1).padStart(2, '0')}`,
    ruleId: `rule:controlled-${String(index + 1).padStart(2, '0')}`,
    sampleValues: [`sample-${index + 1}`],
  })),
};

const fifteenIssueEnvelope = _buildEvidenceEnvelopeV2(
  {
    ...fifteenIssueReport,
    columnStats: Object.fromEntries(
      Object.entries(fifteenIssueReport.columnStats).map(([name, stats]) => [
        name,
        {
          inferredType: stats.inferredType,
          semanticType: stats.semanticType,
          distinctCount: stats.uniqueCount,
          nullCount: stats.nullCount,
          nullPercentage: (stats.nullCount / fifteenIssueReport.rowCount) * 100,
          topValues: (stats.topFreq ?? []).map((value) => ({
            value: value.value,
            count: value.count,
            percentage: (value.count / fifteenIssueReport.rowCount) * 100,
          })),
          stats: {},
        },
      ]),
    ),
    datasetProfile: {
      columns: fifteenIssueReport.datasetProfile?.columns.map((column) => ({
        name: column.name,
        inferredType: column.inferredType,
        semanticType: column.semanticType,
        cardinality: fifteenIssueReport.columnStats[column.name]?.uniqueCount ?? 0,
      })),
    },
  },
  {
    privacyLevel: 'local_full',
    datasetSha256: 'b'.repeat(64),
    delimiter: ',',
  },
);

describe('OE4 formal input contracts — Task 4', () => {
  it('uses one diagnosis response contract and three distinct input hashes', () => {
    expect(new Set(packages.map((pkg) => pkg.responseSchemaHash))).toHaveLength(1);
    expect(new Set(packages.map((pkg) => pkg.inputHash))).toHaveLength(3);
    expect(new Set(packages.map((pkg) => pkg.systemInstruction))).toHaveLength(1);

    for (const pkg of packages) {
      const schema = pkg.responseSchema as {
        properties: { contractId: { enum: string[] } };
      };
      expect(pkg.contractId).toBe('aura.input-snapshot.v2');
      expect(schema.properties.contractId.enum).toEqual(['aura.diagnosis.v2']);
      expect(pkg.systemInstruction).toMatch(/unsupported claims/i);
    }
  });

  it('pins exact 15-issue coverage and only allows observed issue references', () => {
    const pkg = buildExperimentInputPackage(
      fifteenIssueReport,
      fifteenIssueEnvelope,
      'smart_sample',
    );
    const payload = JSON.parse(pkg.userPayload) as {
      task: {
        expectedIssueCount: number;
        expectedDiagnosisBlockCount: number;
        requiredIssueIds: string[];
      };
    };
    const schema = pkg.responseSchema as {
      properties: {
        issues: {
          minItems: number;
          maxItems: number;
          items: { properties: { issueId: { enum: string[] } } };
        };
        diagnosisBlocks: {
          minItems: number;
          maxItems: number;
          items: { properties: { issueId: { enum: string[] } } };
        };
        visualizations: {
          items: { properties: { issueIds: { items: { enum: string[] } } } };
        };
      };
    };

    expect(payload.task.expectedIssueCount).toBe(15);
    expect(payload.task.expectedDiagnosisBlockCount).toBe(15);
    expect(payload.task.requiredIssueIds).toHaveLength(15);
    expect(schema.properties.issues.minItems).toBe(15);
    expect(schema.properties.issues.maxItems).toBe(15);
    expect(schema.properties.diagnosisBlocks.minItems).toBe(15);
    expect(schema.properties.diagnosisBlocks.maxItems).toBe(15);
    expect(schema.properties.issues.items.properties.issueId.enum).toEqual(payload.task.requiredIssueIds);
    expect(schema.properties.diagnosisBlocks.items.properties.issueId.enum).toEqual(payload.task.requiredIssueIds);
    expect(schema.properties.visualizations.items.properties.issueIds.items.enum).toEqual(payload.task.requiredIssueIds);
    expect(exactDiagnosisPromptV2(pkg)).toMatch(/exactly one.*every required issueId/i);
  });

  it('pins the exact visible sections for every formal mode', () => {
    for (const pkg of packages) {
      expect(pkg.includedSections).toEqual(OE4_INCLUDED_SECTIONS_BY_MODE[pkg.inputMode]);
    }
  });

  it('keeps prompt_libre controlled with the minimal issue registry and no samples', () => {
    const pkg = buildExperimentInputPackage(report, envelope, 'prompt_libre');
    expect(pkg.userPayload).toContain('customer_id');
    expect(pkg.userPayload).toContain('datasetSchema');
    expect(pkg.userPayload).toContain('issueRegistryMinimal');
    expect(pkg.userPayload).toContain('rule:invalid-email');
    expect(pkg.userPayload).not.toContain('bad@email');
    expect(pkg.userPayload).not.toContain('Email sin estructura válida');
    const payload = JSON.parse(pkg.userPayload) as { visibleEvidence: Record<string, unknown> };
    expect(JSON.stringify(payload.visibleEvidence)).not.toContain('evidenceRefs');
  });

  it('gives smart_sample structured rules, statistics and observed samples', () => {
    const pkg = buildExperimentInputPackage(report, envelope, 'smart_sample');
    expect(pkg.userPayload).toContain('columnStatistics');
    expect(pkg.userPayload).toContain('ruleActivations');
    expect(pkg.userPayload).toContain('evidenceSamples');
    expect(pkg.userPayload).toContain('rule:invalid-email');
    expect(pkg.userPayload).toContain('sha256:');
    expect(pkg.userPayload).toContain('-5');
    expect(pkg.userPayload).not.toContain('badSampleAnchors');
  });

  it('gives recommended the full registry, governance and explicit anchors', () => {
    const pkg = buildExperimentInputPackage(report, envelope, 'recommended');
    expect(pkg.userPayload).toContain('columnRegistry');
    expect(pkg.userPayload).toContain('actionabilityPolicy');
    expect(pkg.userPayload).toContain('authorizationEvidence');
    expect(pkg.userPayload).toContain('selectionManifest');
    expect(pkg.userPayload).toContain('truncationManifest');
    expect(pkg.userPayload).toContain('badSampleAnchors');
    expect(pkg.userPayload).toContain('sha256:');
    expect(pkg.userPayload).toContain('-5');
  });

  it('uses the canonical env reference required by diagnosis validation', () => {
    for (const pkg of packages) {
      expect(pkg.evidenceEnvelopeRef).toBe(buildEnvelopeRef(envelope));
      expect(pkg.evidenceEnvelopeRef).toMatch(/^env:[a-f0-9]{64}$/);
      expect(pkg.userPayload).toContain(pkg.evidenceEnvelopeRef);
    }
  });

  it('is deterministic and deeply frozen', () => {
    const first = buildExperimentInputPackage(report, envelope, 'recommended');
    const second = buildExperimentInputPackage(report, envelope, 'recommended');
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.includedSections)).toBe(true);
    expect(Object.isFrozen(first.responseSchema)).toBe(true);
  });

  it('rejects report and envelope drift before hashing', () => {
    expect(() =>
      buildExperimentInputPackage({ ...report, rowCount: 49 }, envelope, 'smart_sample'),
    ).toThrow(/report.*envelope/i);
  });
});
