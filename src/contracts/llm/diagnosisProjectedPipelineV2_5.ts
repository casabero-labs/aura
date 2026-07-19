import type {
  DiagnosisInputPackageV2,
  DiagnosisPromptPackageV2,
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  ValidationErrorV2,
} from './types';
import {
  processDiagnosisResponseV2 as processDiagnosisResponseV2Legacy,
  runDiagnosisPipeline as runDiagnosisPipelineLegacy,
  type DiagnosisAdapter,
  type DiagnosisPipelineFailure,
  type DiagnosisPipelineOutcome,
} from './diagnosisPipelineV2';
import { parseDiagnosisResponseV2 } from './diagnosisParserV2';
import { captureRawResponse } from './humanReviewNormalizerV2';
import { findUnsupportedDiagnosisClaims } from './diagnosisEvidenceReview';
import {
  isDiagnosisInputPackageV2_5,
  resolveDiagnosisEvidenceAliasesV1,
  type DiagnosisInputPackageV2_5,
  type ResolvedEvidenceCitationV1,
} from './diagnosisEvidenceIdentityV1';
import {
  buildDiagnosisInputPackageV2_5,
  validateDiagnosisInputSnapshotIntegrityV2_5,
} from './diagnosisInputPackageV2_5';

export interface ProjectedDiagnosisPipelineEvidenceV1 {
  aliasContract: 'aura.evidence-alias.v1';
  aliasMapHash: string;
  projectionHash: string;
  citations: ResolvedEvidenceCitationV1[];
}

export type DiagnosisPipelineOutcomeV2_5 = DiagnosisPipelineOutcome & {
  evidenceResolution?: ProjectedDiagnosisPipelineEvidenceV1;
};

const projectionEvidenceByIssue = (
  snapshot: DiagnosisInputPackageV2_5,
  envelope: EvidenceEnvelopeV2,
): Map<string, string> => {
  const payload = JSON.parse(snapshot.userPayload) as {
    visibleEvidence?: {
      datasetSummary?: unknown;
      datasetSchema?: unknown;
      issueRegistryMinimal?: Array<Record<string, unknown>>;
      columnStatistics?: Record<string, unknown>;
      ruleActivations?: Array<Record<string, unknown>>;
      evidenceSamples?: Array<Record<string, unknown>>;
      badSampleAnchors?: Array<Record<string, unknown>>;
    };
  };
  const visible = payload.visibleEvidence ?? {};
  const recordsForIssue = (
    records: Array<Record<string, unknown>> | undefined,
    issueId: string,
  ) => (records ?? []).filter((record) => record.issueId === issueId);
  return new Map(envelope.issues.map((issue) => [
    issue.issueId,
    JSON.stringify({
      datasetSummary: visible.datasetSummary,
      datasetSchema: visible.datasetSchema,
      issueRegistry: recordsForIssue(visible.issueRegistryMinimal, issue.issueId),
      columnStatistics: issue.columnId ? visible.columnStatistics?.[issue.columnId] : undefined,
      ruleActivations: recordsForIssue(visible.ruleActivations, issue.issueId),
      evidenceSamples: recordsForIssue(visible.evidenceSamples, issue.issueId),
      badSampleAnchors: recordsForIssue(visible.badSampleAnchors, issue.issueId),
    }),
  ]));
};

const preflightProjectedDiagnosis = (
  response: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  snapshot: DiagnosisInputPackageV2_5,
): {
  errors: ValidationErrorV2[];
  resolved: DiagnosisResponseV2;
  citations: ResolvedEvidenceCitationV1[];
} => {
  const integrity = validateDiagnosisInputSnapshotIntegrityV2_5(snapshot, envelope);
  if (!integrity.valid) {
    return { errors: integrity.errors, resolved: response, citations: [] };
  }

  const resolution = resolveDiagnosisEvidenceAliasesV1(response, snapshot.evidenceAliasMap);
  const errors = [...resolution.errors];
  if (errors.length === 0) {
    const visibleEvidence = projectionEvidenceByIssue(snapshot, envelope);
    for (const claim of findUnsupportedDiagnosisClaims(response, envelope, visibleEvidence)) {
      errors.push({
        code: 'DIAGNOSIS_REFERENCE_INVALID',
        path: claim.path,
        message: 'Quoted data value is not supported by the visible input projection.',
        value: { issueId: claim.issueId, literal: claim.literal },
      });
    }
  }

  return {
    errors,
    resolved: resolution.response,
    citations: resolution.citations,
  };
};

const projectedFailure = (
  errors: ValidationErrorV2[],
): DiagnosisPipelineFailure => {
  const first = errors[0]!;
  const snapshotError = first.code.includes('SNAPSHOT')
    || first.code.includes('HASH_MISMATCH')
    || first.code === 'DIAGNOSIS_ENVELOPE_MISMATCH';
  return {
    success: false,
    code: snapshotError ? 'DIAGNOSIS_SCHEMA_INVALID' : 'DIAGNOSIS_REFERENCE_INVALID',
    message: first.message,
    path: first.path,
    details: { validationErrors: errors },
    rawValidation: {
      valid: false,
      errorCodes: errors.map((entry) => entry.code),
      downgradeCount: 0,
    },
  };
};

/**
 * Compatibility dispatcher. Historical snapshots keep the legacy behavior;
 * alias-aware snapshots are verified, resolved and only then enter the
 * existing deterministic V2 validator and HITL normalizer.
 */
export const processDiagnosisResponseV2_5 = (
  envelope: EvidenceEnvelopeV2,
  raw: string,
  inputSnapshot?: DiagnosisInputPackageV2,
): DiagnosisPipelineOutcomeV2_5 => {
  if (!inputSnapshot || !isDiagnosisInputPackageV2_5(inputSnapshot)) {
    return processDiagnosisResponseV2Legacy(envelope, raw, inputSnapshot);
  }

  const parsed = parseDiagnosisResponseV2(raw);
  if (!parsed.success) {
    return {
      success: false,
      code: parsed.error.code,
      message: parsed.error.message,
      path: parsed.error.path,
      details: parsed.error.details,
    };
  }

  const preflight = preflightProjectedDiagnosis(parsed.response, envelope, inputSnapshot);
  if (preflight.errors.length > 0) return projectedFailure(preflight.errors);

  const legacyOutcome = processDiagnosisResponseV2Legacy(
    envelope,
    JSON.stringify(preflight.resolved),
  );
  if (!legacyOutcome.success) return legacyOutcome;

  return {
    ...legacyOutcome,
    rawResponse: captureRawResponse(parsed.response),
    evidenceResolution: {
      aliasContract: 'aura.evidence-alias.v1',
      aliasMapHash: inputSnapshot.evidenceAliasMapHash,
      projectionHash: inputSnapshot.projectionHash,
      citations: preflight.citations,
    },
  };
};

export const runDiagnosisPipelineV2_5 = async (
  envelope: EvidenceEnvelopeV2,
  promptPackage: DiagnosisPromptPackageV2,
  adapter: DiagnosisAdapter,
  inputSnapshot?: DiagnosisInputPackageV2,
): Promise<DiagnosisPipelineOutcomeV2_5> => {
  if (!inputSnapshot || !isDiagnosisInputPackageV2_5(inputSnapshot)) {
    return runDiagnosisPipelineLegacy(envelope, promptPackage, adapter, inputSnapshot);
  }
  let raw: string;
  try {
    raw = await adapter(promptPackage);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      success: false,
      code: 'DIAGNOSIS_ADAPTER_ERROR',
      message: `Adapter error: ${message}`,
      path: 'adapter',
      details: message,
    };
  }
  return processDiagnosisResponseV2_5(envelope, raw, inputSnapshot);
};

export const diagnoseWithV2_5 = async (
  envelope: EvidenceEnvelopeV2,
  adapter: DiagnosisAdapter,
): Promise<DiagnosisPipelineOutcomeV2_5> => {
  const inputSnapshot = buildDiagnosisInputPackageV2_5({
    score: envelope.datasetSummary.score,
    rowCount: envelope.datasetSummary.rowCount,
    colCount: envelope.datasetSummary.colCount,
    duplicateRows: envelope.datasetSummary.duplicateRows,
    delimiterDetected: envelope.datasetSummary.delimiter,
  }, envelope, 'recommended');
  const promptPackage: DiagnosisPromptPackageV2 = {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: inputSnapshot.evidenceEnvelopeRef,
    promptVersion: inputSnapshot.promptVersion,
    promptHash: inputSnapshot.promptHash,
    systemInstruction: inputSnapshot.systemInstruction,
    userPayload: inputSnapshot.userPayload,
    responseSchema: inputSnapshot.responseSchema,
    generatedAt: new Date().toISOString(),
  };
  return runDiagnosisPipelineV2_5(envelope, promptPackage, adapter, inputSnapshot);
};
