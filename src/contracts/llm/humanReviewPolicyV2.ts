/**
 * Diagnosis v2 — Human Review Policy (single source of truth).
 *
 * AURA-CIERRE-SMART-SAMPLE-HITL-01 contract fix.
 *
 * The deterministic rule that decides whether a DiagnosisIssueV2 MUST set
 * `requiresHumanReview: true` lives here. Both the constructor (which embeds
 * the resulting list into the prompt) and the validator (which rejects
 * responses that downgrade it) import from this module.
 *
 * The combined rule is the OR of two pure predicates:
 *   - governance rule (actionability, authorization, column ambiguity,
 *     unknown actionability)
 *   - no-evidence rule (the envelope attaches zero evidenceRefs to the issue)
 *
 * Both rules map exactly onto the two `DIAGNOSIS_REVIEW_DOWNGRADE` checks the
 * validator has always emitted; surfacing them as predicates keeps the
 * diagnostic error messages intact while exposing the OR result to the
 * constructor so the visible `task.issueIdsRequiringHumanReview` list is
 * authoritative.
 */

import type { EvidenceEnvelopeV2 } from './types';

export interface ColumnAmbiguityRecord {
  isAmbiguous: boolean;
  isDuplicate: boolean;
}

export interface EnvelopeIssueShape {
  actionability: string;
  automaticAuthorization: { authorized: boolean };
  columnId: string | null;
  evidenceRefs?: readonly string[];
}

export const buildColumnAmbiguityRegistry = (
  envelope: EvidenceEnvelopeV2,
): Map<string, ColumnAmbiguityRecord> => {
  const registry = new Map<string, ColumnAmbiguityRecord>();
  for (const column of envelope.columns) {
    registry.set(column.columnId, { isAmbiguous: column.isAmbiguous, isDuplicate: column.isDuplicate });
  }
  return registry;
};

const KNOWN_ACTIONABILITIES = new Set(['auto_safe', 'review_only', 'not_actionable']);

/**
 * Governance rule: returns true iff the envelope's governance declares that
 * the model MUST mark the issue as `requiresHumanReview: true`.
 *
 * Order matches the historical validator behavior exactly:
 *   1. ambiguous or duplicate column → always review
 *   2. actionability = review_only → review
 *   3. actionability = auto_safe & unauthorized → review
 *   4. actionability = not_actionable → no review (declarative)
 *   5. actionability = auto_safe & authorized → no review
 *   6. unknown actionability → review (fail closed)
 */
export const governanceDemandsReview = (
  envelopeIssue: EnvelopeIssueShape,
  columnRegistry: Map<string, ColumnAmbiguityRecord>,
): boolean => {
  if (envelopeIssue.columnId) {
    const col = columnRegistry.get(envelopeIssue.columnId);
    if (col?.isAmbiguous || col?.isDuplicate) return true;
  }
  if (envelopeIssue.actionability === 'review_only') return true;
  if (envelopeIssue.actionability === 'auto_safe' && !envelopeIssue.automaticAuthorization.authorized) return true;
  if (envelopeIssue.actionability === 'not_actionable') return false;
  if (envelopeIssue.actionability === 'auto_safe' && envelopeIssue.automaticAuthorization.authorized) return false;
  if (!KNOWN_ACTIONABILITIES.has(envelopeIssue.actionability)) return true;
  return false;
};

/**
 * No-evidence rule: returns true iff the envelope attaches zero evidenceRefs
 * to the issue. The validator always rejected `requiresHumanReview: false`
 * for any response whose evidenceRefs were empty, even when governance said
 * "auto_safe + authorized". The shared policy surfaces that requirement too
 * so the model can know it from the visible evidence.
 */
export const noEvidenceDemandsReview = (
  envelopeIssue: EnvelopeIssueShape,
): boolean => (envelopeIssue.evidenceRefs ?? []).length === 0;

/**
 * Combined rule. Constructor and validator must agree: an issue is in the
 * mandatory-review list when EITHER the governance OR the no-evidence rule
 * demands review. The validator uses the two predicates separately for
 * distinct diagnostic error messages, but the OR result is the contract.
 */
export const requiresReviewFromEnvelopeV2 = (
  envelopeIssue: EnvelopeIssueShape,
  columnRegistry: Map<string, ColumnAmbiguityRecord>,
): boolean =>
  governanceDemandsReview(envelopeIssue, columnRegistry)
  || noEvidenceDemandsReview(envelopeIssue);

/**
 * Deterministic, envelope-canonical list of issueIds that MUST be marked
 * `requiresHumanReview: true`. Order is the envelope's canonical order so
 * stable across runs and across the three input modes.
 */
export const computeIssueIdsRequiringHumanReview = (
  envelope: EvidenceEnvelopeV2,
): string[] => {
  const registry = buildColumnAmbiguityRegistry(envelope);
  const out: string[] = [];
  for (const issue of envelope.issues) {
    if (requiresReviewFromEnvelopeV2(issue, registry)) {
      out.push(issue.issueId);
    }
  }
  return out;
};