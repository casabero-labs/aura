import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { defaultBudget } from '../contracts/llm/tokenBudget';
import { runAudit } from '../services/auditEngine';
import { validateDiagnosisResponseV2 } from '../contracts/llm/diagnosisValidatorV2';
import { computeIssueIdsRequiringHumanReview } from '../contracts/llm/humanReviewPolicyV2';
import { buildEnvelopeRef } from '../contracts/llm/diagnosisPromptV2';

const datasetPath = join(
  __dirname,
  '..',
  '..',
  'experiments',
  'final-evaluation',
  'datasets',
  'controlled_customers_phase8.csv',
);

const tfmDatasetPath = join(
  __dirname,
  '..',
  '..',
  'experiments',
  'datasets',
  'synthetic_ground_truth.csv',
);

const buildControlledInput = (path: string) => {
  const csv = readFileSync(path);
  const parsed = Papa.parse<Record<string, unknown>>(csv.toString('utf8'), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    delimiter: '',
  });
  const columns = parsed.meta.fields ?? [];
  const report = runAudit(parsed.data, columns, parsed.meta.delimiter || ',');
  const compatibleReport: AuditReportInput = {
    ...report,
    datasetProfile: report.datasetProfile ? {
      columns: report.datasetProfile.columns.map((column) => ({
        name: column.name,
        inferredType: column.inferredType,
        semanticType: column.semanticType,
        cardinality: report.columnStats[column.name]?.uniqueCount,
      })),
    } : undefined,
  };
  const envelope = _buildEvidenceEnvelopeV2(compatibleReport, {
    privacyLevel: 'local_full',
    datasetSha256: createHash('sha256').update(csv).digest('hex'),
    delimiter: report.delimiterDetected,
  });
  return { report, envelope };
};

describe('controlled Phase 8 diagnosis inputs', () => {
  it('builds the real evidence envelope and all three input modes', () => {
    const { report, envelope } = buildControlledInput(datasetPath);

    expect(report.issues).toHaveLength(29);
    expect(envelope.issues).toHaveLength(24);
    expect(envelope.evidence.samples.length).toBeGreaterThan(0);
    expect(Object.keys(envelope.evidence.columnStats)).toHaveLength(15);
    expect(JSON.stringify(envelope).length).toBeLessThanOrEqual(defaultBudget().maxCharacters);

    const modes = ['prompt_libre', 'smart_sample', 'recommended'] as const;
    const packages = modes.map((mode) => buildDiagnosisInputPackageV2(report, envelope, mode));

    expect(new Set(packages.map((input) => input.inputHash))).toHaveLength(3);
    expect(packages.every((input) => input.userPayload.length > 0)).toBe(true);
  });

  it('keeps every finding from the simpler TFM dataset without budget exclusions', () => {
    const { report, envelope } = buildControlledInput(tfmDatasetPath);

    expect(report.rowCount).toBe(15);
    expect(report.colCount).toBe(9);
    expect(report.issues).toHaveLength(15);
    expect(envelope.issues).toHaveLength(report.issues.length);
    expect(envelope.selectionManifest.excludedIssues).toBe(0);
    expect(envelope.truncationManifest.truncatedIssues).toHaveLength(0);

    const modes = ['prompt_libre', 'smart_sample', 'recommended'] as const;
    const packages = modes.map((mode) => buildDiagnosisInputPackageV2(report, envelope, mode));
    expect(new Set(packages.map((input) => input.inputHash))).toHaveLength(3);
  });

  it('AURA-CIERRE-SMART-SAMPLE-HITL-01 R1: integrity-dupes (auto_safe + authorized + zero evidence) still demands human review in smart_sample', () => {
    const { report, envelope } = buildControlledInput(tfmDatasetPath);

    const integrityDupes = envelope.issues.find((issue) => issue.issueId === 'integrity-dupes');
    expect(integrityDupes).toBeDefined();
    if (!integrityDupes) return;

    expect(integrityDupes.actionability).toBe('auto_safe');
    expect(integrityDupes.automaticAuthorization.authorized).toBe(true);
    expect(integrityDupes.evidenceRefs).toEqual([]);

    const requiredList = computeIssueIdsRequiringHumanReview(envelope);
    expect(requiredList).toContain('integrity-dupes');
    expect(requiredList).toHaveLength(15);

    const envRef = buildEnvelopeRef(envelope);

    const downgradeResponse = {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: envRef,
      responseId: 'diag-r1-downgrade',
      issues: envelope.issues.map((issue) => ({
        issueId: issue.issueId,
        evidenceRefs: issue.evidenceRefs,
        hypothesis: 'h',
        confidence: 0.5,
        requiresHumanReview: false,
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
    const downgradeResult = validateDiagnosisResponseV2(downgradeResponse as any, envelope);
    expect(downgradeResult.valid).toBe(false);
    const downgradeErrors = downgradeResult.errors.filter((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE');
    const integrityDupesIndex = envelope.issues.findIndex((issue) => issue.issueId === 'integrity-dupes');
    expect(integrityDupesIndex).toBeGreaterThanOrEqual(0);
    const integrityDupesPath = `issues[${integrityDupesIndex}].requiresHumanReview`;
    const integrityDupesError = downgradeErrors.find((e) => e.path === integrityDupesPath);
    expect(integrityDupesError).toBeDefined();
    expect(integrityDupesError?.message).toMatch(/no evidenceRefs|human review/i);

    const requiredSet = new Set(requiredList);
    const correctResponse = {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      evidenceEnvelopeRef: envRef,
      responseId: 'diag-r1-correct',
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
    const correctResult = validateDiagnosisResponseV2(correctResponse as any, envelope);
    expect(correctResult.valid).toBe(true);
    expect(correctResult.errors).toHaveLength(0);
  });
});
