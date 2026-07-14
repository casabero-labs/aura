/**
 * Diagnosis v2 — Human Review Normalizer.
 *
 * AURA-CIERRE-DETERMINISTIC-HITL-02 contract.
 *
 * Splits the diagnosis outcome into two clearly separated views:
 *
 *   1. RAW MODEL RESULT
 *      - The exact provider response and the model's original
 *        `requiresHumanReview` values.
 *      - Validation against the envelope reports contract compliance using
 *        those original values. This is what the Laboratory measures.
 *
 *   2. EFFECTIVE PRODUCT DIAGNOSIS
 *      - An immutable, normalized copy of the response with
 *        `requiresHumanReview = true` forced for every issueId that the
 *        shared policy `computeIssueIdsRequiringHumanReview()` demands.
 *      - No other field is touched.
 *      - Validated with the existing strict validator before being used by
 *        the normal AURA diagnosis flow.
 *
 * `requiresHumanReview` is an AURA governance decision. The prompt can ask
 * the model to comply, but the model is non-deterministic: the Laboratory
 * therefore keeps evaluating the raw response, while the normal product
 * flow uses the normalized response so that a stochastic false-negative
 * does not block the diagnosis.
 */

import type { DiagnosisResponseV2, EvidenceEnvelopeV2 } from './types';
import { computeIssueIdsRequiringHumanReview } from './humanReviewPolicyV2';

export const HUMAN_REVIEW_NORMALIZATION_REASON = 'AURA_GOVERNANCE_ENFORCED';
export const HUMAN_REVIEW_NORMALIZATION_FIELD = 'requiresHumanReview';
export const HUMAN_REVIEW_NORMALIZATION_POLICY = 'aura.human-review-policy.v2';
export const HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION = '1.0.0';

export interface HumanReviewNormalizationEvidence {
  applied: boolean;
  field: typeof HUMAN_REVIEW_NORMALIZATION_FIELD;
  reason: typeof HUMAN_REVIEW_NORMALIZATION_REASON;
  policy: typeof HUMAN_REVIEW_NORMALIZATION_POLICY;
  policyVersion: typeof HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION;
  normalizedIssueIds: string[];
  originalValuesByIssueId: Record<string, boolean>;
  effectiveValuesByIssueId: Record<string, boolean>;
}

export interface RawValidationResult {
  valid: boolean;
  errorCodes: string[];
  downgradeCount: number;
}

export interface HumanReviewNormalizationResult {
  rawResponse: DiagnosisResponseV2;
  effectiveResponse: DiagnosisResponseV2;
  evidence: HumanReviewNormalizationEvidence;
}

export interface NormalizeHumanReviewResult extends HumanReviewNormalizationResult {
  rawValidation: RawValidationResult;
}

const compareNormalized = (a: DiagnosisResponseV2, b: DiagnosisResponseV2): boolean => {
  if (a === b) return true;
  if (a.issues.length !== b.issues.length) return false;
  for (let i = 0; i < a.issues.length; i += 1) {
    const ai = a.issues[i]!;
    const bi = b.issues[i]!;
    if (ai.issueId !== bi.issueId) return false;
    if (ai.requiresHumanReview !== bi.requiresHumanReview) return false;
  }
  return true;
};

/**
 * Builds the deterministic, ordered list of issueIds whose
 * `requiresHumanReview` field AURA will force to `true` on the product
 * diagnosis. The list is shared with the prompt constructor and the
 * validator through `humanReviewPolicyV2.ts`.
 */
export const computeMandatoryReviewIssueIds = (
  envelope: EvidenceEnvelopeV2,
): string[] => computeIssueIdsRequiringHumanReview(envelope);

/**
 * Returns the original (untouched) response. Used by the Laboratory
 * runner and by callers that need to inspect what the model actually said.
 */
export const captureRawResponse = (
  response: DiagnosisResponseV2,
): DiagnosisResponseV2 => {
  const captured: DiagnosisResponseV2 = {
    ...response,
    issues: response.issues.map((issue) => ({
      ...issue,
      evidenceRefs: [...issue.evidenceRefs],
      limits: [...issue.limits],
    })),
    diagnosisBlocks: response.diagnosisBlocks.map((block) => ({ ...block })),
    limitations: [...response.limitations],
  };
  if (response.visualizations && response.visualizations.length > 0) {
    captured.visualizations = response.visualizations.map((viz) => ({
      ...viz,
      issueIds: [...viz.issueIds],
    }));
  }
  return captured;
};

/**
 * Evaluates the raw response against the envelope without modifying it.
 * Returns a non-blocking summary that the Laboratory uses to count
 * `DIAGNOSIS_REVIEW_DOWNGRADE` occurrences exactly as before.
 *
 * NOTE: This is a thin convenience wrapper around the strict validator.
 * It must NEVER relax, swallow, or repair any field; it only counts what
 * the strict validator already reports.
 */
export const evaluateRawContractCompliance = (
  response: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  validateStrict: (
    response: DiagnosisResponseV2,
    envelope: EvidenceEnvelopeV2,
  ) => { valid: boolean; errors: Array<{ code: string; path: string; message: string }> },
): RawValidationResult => {
  const result = validateStrict(response, envelope);
  const downgradeCount = result.errors.filter((e) => e.code === 'DIAGNOSIS_REVIEW_DOWNGRADE').length;
  return {
    valid: result.valid,
    errorCodes: result.errors.map((e) => e.code),
    downgradeCount,
  };
};

/**
 * Produces an immutable copy of the response with `requiresHumanReview`
 * forced to `true` for every mandatory-review issueId. No other field is
 * touched. The original response is preserved exactly so the Laboratory
 * can still measure the model's contract compliance.
 */
export const normalizeHumanReview = (
  rawResponse: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
): HumanReviewNormalizationResult => {
  const mandatoryIds = computeMandatoryReviewIssueIds(envelope);
  const mandatorySet = new Set(mandatoryIds);

  const originalValuesByIssueId: Record<string, boolean> = {};
  const effectiveValuesByIssueId: Record<string, boolean> = {};
  const normalizedIssueIds: string[] = [];

  const normalizedIssues = rawResponse.issues.map((issue) => {
    const original = issue.requiresHumanReview;
    originalValuesByIssueId[issue.issueId] = original;
    const mustBeTrue = mandatorySet.has(issue.issueId);
    const effective = mustBeTrue ? true : original;
    effectiveValuesByIssueId[issue.issueId] = effective;
    if (mustBeTrue && original !== true) normalizedIssueIds.push(issue.issueId);
    return {
      ...issue,
      evidenceRefs: [...issue.evidenceRefs],
      limits: [...issue.limits],
      requiresHumanReview: effective,
    };
  });

  const effectiveResponse: DiagnosisResponseV2 = {
    ...rawResponse,
    issues: normalizedIssues,
    diagnosisBlocks: rawResponse.diagnosisBlocks.map((block) => ({ ...block })),
    limitations: [...rawResponse.limitations],
  };
  if (rawResponse.visualizations && rawResponse.visualizations.length > 0) {
    effectiveResponse.visualizations = rawResponse.visualizations.map((viz) => ({
      ...viz,
      issueIds: [...viz.issueIds],
    }));
  }

  const evidence: HumanReviewNormalizationEvidence = {
    applied: normalizedIssueIds.length > 0,
    field: HUMAN_REVIEW_NORMALIZATION_FIELD,
    reason: HUMAN_REVIEW_NORMALIZATION_REASON,
    policy: HUMAN_REVIEW_NORMALIZATION_POLICY,
    policyVersion: HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION,
    normalizedIssueIds,
    originalValuesByIssueId,
    effectiveValuesByIssueId,
  };

  return {
    rawResponse,
    effectiveResponse,
    evidence,
  };
};

/**
 * Convenience that combines normalization with raw compliance evaluation.
 * The returned `rawValidation` describes the raw response against the
 * envelope using the strict validator — it never blocks the caller.
 */
export const normalizeHumanReviewWithRawValidation = (
  rawResponse: DiagnosisResponseV2,
  envelope: EvidenceEnvelopeV2,
  validateStrict: (
    response: DiagnosisResponseV2,
    envelope: EvidenceEnvelopeV2,
  ) => { valid: boolean; errors: Array<{ code: string; path: string; message: string }> },
): NormalizeHumanReviewResult => {
  const normalized = normalizeHumanReview(rawResponse, envelope);
  const rawValidation = evaluateRawContractCompliance(rawResponse, envelope, validateStrict);
  return { ...normalized, rawValidation };
};

/**
 * Returns true iff two normalized responses are byte-identical apart from
 * the `requiresHumanReview` field. Used by tests that prove normalization
 * does not touch any other field.
 */
export const onlyRequiresHumanReviewDiffers = (
  raw: DiagnosisResponseV2,
  effective: DiagnosisResponseV2,
): boolean => {
  const rawExceptField = {
    ...raw,
    issues: raw.issues.map((issue) => ({ ...issue, requiresHumanReview: null as unknown as boolean })),
  };
  const effectiveExceptField = {
    ...effective,
    issues: effective.issues.map((issue) => ({ ...issue, requiresHumanReview: null as unknown as boolean })),
  };
  return JSON.stringify(rawExceptField) === JSON.stringify(effectiveExceptField)
    && !compareNormalized(raw, effective);
};
