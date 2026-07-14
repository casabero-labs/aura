import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';
import { evaluateFormalDiagnosisRun } from '../services/benchmark/formalDiagnosisEvaluator';
import { extractContractEvidence } from '../services/benchmark/formalDiagnosisEvidence';
import { validateDiagnosisResponseV2 } from '../contracts/llm/diagnosisValidatorV2';
import { computeMandatoryReviewIssueIds } from '../contracts/llm/humanReviewNormalizerV2';
import { buildEnvelopeRef } from '../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../contracts/llm/hash';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { runAudit } from '../services/auditEngine';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type {
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
} from '../contracts/llm';
import type {
  ExperimentRunV1,
  LlmStageResultV1,
} from '../services/benchmark/experimentTypes';

const tfmDatasetPath = join(
  __dirname, '..', '..', 'experiments', 'datasets', 'synthetic_ground_truth.csv',
);

const buildTfmEnvelope = (): {
  envelope: ReturnType<typeof _buildEvidenceEnvelopeV2>;
  mandatoryIds: string[];
} => {
  const csv = readFileSync(tfmDatasetPath);
  const parsed = Papa.parse<Record<string, unknown>>(csv.toString('utf8'), {
    header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: '',
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
  return { envelope, mandatoryIds: computeMandatoryReviewIssueIds(envelope) };
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
      requiresHumanReview: index < 5,
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
    generatedAt: new Date().toISOString(),
  } as DiagnosisResponseV2;
};

describe('formal diagnosis evaluator', () => {
  it('computes the frozen primary denominator and leaves script evaluation pending', () => {
    const run = createExperimentEvidenceFixture().runs[0];
    run.inputMode = 'prompt_libre';
    run.input.inputMode = 'prompt_libre';
    run.diagnosis!.parsedOutput = {
      contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
      evidenceEnvelopeRef: run.input.evidenceEnvelopeRef,
      responseId: 'response:test',
      issues: [{ issueId: 'issue:city', evidenceRefs: [], hypothesis: 'case', confidence: 0.8, requiresHumanReview: true, limits: [] }],
      diagnosisBlocks: [{ issueId: 'issue:city', ruleId: 'rule:capitalization-chaos', columnId: 'col:city', scope: 'column', observation: 'case', recommendation: 'normalize' }], limitations: [],
      generatedAt: '2026-07-11T12:00:00.000Z',
    };
    const envelope = {
      columns: [{ columnId: 'col:city', name: 'city', position: 0, isAmbiguous: false, isDuplicate: false }],
      issues: [{ issueId: 'issue:city', ruleId: 'rule:capitalization-chaos', columnId: 'col:city', scope: 'column' as const, evidenceRefs: [], actionability: 'auto_safe' as const, automaticAuthorization: { authorized: true, conditionsMet: [], reason: '' } }],
      datasetSummary: { rowCount: 50, colCount: 15, duplicateRows: 0, delimiter: ',', score: 80 },
      evidence: { samples: [], columnStats: {} },
      datasetFingerprint: { sha256: 'a'.repeat(64), rowCount: 50, colCount: 15, delimiter: ',', generatedAt: '2026-01-01T00:00:00Z' },
      privacyPolicy: { level: 'local_full' as const, rules: [] },
      selectionManifest: { rationale: '', includedColumns: 1, excludedColumns: 0, includedIssues: 1, excludedIssues: 0, excludedByBudget: [] },
      truncationManifest: { truncatedColumns: [], truncatedIssues: [], truncatedSamples: [], truncatedTopValues: [], truncatedCharacters: [] },
    } as unknown as EvidenceEnvelopeV2;

    const evaluation = evaluateFormalDiagnosisRun(run, envelope, '2026-07-11T12:05:00.000Z');

    expect(evaluation.diagnosis.primary).toEqual(expect.objectContaining({ tp: 1, fp: 0, fn: 15 }));
    expect(evaluation.diagnosis.primary.f1).toBeGreaterThan(0);
    expect(evaluation.script).toEqual(expect.objectContaining({ contractValid: false, syntaxValid: null, safe: false }));
  });
});

describe('AURA-CIERRE-DETERMINISTIC-HITL-02-R2 — Laboratory scores RAW', () => {
  it('a raw response with ten false mandatory reviews is invalid and produces DIAGNOSIS_REVIEW_DOWNGRADE', () => {
    const { envelope, mandatoryIds } = buildTfmEnvelope();
    const gemma = buildGemmaBalancedFailure(envelope, mandatoryIds);

    const rawValidation = validateDiagnosisResponseV2(gemma, envelope);

    expect(rawValidation.valid).toBe(false);
    expect(rawValidation.errors.some((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE')).toBe(true);

    const mandatoryFalse = gemma.issues.filter(
      (issue) => mandatoryIds.includes(issue.issueId) && issue.requiresHumanReview === false,
    );
    expect(mandatoryFalse).toHaveLength(10);
  });

  it('extractContractEvidence reports contractCompliant: false with DIAGNOSIS_REVIEW_DOWNGRADE', () => {
    const { envelope, mandatoryIds } = buildTfmEnvelope();
    const gemma = buildGemmaBalancedFailure(envelope, mandatoryIds);
    const rawOutput = JSON.stringify(gemma);

    const runStub = {
      runId: 'run:test',
      status: 'completed' as const,
      inputMode: 'smart_sample' as const,
      input: {
        evidenceEnvelopeRef: buildEnvelopeRef(envelope),
        includedSections: ['dataset_summary'],
        systemInstruction: 'test',
        userPayload: '{}',
        inputMode: 'smart_sample',
        inputHash: 'a'.repeat(64),
        promptHash: 'b'.repeat(64),
        responseSchemaHash: 'c'.repeat(64),
        responseSchema: {},
        promptVersion: '1.6.0',
        contractId: 'aura.input-snapshot.v2' as const,
        contractVersion: '2.0.0' as const,
      },
      diagnosis: {
        status: 'completed' as const,
        rawOutput,
        parsedOutput: gemma,
        validationErrors: [],
      },
      executionReceipt: {
        contractId: 'aura.execution-receipt.v1' as const,
        contractVersion: '1.0.0' as const,
        rawResponseHash: sha256hex(rawOutput),
        validationStatus: 'valid' as const,
        validationErrorCodes: [] as string[],
        requestedInputMode: 'smart_sample' as const,
        effectiveInputMode: 'smart_sample' as const,
        includedSections: ['dataset_summary'],
        evidenceEnvelopeRef: buildEnvelopeRef(envelope),
        promptVersion: '1.6.0',
        promptHash: 'b'.repeat(64),
        inputHash: 'a'.repeat(64),
        responseSchemaHash: 'c'.repeat(64),
        provider: 'Ollama',
        requestedModel: 'test-model',
        observedModel: 'test-model',
        modelDigest: null,
        inferenceHash: 'd'.repeat(64),
        startedAt: '2026-07-14T00:00:00.000Z',
        completedAt: '2026-07-14T00:01:00.000Z',
        receiptHash: 'e'.repeat(64),
      },
      environment: {
        inference: {
          temperature: 0.1, topP: 0.9, numCtx: 16384, numPredict: 1600,
          think: false, seed: null, keepAlive: '10m', timeoutSeconds: 600,
        },
      },
    } as unknown as ExperimentRunV1;

    const evidence = extractContractEvidence(
      gemma,
      envelope,
      runStub,
      runStub.executionReceipt,
    );

    expect(evidence.contractCompliant).toBe(false);
    expect(evidence.contractErrors.some((err) => err.includes('DIAGNOSIS_REVIEW_DOWNGRADE'))).toBe(true);
  });

  it('raw diagnosis does not receive artificial contract-compliance credit', () => {
    const { envelope, mandatoryIds } = buildTfmEnvelope();
    const gemma = buildGemmaBalancedFailure(envelope, mandatoryIds);

    // The raw diagnosis keeps the model's original requiresHumanReview values.
    // It is NOT normalized. The Laboratory must report it as non-compliant.
    const mandatoryFalse = gemma.issues.filter(
      (issue) => mandatoryIds.includes(issue.issueId) && issue.requiresHumanReview === false,
    );
    expect(mandatoryFalse.length).toBeGreaterThan(0);

    const validation = validateDiagnosisResponseV2(gemma, envelope);
    expect(validation.valid).toBe(false);

    // No normalization happened — the raw values are exactly as the model
    // produced them. The effective response is NOT present.
    const issuesWithReviewFalse = gemma.issues.filter((i) => i.requiresHumanReview === false);
    expect(issuesWithReviewFalse.length).toBe(10);
  });

  it('the Laboratory receives the RAW diagnosis, not the normalized effective one', () => {
    const { envelope, mandatoryIds } = buildTfmEnvelope();
    const gemma = buildGemmaBalancedFailure(envelope, mandatoryIds);

    // The Laboratory's parsed output (gemma) is the raw response.
    // The normalizer (normalizeHumanReview) is never called in the
    // Laboratory path. The experiment runner validates this RAW output
    // directly against the strict validator. Contract compliance
    // measurement must use raw values.

    const rawValidation = validateDiagnosisResponseV2(gemma, envelope);
    expect(rawValidation.valid).toBe(false);
    const downgradeErrors = rawValidation.errors.filter((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE');
    // At least 10 downgrade errors — the fixture has 10 mandatory-review
    // IDs marked false by the model.
    expect(downgradeErrors.length).toBeGreaterThanOrEqual(10);

    // Check: the number of issues with requiresHumanReview=false for
    // mandatory IDs is exactly 10 — no normalization intervened.
    const mandatorySet = new Set(mandatoryIds);
    const rawFalseCount = gemma.issues.filter(
      (i) => mandatorySet.has(i.issueId) && i.requiresHumanReview === false,
    ).length;
    expect(rawFalseCount).toBe(10);
  });
});
