/**
 * Diagnosis Smart Sample HITL Fix — Shared Policy Tests.
 *
 * AURA-CIERRE-SMART-SAMPLE-HITL-01 contract fix.
 *
 * Goal: smart_sample must expose the deterministic list of issueIds that
 * require human review (without leaking actionability/authorization/governance),
 * and the validator must reject any response that returns
 * `requiresHumanReview: false` for an ID in that list.
 */

import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2, DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE } from '../contracts/llm/diagnosisInputPackageV2';
import {
  computeIssueIdsRequiringHumanReview,
  requiresReviewFromEnvelopeV2,
} from '../contracts/llm/humanReviewPolicyV2';
import { validateDiagnosisResponseV2 } from '../contracts/llm/diagnosisValidatorV2';
import { buildEnvelopeRef } from '../contracts/llm/diagnosisPromptV2';
import { IssueCategory, IssueSeverity, type AuditReport } from '../types';

const report: AuditReport = {
  score: 71,
  rowCount: 50,
  colCount: 3,
  duplicateRows: 0,
  delimiterDetected: ',',
  columnStats: {
    customer_id: {
      name: 'customer_id', inferredType: 'string', nullCount: 0, uniqueCount: 50,
      topFreq: [{ value: 'C-001', count: 1 }], sampleValues: ['C-001'],
    },
    email: {
      name: 'email', inferredType: 'string', semanticType: 'email',
      nullCount: 2, uniqueCount: 47,
      topFreq: [{ value: 'bad@email', count: 2 }], sampleValues: ['bad@email'],
    },
    age: {
      name: 'age', inferredType: 'number', nullCount: 0, uniqueCount: 31,
      min: -5, max: 82, sampleValues: [-5],
    },
  },
  issues: [
    {
      id: 'invalid-email-email', column: 'email', ruleName: 'Invalid email',
      ruleId: 'rule:invalid-email', category: IssueCategory.LOGIC,
      description: 'Email sin estructura válida.', severity: IssueSeverity.CRITICAL,
      count: 2, affectedPercentage: 4, sampleValues: ['bad@email'],
    },
    {
      id: 'negative-age-age', column: 'age', ruleName: 'Impossible negatives',
      ruleId: 'rule:impossible-negatives', category: IssueCategory.LOGIC,
      description: 'Edad negativa.', severity: IssueSeverity.WARNING,
      count: 1, affectedPercentage: 2, sampleValues: [-5],
    },
    {
      id: 'safe-trim-customer_id', column: 'customer_id', ruleName: 'Trim whitespace',
      ruleId: 'rule:trim-whitespace', category: IssueCategory.HYGIENE,
      description: 'Whitespace padding.', severity: IssueSeverity.INFO,
      count: 1, affectedPercentage: 2, sampleValues: ['C-001'],
    },
  ],
  scoreBreakdown: [],
  datasetProfile: {
    totalRows: 50, totalColumns: 3,
    columns: [
      { name: 'customer_id', cardinality: 'unique', uniqueRatio: 1, sparsity: 0, inferredType: 'string', isCandidateForCoalescence: false, pruneRecommendation: 'keep' },
      { name: 'email', cardinality: 'high', uniqueRatio: 0.94, sparsity: 0.04, inferredType: 'string', semanticType: 'email', isCandidateForCoalescence: false, pruneRecommendation: 'keep' },
      { name: 'age', cardinality: 'high', uniqueRatio: 0.62, sparsity: 0, inferredType: 'number', isCandidateForCoalescence: false, pruneRecommendation: 'keep' },
    ],
    coalescencePairs: [], pruningCandidates: [],
    generatedAt: '2026-07-10T00:00:00.000Z',
  },
};

const compatibleReport: AuditReportInput = {
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
          value: value.value, count: value.count,
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
};

const envelope = _buildEvidenceEnvelopeV2(compatibleReport, {
  privacyLevel: 'local_full',
  datasetSha256: '7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf',
  delimiter: ',',
});

describe('AURA-CIERRE-SMART-SAMPLE-HITL-01 — policy', () => {
  it('T1: los tres modos reciben la misma lista determinista de revisión humana', () => {
    const pkgLibre = buildDiagnosisInputPackageV2(report, envelope, 'prompt_libre');
    const pkgSmart = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const pkgRecommended = buildDiagnosisInputPackageV2(report, envelope, 'recommended');

    const libre = JSON.parse(pkgLibre.userPayload) as { task: { issueIdsRequiringHumanReview: string[] } };
    const smart = JSON.parse(pkgSmart.userPayload) as { task: { issueIdsRequiringHumanReview: string[] } };
    const recommended = JSON.parse(pkgRecommended.userPayload) as { task: { issueIdsRequiringHumanReview: string[] } };

    expect(smart.task.issueIdsRequiringHumanReview).toEqual(libre.task.issueIdsRequiringHumanReview);
    expect(recommended.task.issueIdsRequiringHumanReview).toEqual(libre.task.issueIdsRequiringHumanReview);
  });

  it('T2: smart_sample no contiene actionabilityPolicy, authorizationEvidence, columnRegistry, badSampleAnchors', () => {
    const pkg = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const payload = JSON.parse(pkg.userPayload) as { visibleEvidence: Record<string, unknown> };

    expect(pkg.userPayload).not.toContain('actionabilityPolicy');
    expect(pkg.userPayload).not.toContain('authorizationEvidence');
    expect(pkg.userPayload).not.toContain('columnRegistry');
    expect(pkg.userPayload).not.toContain('badSampleAnchors');

    expect(payload.visibleEvidence).not.toHaveProperty('actionabilityPolicy');
    expect(payload.visibleEvidence).not.toHaveProperty('authorizationEvidence');
    expect(payload.visibleEvidence).not.toHaveProperty('columnRegistry');
    expect(payload.visibleEvidence).not.toHaveProperty('badSampleAnchors');
  });

  it('T3: las secciones de los tres modos no cambian', () => {
    for (const mode of ['prompt_libre', 'smart_sample', 'recommended'] as const) {
      const pkg = buildDiagnosisInputPackageV2(report, envelope, mode);
      expect(pkg.includedSections).toEqual([...DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE[mode]]);
    }

    const librePkg = buildDiagnosisInputPackageV2(report, envelope, 'prompt_libre');
    const smartPkg = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const recommendedPkg = buildDiagnosisInputPackageV2(report, envelope, 'recommended');

    expect(librePkg.includedSections).toHaveLength(3);
    expect(smartPkg.includedSections).toHaveLength(6);
    expect(recommendedPkg.includedSections).toHaveLength(12);
  });

  it('T4: todos los issues sin evidenceRefs aparecen en la lista', () => {
    const pkg = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const payload = JSON.parse(pkg.userPayload) as { task: { issueIdsRequiringHumanReview: string[]; issueIdsWithoutEvidenceRefs: string[] } };

    for (const issueId of payload.task.issueIdsWithoutEvidenceRefs) {
      expect(payload.task.issueIdsRequiringHumanReview).toContain(issueId);
    }
  });

  it('T5: review_only, no autorizados y columnas ambiguas aparecen en la lista', () => {
    const pkg = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const payload = JSON.parse(pkg.userPayload) as { task: { issueIdsRequiringHumanReview: string[] } };

    const reviewOnlyIssueIds = envelope.issues
      .filter((issue) => issue.actionability === 'review_only')
      .map((issue) => issue.issueId);
    const unauthorizedIssueIds = envelope.issues
      .filter((issue) => issue.actionability === 'auto_safe' && !issue.automaticAuthorization.authorized)
      .map((issue) => issue.issueId);
    const ambiguousColumnIds = new Set(
      envelope.columns
        .filter((column) => column.isAmbiguous || column.isDuplicate)
        .map((column) => column.columnId),
    );
    const ambiguousIssueIds = envelope.issues
      .filter((issue) => issue.columnId && ambiguousColumnIds.has(issue.columnId))
      .map((issue) => issue.issueId);

    for (const issueId of [...reviewOnlyIssueIds, ...unauthorizedIssueIds, ...ambiguousIssueIds]) {
      expect(payload.task.issueIdsRequiringHumanReview).toContain(issueId);
    }
  });

  it('T6: un issue realmente seguro y autorizado puede quedar fuera de la lista', () => {
    const safeAuthorizedReport: AuditReportInput = {
      ...compatibleReport,
      issues: [
        {
          ...compatibleReport.issues[0]!,
          id: 'safe-trim-clean',
          column: 'customer_id',
          ruleId: 'rule:trim-whitespace',
          automaticAuthorization: {
            actionType: 'trim_whitespace',
            authorized: true,
            conditionsMet: ['string-column'],
            reason: 'Deterministic lossless normalization',
          },
          sampleValues: ['C-001', 'C-002'],
        },
        {
          ...compatibleReport.issues[1]!,
          id: 'review-only-nulls',
          column: 'email',
          ruleId: 'rule:null-values',
          automaticAuthorization: {
            actionType: 'null_values',
            authorized: false,
            conditionsMet: [],
            reason: 'No auto_safe for nulls',
          },
          sampleValues: [null, 'bad@email'],
        },
      ],
      columnStats: {
        ...compatibleReport.columnStats,
        customer_id: {
          ...(compatibleReport.columnStats?.customer_id ?? {}),
          topValues: [
            ...(compatibleReport.columnStats?.customer_id?.topValues ?? []),
            { value: 'C-001', count: 1, percentage: 2 },
            { value: 'C-002', count: 1, percentage: 2 },
          ],
        },
        email: {
          ...(compatibleReport.columnStats?.email ?? {}),
          topValues: [
            ...(compatibleReport.columnStats?.email?.topValues ?? []),
            { value: 'bad@email', count: 2, percentage: 4 },
          ],
        },
      },
    };

    const safeEnv = _buildEvidenceEnvelopeV2(safeAuthorizedReport, {
      privacyLevel: 'local_full',
      datasetSha256: 'a'.repeat(64),
      delimiter: ',',
    });

    const safeIssue = safeEnv.issues.find(
      (issue) => issue.actionability === 'auto_safe' && issue.automaticAuthorization.authorized
        && issue.evidenceRefs.length > 0
        && (!issue.columnId || !safeEnv.columns.find(
          (column) => column.columnId === issue.columnId && (column.isAmbiguous || column.isDuplicate),
        )),
    );

    expect(safeIssue).toBeDefined();
    if (!safeIssue) return;

    const list = computeIssueIdsRequiringHumanReview(safeEnv);
    const reviewOnlyId = safeEnv.issues.find((i) => i.ruleId === 'rule:null-values')?.issueId;
    expect(reviewOnlyId).toBeDefined();
    if (reviewOnlyId) expect(list).toContain(reviewOnlyId);
    expect(list).not.toContain(safeIssue.issueId);

    const pkg = buildDiagnosisInputPackageV2(safeAuthorizedReport as unknown as AuditReport, safeEnv, 'smart_sample');
    const payload = JSON.parse(pkg.userPayload) as { task: { issueIdsRequiringHumanReview: string[] } };
    expect(payload.task.issueIdsRequiringHumanReview).not.toContain(safeIssue.issueId);
  });

  it('T7: el validador rechaza requiresHumanReview=false para cualquier ID obligatorio', () => {
    const requiredList = computeIssueIdsRequiringHumanReview(envelope);
    expect(requiredList.length).toBeGreaterThan(0);

    const targetId = requiredList[0]!;
    const targetIssue = envelope.issues.find((issue) => issue.issueId === targetId)!;

    const badResponse = {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: buildEnvelopeRef(envelope),
      responseId: 'diag-smart-hitl-01',
      issues: [
        {
          issueId: targetIssue.issueId,
          evidenceRefs: targetIssue.evidenceRefs,
          hypothesis: 'X',
          confidence: 0.5,
          requiresHumanReview: false,
          limits: [],
        },
      ],
      diagnosisBlocks: [
        {
          issueId: targetIssue.issueId,
          ruleId: targetIssue.ruleId,
          columnId: targetIssue.columnId,
          scope: targetIssue.scope,
          observation: 'X',
          recommendation: 'X',
        },
      ],
      limitations: [],
      generatedAt: new Date().toISOString(),
    };

    const result = validateDiagnosisResponseV2(badResponse as any, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE')).toBe(true);
  });

  it('T7b: la política compartida también exige revisión cuando evidenceRefs está vacío aunque la gobernanza sea auto_safe + authorized', () => {
    const issue = {
      actionability: 'auto_safe' as const,
      automaticAuthorization: { authorized: true } as { authorized: boolean },
      columnId: 'col:clean',
      evidenceRefs: [],
    };
    const registry = new Map<string, { isAmbiguous: boolean; isDuplicate: boolean }>([
      ['col:clean', { isAmbiguous: false, isDuplicate: false }],
    ]);
    expect(requiresReviewFromEnvelopeV2(issue, registry)).toBe(true);
  });

  it('T8: una respuesta smart_sample con los valores correctos pasa', () => {
    const requiredSet = new Set(computeIssueIdsRequiringHumanReview(envelope));

    const response = {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: buildEnvelopeRef(envelope),
      responseId: 'diag-smart-hitl-02',
      issues: envelope.issues.map((issue) => ({
        issueId: issue.issueId,
        evidenceRefs: issue.evidenceRefs,
        hypothesis: 'h',
        confidence: 0.5,
        requiresHumanReview: requiredSet.has(issue.issueId),
        limits: [],
      })),
      diagnosisBlocks: envelope.issues.map((issue) => ({
        issueId: issue.issueId,
        ruleId: issue.ruleId,
        columnId: issue.columnId,
        scope: issue.scope,
        observation: 'o',
        recommendation: 'r',
      })),
      limitations: [],
      generatedAt: new Date().toISOString(),
    };

    const result = validateDiagnosisResponseV2(response as any, envelope);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('T9: dos construcciones idénticas producen los mismos userPayload, promptHash, inputHash y responseSchemaHash', () => {
    const a = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');
    const b = buildDiagnosisInputPackageV2(report, envelope, 'smart_sample');

    expect(a.userPayload).toBe(b.userPayload);
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.inputHash).toBe(b.inputHash);
    expect(a.responseSchemaHash).toBe(b.responseSchemaHash);
  });

  it('T10: la lista preserva el orden canónico del envelope', () => {
    const list = computeIssueIdsRequiringHumanReview(envelope);
    const envelopeOrder = envelope.issues.map((issue) => issue.issueId);
    const listIndices = list.map((id) => envelopeOrder.indexOf(id));
    const sortedIndices = [...listIndices].sort((x, y) => x - y);
    expect(listIndices).toEqual(sortedIndices);
  });
});

describe('AURA-CIERRE-SMART-SAMPLE-HITL-01 — policy edge cases', () => {
  it('la política compartida considera columna ambigua o duplicada antes que cualquier otra regla', () => {
    const issue = {
      actionability: 'auto_safe' as const,
      automaticAuthorization: { authorized: true } as { authorized: boolean },
      columnId: 'col:amb',
    };
    const registry = new Map<string, { isAmbiguous: boolean; isDuplicate: boolean }>([
      ['col:amb', { isAmbiguous: true, isDuplicate: false }],
    ]);
    expect(requiresReviewFromEnvelopeV2(issue, registry)).toBe(true);
  });

  it('la política compartida trata actionability desconocida como revisión humana', () => {
    const issue = {
      actionability: 'unknown_kind' as unknown as 'auto_safe',
      automaticAuthorization: { authorized: true } as { authorized: boolean },
      columnId: null,
    };
    const registry = new Map<string, { isAmbiguous: boolean; isDuplicate: boolean }>();
    expect(requiresReviewFromEnvelopeV2(issue, registry)).toBe(true);
  });

  it('la política compartida devuelve false solo si auto_safe, autorizado, con evidencia y columna limpia', () => {
    const issue = {
      actionability: 'auto_safe' as const,
      automaticAuthorization: { authorized: true } as { authorized: boolean },
      columnId: 'col:clean',
      evidenceRefs: ['ref:sample-1'],
    };
    const registry = new Map<string, { isAmbiguous: boolean; isDuplicate: boolean }>([
      ['col:clean', { isAmbiguous: false, isDuplicate: false }],
    ]);
    expect(requiresReviewFromEnvelopeV2(issue, registry)).toBe(false);
  });
});