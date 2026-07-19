/**
 * Diagnosis Pipeline v2 — Orchestrator.
 *
 * Provider-neutral: receives a DiagnosisPromptPackageV2 and an adapter,
 * executes the full pipeline, and returns a validated DiagnosisResponseV2.
 *
 * CONTRACTS_V2_ENABLED=false → CONTRACTS_V2_DISABLED
 * Adapter must return raw string (provider output)
 *
 * AURA-CIERRE-DETERMINISTIC-HITL-02 — the pipeline separates the RAW model
 * response (preserved exactly for the Laboratory and the technical
 * evidence) from the EFFECTIVE product response (governance-normalized).
 * The normalization only flips `requiresHumanReview` from `false` to
 * `true` for issueIds that the shared policy demands. Any other
 * validator error remains blocking. Both the principal pipeline and the
 * Laboratory pass through the same response processor below.
 */

import type {
  DiagnosisInputPackageV2,
  DiagnosisPromptPackageV2,
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
  DiagnosisErrorCode,
  DiagnosisError,
  DiagnosisNormalizationEvidenceV2,
} from './types';
import type { ProviderMetrics } from '../../types';
import { sha256hex } from './hash';
import { buildDiagnosisInputPackageV2 } from './diagnosisInputPackageV2';
import { parseDiagnosisResponseV2, type DiagnosisParseOutcome, type ParseFailure } from './diagnosisParserV2';
import { validateDiagnosisResponseV2 } from './diagnosisValidatorV2';
import {
  HUMAN_REVIEW_NORMALIZATION_REASON,
  HUMAN_REVIEW_NORMALIZATION_POLICY,
  HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION,
  computeMandatoryReviewIssueIds,
  captureRawResponse,
  normalizeHumanReviewWithRawValidation,
  type HumanReviewNormalizationEvidence,
} from './humanReviewNormalizerV2';

/**
 * Provider adapter interface — returns raw model output as string.
 * Example adapter for testing:
 *   async (pkg) => '{"contractId":"aura.diagnosis.v2","contractVersion":"2.0.0",...}'
 */
export type DiagnosisAdapter = (
  pkg: DiagnosisPromptPackageV2,
) => Promise<string>;

/**
 * Pipeline result — either a validated DiagnosisResponseV2 or a structured error.
 */
export interface DiagnosisPipelineResult {
  success: true;
  response: DiagnosisResponseV2;
  rawResponse: DiagnosisResponseV2;
  rawValidation: {
    valid: boolean;
    errorCodes: string[];
    downgradeCount: number;
  };
  normalizationEvidence: DiagnosisNormalizationEvidenceV2;
}

export interface DiagnosisPipelineFailure {
  success: false;
  code: DiagnosisErrorCode;
  message: string;
  path: string;
  details: unknown;
  /** Optional raw validation summary even when the pipeline fails so the
   *  Laboratory and the technical export can disclose it. */
  rawValidation?: {
    valid: boolean;
    errorCodes: string[];
    downgradeCount: number;
  };
}

export type DiagnosisPipelineOutcome = DiagnosisPipelineResult | DiagnosisPipelineFailure;

function failure(
  code: DiagnosisErrorCode,
  message: string,
  path: string,
  details: unknown,
): DiagnosisPipelineFailure {
  return { success: false, code, message, path, details };
}

function summarizeValidation(
  validation: { valid: boolean; errors: Array<{ code: string; path: string; message: string }> },
): { valid: boolean; errorCodes: string[]; downgradeCount: number } {
  return {
    valid: validation.valid,
    errorCodes: validation.errors.map((e) => e.code),
    downgradeCount: validation.errors.filter((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE').length,
  };
}

function normalizeEvidence(
  evidence: HumanReviewNormalizationEvidence,
): DiagnosisNormalizationEvidenceV2 {
  return {
    applied: evidence.applied,
    field: evidence.field,
    reason: evidence.reason,
    policy: evidence.policy,
    policyVersion: evidence.policyVersion,
    normalizedIssueIds: [...evidence.normalizedIssueIds],
    originalValuesByIssueId: { ...evidence.originalValuesByIssueId },
    effectiveValuesByIssueId: { ...evidence.effectiveValuesByIssueId },
  };
}

/**
 * Run the full diagnosis pipeline:
 *   promptPackage + adapter → raw string → parsed → strict validation →
 *   normalization → re-validation → DiagnosisResponseV2 (effective).
 *
 * The raw response is preserved exactly. If the strict validator rejects
 * the raw response with ONLY `DIAGNOSIS_REVIEW_DOWNGRADE` errors, the
 * pipeline produces an immutable normalized copy whose
 * `requiresHumanReview` field is forced to `true` for every mandatory
 * review issue. The normalized copy is re-validated with the strict
 * validator and any remaining error is still blocking. Any other error
 * class is blocking as before, with no repair attempted.
 *
 * Never returns the raw response as the effective result.
 */
export function processDiagnosisResponseV2(
  envelope: EvidenceEnvelopeV2,
  raw: string,
  inputSnapshot?: DiagnosisInputPackageV2,
): DiagnosisPipelineOutcome {
  if (typeof raw !== 'string') {
    return failure(
      'DIAGNOSIS_ADAPTER_ERROR',
      'Adapter must return a string',
      'adapter',
      typeof raw,
    );
  }

  // 2. Parse — strict JSON only
  const parsed = parseDiagnosisResponseV2(raw);
  if (!parsed.success) {
    const pf: ParseFailure = parsed as ParseFailure;
    return {
      success: false,
      code: pf.error.code,
      message: pf.error.message,
      path: pf.error.path,
      details: pf.error.details,
    };
  }

  // 3. Strict validate the raw response — this is what the Laboratory sees.
  let rawValidation;
  try {
    rawValidation = validateDiagnosisResponseV2(parsed.response, envelope, inputSnapshot);
  } catch (err) {
    return failure(
      'DIAGNOSIS_SCHEMA_INVALID',
      'Validator threw an unexpected error',
      '',
      err instanceof Error ? err.message : String(err),
    );
  }
  const rawSummary = summarizeValidation(rawValidation);

  // 3a. If the raw response already passes strict validation, return it
  //     as both raw and effective (no normalization needed).
  if (rawValidation.valid) {
    const captured = captureRawResponse(parsed.response);
    return {
      success: true,
      response: captured,
      rawResponse: captured,
      rawValidation: rawSummary,
      normalizationEvidence: {
        applied: false,
        field: 'requiresHumanReview',
        reason: HUMAN_REVIEW_NORMALIZATION_REASON,
        policy: HUMAN_REVIEW_NORMALIZATION_POLICY,
        policyVersion: HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION,
        normalizedIssueIds: [],
        originalValuesByIssueId: Object.fromEntries(
          captured.issues.map((issue) => [issue.issueId, issue.requiresHumanReview]),
        ),
        effectiveValuesByIssueId: Object.fromEntries(
          captured.issues.map((issue) => [issue.issueId, issue.requiresHumanReview]),
        ),
      },
    };
  }

  // 3b. The raw response failed validation. The pipeline only attempts
  //     normalization when the failure is EXCLUSIVELY downgrade errors.
  //     Any other error class (schema, reference, executable content,
  //     unsupported claims, missing coverage, malformed JSON via upstream
  //     parser, etc.) is blocking and we surface it unchanged.
  //     Guard: require at least one error; Array.every() returns true for
  //     an empty array, which would incorrectly enter normalization.
  const onlyDowngrade =
    rawValidation.errors.length > 0
    && rawValidation.errors.every((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE');
  if (!onlyDowngrade) {
    if (rawValidation.errors.length > 0) {
      const firstError = rawValidation.errors[0]!;
      return {
        success: false,
        code: firstError.code as DiagnosisErrorCode,
        message: firstError.message,
        path: firstError.path,
        details: {
          validationErrors: rawValidation.errors,
        },
        rawValidation: rawSummary,
      };
    }
    return failure(
      'DIAGNOSIS_SCHEMA_INVALID',
      'Validator returned valid=false with zero errors — this is a fatal internal inconsistency.',
      '',
      { validationErrors: [] },
    );
  }

  // 3c. Normalize. The shared policy is the single source of truth for
  //     which issueIds require human review. The raw response is captured
  //     for the Laboratory and the technical evidence; the effective
  //     response is the immutable normalized copy.
  const rawCaptured = captureRawResponse(parsed.response);
  const normalizeResult = normalizeHumanReviewWithRawValidation(
    rawCaptured,
    envelope,
    (candidate, candidateEnvelope) => validateDiagnosisResponseV2(
      candidate,
      candidateEnvelope,
      inputSnapshot,
    ),
  );
  const { rawResponse: rawForLab, effectiveResponse, evidence } = normalizeResult;

  // 3d. Re-validate the normalized response with the strict validator.
  //     Any remaining error (including another downgrade error, which
  //     would only happen if the policy misclassified an issue) is
  //     blocking.
  let effectiveValidation;
  try {
    effectiveValidation = validateDiagnosisResponseV2(effectiveResponse, envelope, inputSnapshot);
  } catch (err) {
    return failure(
      'DIAGNOSIS_SCHEMA_INVALID',
      'Validator threw an unexpected error on the normalized response',
      '',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!effectiveValidation.valid) {
    const firstError = effectiveValidation.errors[0]!;
    return {
      success: false,
      code: firstError.code as DiagnosisErrorCode,
      message: firstError.message,
      path: firstError.path,
      details: {
        validationErrors: effectiveValidation.errors,
        normalizationEvidence: normalizeEvidence(evidence),
      },
      rawValidation: rawSummary,
    };
  }

  // 3e. Optional sanity: every mandatory issueId must now be true in the
  //     effective response. If for any reason the policy produced an
  //     empty list but the validator still emitted downgrade errors,
  //     fail closed.
  const mandatoryIds = computeMandatoryReviewIssueIds(envelope);
  for (const id of mandatoryIds) {
    const issue = effectiveResponse.issues.find((candidate) => candidate.issueId === id);
    if (!issue || issue.requiresHumanReview !== true) {
      return {
        success: false,
        code: 'DIAGNOSIS_REVIEW_DOWNGRADE',
        message: 'Normalization failed to enforce mandatory review for an issueId.',
        path: `issues[${effectiveResponse.issues.findIndex((c) => c.issueId === id)}].requiresHumanReview`,
        details: {
          issueId: id,
          normalizationEvidence: normalizeEvidence(evidence),
        },
        rawValidation: rawSummary,
      };
    }
  }

  return {
    success: true,
    response: effectiveResponse,
    rawResponse: rawForLab,
    rawValidation: rawSummary,
    normalizationEvidence: normalizeEvidence(evidence),
  };
}

/**
 * Invoke the provider and process its exact raw response through the canonical
 * parser, validator and deterministic governance normalization.
 */
export async function runDiagnosisPipeline(
  envelope: EvidenceEnvelopeV2,
  promptPackage: DiagnosisPromptPackageV2,
  adapter: DiagnosisAdapter,
  inputSnapshot?: DiagnosisInputPackageV2,
): Promise<DiagnosisPipelineOutcome> {
  let raw: string;
  try {
    raw = await adapter(promptPackage);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    return failure(
      'DIAGNOSIS_ADAPTER_ERROR',
      `Adapter error: ${cause}`,
      'adapter',
      cause,
    );
  }
  return processDiagnosisResponseV2(envelope, raw, inputSnapshot);
}

/**
 * Build envelope + prompt + run pipeline in one call.
 * Convenience wrapper for the full flow.
 */
export async function diagnoseWithV2(
  envelope: EvidenceEnvelopeV2,
  adapter: DiagnosisAdapter,
): Promise<DiagnosisPipelineOutcome> {
  const inputSnapshot = buildDiagnosisInputPackageV2({
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
  return runDiagnosisPipeline(envelope, promptPackage, adapter, inputSnapshot);
}
