/**
 * AURA-CIERRE-DETERMINISTIC-HITL-02 — normalization regression tests.
 *
 * Fixture represents the real Gemma balanced-evidence failure: 15 issues,
 * 10 mandatory issues returned with `requiresHumanReview: false`, 5 with
 * `true`. All other contract fields are otherwise valid. The pipeline
 * must split this into:
 *
 *   - RAW model result — preserves the original response and records
 *     `DIAGNOSIS_REVIEW_DOWNGRADE` against the model's values.
 *   - EFFECTIVE product result — AURA forces the 10 mandatory issues to
 *     `requiresHumanReview: true` and validates the response with the
 *     strict validator before letting the diagnosis continue.
 *
 * The Laboratory must keep measuring the raw response. No other field is
 * normalized; no other model defect (invented refs, unsupported claims,
 * missing coverage, malformed JSON) is repaired.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { runDiagnosisPipeline } from '../contracts/llm/diagnosisPipelineV2';
import { buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import { validateDiagnosisResponseV2 } from '../contracts/llm/diagnosisValidatorV2';
import { buildEnvelopeRef, canonicalJson } from '../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../contracts/llm/hash';
import {
  HUMAN_REVIEW_NORMALIZATION_FIELD,
  HUMAN_REVIEW_NORMALIZATION_POLICY,
  HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION,
  HUMAN_REVIEW_NORMALIZATION_REASON,
  captureRawResponse,
  computeMandatoryReviewIssueIds,
  normalizeHumanReview,
  normalizeHumanReviewWithRawValidation,
  onlyRequiresHumanReviewDiffers,
} from '../contracts/llm/humanReviewNormalizerV2';
import { runAudit } from '../services/auditEngine';
import { buildGovernanceNormalizationMessage } from '../services/diagnosticReport/diagnosticReportBuilder';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { DiagnosisResponseV2 } from '../contracts/llm/types';

const tfmDatasetPath = join(
  __dirname,
  '..',
  '..',
  'experiments',
  'datasets',
  'synthetic_ground_truth.csv',
);

interface EnvelopeFixture {
  report: AuditReportInput;
  envelope: ReturnType<typeof _buildEvidenceEnvelopeV2>;
  mandatoryIds: string[];
}

const buildSyntheticGroundTruthEnvelope = (): EnvelopeFixture => {
  const csv = readFileSync(tfmDatasetPath);
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
  const mandatoryIds = computeMandatoryReviewIssueIds(envelope);
  return { report: compatibleReport, envelope, mandatoryIds };
};

const buildGemmaBalancedFailure = (
  envelope: ReturnType<typeof _buildEvidenceEnvelopeV2>,
  mandatoryIds: string[],
): DiagnosisResponseV2 => {
  const envRef = buildEnvelopeRef(envelope);
  return {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: envRef,
    responseId: 'diag-gemma-balanced-01',
    issues: envelope.issues.map((issue, index) => ({
      issueId: issue.issueId,
      evidenceRefs: [...issue.evidenceRefs],
      hypothesis: 'hypothesis for ' + issue.issueId,
      confidence: 0.7,
      // Gemma marked every issue false; force 5 to true so the fixture
      // resembles a partially-aware model with stochastic drift.
      requiresHumanReview: index < 5 ? true : false,
      limits: [],
    })),
    diagnosisBlocks: envelope.issues.map((issue) => ({
      issueId: issue.issueId,
      ruleId: issue.ruleId,
      columnId: issue.columnId,
      scope: issue.scope,
      observation: 'observation for ' + issue.issueId,
      recommendation: 'recommendation for ' + issue.issueId,
    })),
    limitations: ['Sample based'],
    generatedAt: '2026-07-14T00:00:00.000Z',
  } as DiagnosisResponseV2;
};

const findMandatoryFalseCount = (
  response: DiagnosisResponseV2,
  mandatoryIds: readonly string[],
): number => {
  const mandatorySet = new Set(mandatoryIds);
  return response.issues.filter((issue) => mandatorySet.has(issue.issueId) && issue.requiresHumanReview === false).length;
};

describe('AURA-CIERRE-DETERMINISTIC-HITL-02 — Gemma balanced-evidence regression', () => {
  it('R1: raw validation reports DIAGNOSIS_REVIEW_DOWNGRADE', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const rawValidation = validateDiagnosisResponseV2(gemma, fixture.envelope);
    expect(rawValidation.valid).toBe(false);
    expect(rawValidation.errors.some((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE')).toBe(true);
    // Gemma set 5 to true and 10 to false. Mandatory ids = 15.
    expect(findMandatoryFalseCount(gemma, fixture.mandatoryIds)).toBe(10);
  });

  it('R2: raw compliance remains failed for Laboratory purposes', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const result = normalizeHumanReviewWithRawValidation(
      gemma,
      fixture.envelope,
      validateDiagnosisResponseV2,
    );
    expect(result.rawValidation.valid).toBe(false);
    expect(result.rawValidation.errorCodes).toContain('DIAGNOSIS_REVIEW_DOWNGRADE');
    expect(result.rawValidation.downgradeCount).toBeGreaterThan(0);
    // Raw response kept the 10 false values — Laboratory sees the same
    // model output the provider produced.
    expect(findMandatoryFalseCount(result.rawResponse, fixture.mandatoryIds)).toBe(10);
  });

  it('R3: product normalization changes only requiresHumanReview', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const result = normalizeHumanReview(gemma, fixture.envelope);
    expect(onlyRequiresHumanReviewDiffers(result.rawResponse, result.effectiveResponse)).toBe(true);
    expect(result.evidence.field).toBe('requiresHumanReview');
    expect(result.evidence.field).toBe(HUMAN_REVIEW_NORMALIZATION_FIELD);
  });

  it('R4: all mandatory issues become true in the effective response', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const result = normalizeHumanReview(gemma, fixture.envelope);
    const mandatorySet = new Set(fixture.mandatoryIds);
    for (const issue of result.effectiveResponse.issues) {
      if (mandatorySet.has(issue.issueId)) {
        expect(issue.requiresHumanReview).toBe(true);
      }
    }
  });

  it('R5: the effective diagnosis passes strict validation', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const result = normalizeHumanReview(gemma, fixture.envelope);
    const effectiveValidation = validateDiagnosisResponseV2(result.effectiveResponse, fixture.envelope);
    expect(effectiveValidation.valid).toBe(true);
    expect(effectiveValidation.errors).toHaveLength(0);
  });

  it('R6: normalization evidence lists the exact 10 modified issue IDs', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const result = normalizeHumanReview(gemma, fixture.envelope);
    expect(result.evidence.applied).toBe(true);
    expect(result.evidence.normalizedIssueIds).toHaveLength(10);
    expect(result.evidence.normalizedIssueIds.sort()).toEqual(
      fixture.mandatoryIds.slice(5).sort(),
    );
    expect(result.evidence.reason).toBe(HUMAN_REVIEW_NORMALIZATION_REASON);
    expect(result.evidence.policy).toBe(HUMAN_REVIEW_NORMALIZATION_POLICY);
    expect(result.evidence.policyVersion).toBe(HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION);
  });

  it('R7: raw response and rawResponseHash remain unchanged', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const captured = captureRawResponse(gemma);
    const result = normalizeHumanReview(captured, fixture.envelope);
    expect(canonicalJson(result.rawResponse)).toBe(canonicalJson(captured));
    expect(sha256hex(canonicalJson(result.rawResponse))).toBe(sha256hex(canonicalJson(captured)));
  });

  it('R8: an invented evidenceRef still blocks the product diagnosis', async () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    // Inject an invented evidenceRef in the first issue — this is a real
    // model defect that normalization must NOT repair.
    const firstIssue = gemma.issues[0]!;
    firstIssue.evidenceRefs = ['ref:invented-by-model'];

    const pipeline = await runDiagnosisPipeline(
      fixture.envelope,
      buildDiagnosisPromptV2(fixture.envelope),
      async () => JSON.stringify(gemma),
    );
    expect(pipeline.success).toBe(false);
    if (!pipeline.success) {
      const codes = ((pipeline as unknown as { details?: { validationErrors?: Array<{ code: string }> } }).details?.validationErrors ?? []).map((e) => e.code);
      expect(codes).toContain('DIAGNOSIS_REFERENCE_INVALID');
      // Raw validation must keep recording the downgrade count.
      expect((pipeline as unknown as { rawValidation?: { downgradeCount: number } }).rawValidation?.downgradeCount).toBeGreaterThan(0);
    }
  });

  it('R9: an unsupported quoted value still blocks the product diagnosis', async () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const firstIssue = gemma.issues[0]!;
    // Quoted value unsupported by the envelope evidence — the strict
    // validator rejects with DIAGNOSIS_REFERENCE_INVALID. Normalization
    // MUST NOT repair this either.
    firstIssue.hypothesis = 'The dataset contains the literal "value-not-in-evidence-99" somewhere.';
    gemma.diagnosisBlocks[0]!.observation = 'Observed "value-not-in-evidence-99" in the column.';

    const pipeline = await runDiagnosisPipeline(
      fixture.envelope,
      buildDiagnosisPromptV2(fixture.envelope),
      async () => JSON.stringify(gemma),
    );
    expect(pipeline.success).toBe(false);
    if (!pipeline.success) {
      const codes = ((pipeline as unknown as { details?: { validationErrors?: Array<{ code: string }> } }).details?.validationErrors ?? []).map((e) => e.code);
      expect(codes).toContain('DIAGNOSIS_REFERENCE_INVALID');
    }
  });

  it('R10: invalid JSON is never normalized', async () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const pipeline = await runDiagnosisPipeline(
      fixture.envelope,
      buildDiagnosisPromptV2(fixture.envelope),
      async () => '{"contractId":"aura.diagnosis.v2","issues":[',
    );
    expect(pipeline.success).toBe(false);
    if (!pipeline.success) {
      expect((pipeline as { code: string }).code).toBe('DIAGNOSIS_JSON_INVALID');
    }
  });

  it('R11: missing issue coverage is never normalized', async () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    // Drop one issue — the response now has 14 of 15 envelope issues.
    gemma.issues = gemma.issues.slice(0, -1);
    gemma.diagnosisBlocks = gemma.diagnosisBlocks.slice(0, -1);

    const pipeline = await runDiagnosisPipeline(
      fixture.envelope,
      buildDiagnosisPromptV2(fixture.envelope),
      async () => JSON.stringify(gemma),
    );
    expect(pipeline.success).toBe(false);
    if (!pipeline.success) {
      // Coverage errors use DIAGNOSIS_REFERENCE_INVALID. The pipeline
      // surfaces the first error code but the full list is available in
      // details.validationErrors. The exact-coverage error must appear
      // somewhere in the list.
      const codes = ((pipeline as unknown as { details?: { validationErrors?: Array<{ code: string }> } }).details?.validationErrors ?? []).map((e) => e.code);
      expect(codes).toContain('DIAGNOSIS_REFERENCE_INVALID');
    }
  });

  it('R12: two identical inputs produce identical normalization evidence', () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemmaA = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const gemmaB = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const resultA = normalizeHumanReview(gemmaA, fixture.envelope);
    const resultB = normalizeHumanReview(gemmaB, fixture.envelope);
    expect(canonicalJson(resultA.evidence)).toBe(canonicalJson(resultB.evidence));
    expect(canonicalJson(resultA.effectiveResponse)).toBe(canonicalJson(resultB.effectiveResponse));
    expect(buildGovernanceNormalizationMessage(resultA.evidence)).toMatch(
      /AURA aplicó revisión humana obligatoria a 10 hallazgos/,
    );
  });
});

describe('AURA-CIERRE-DETERMINISTIC-HITL-02 — pipeline integration', () => {
  it('the pipeline emits the raw + effective split on the Gemma fixture', async () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const gemma = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    const pipeline = await runDiagnosisPipeline(
      fixture.envelope,
      buildDiagnosisPromptV2(fixture.envelope),
      async () => JSON.stringify(gemma),
    );
    expect(pipeline.success).toBe(true);
    if (pipeline.success) {
      expect(pipeline.rawValidation.valid).toBe(false);
      expect(pipeline.rawValidation.errorCodes).toContain('DIAGNOSIS_REVIEW_DOWNGRADE');
      expect(pipeline.normalizationEvidence.applied).toBe(true);
      expect(pipeline.normalizationEvidence.normalizedIssueIds).toHaveLength(10);
      // Raw response preserved.
      expect(findMandatoryFalseCount(pipeline.rawResponse, fixture.mandatoryIds)).toBe(10);
      // Effective response flipped.
      expect(findMandatoryFalseCount(pipeline.response, fixture.mandatoryIds)).toBe(0);
    }
  });

  it('the pipeline leaves a compliant response untouched (no normalization)', async () => {
    const fixture = buildSyntheticGroundTruthEnvelope();
    const compliant = buildGemmaBalancedFailure(fixture.envelope, fixture.mandatoryIds);
    for (const issue of compliant.issues) issue.requiresHumanReview = true;

    const pipeline = await runDiagnosisPipeline(
      fixture.envelope,
      buildDiagnosisPromptV2(fixture.envelope),
      async () => JSON.stringify(compliant),
    );
    expect(pipeline.success).toBe(true);
    if (pipeline.success) {
      expect(pipeline.rawValidation.valid).toBe(true);
      expect(pipeline.normalizationEvidence.applied).toBe(false);
      expect(pipeline.normalizationEvidence.normalizedIssueIds).toHaveLength(0);
      expect(canonicalJson(pipeline.response)).toBe(canonicalJson(pipeline.rawResponse));
    }
  });
});
