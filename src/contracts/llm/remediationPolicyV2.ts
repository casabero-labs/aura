/**
 * Remediation Policy v2 — Deterministic ruleId → actionType mapping.
 *
 * Exact lookup. NO regex, NO includes(), NO inference from recommendation/hypothesis.
 * Unknown rules → requires_human_review.
 */

import type { RemediationActionTypeV2 } from './types';

type PolicyEntry = {
  actionType: RemediationActionTypeV2;
};

const POLICY: Record<string, PolicyEntry> = {
  'rule:trim-whitespace':      { actionType: 'trim_whitespace' },
  'rule:exact-duplicates':     { actionType: 'drop_exact_duplicates' },
  'rule:toxic-placeholders':   { actionType: 'normalize_placeholders' },
  'rule:capitalization-chaos': { actionType: 'normalize_casing' },
  'rule:disguised-numbers':    { actionType: 'convert_disguised_numbers' },
};

export function lookupRemediationAction(ruleId: string): RemediationActionTypeV2 {
  const entry = POLICY[ruleId];
  if (entry) return entry.actionType;
  return 'requires_human_review';
}

export function isKnownRule(ruleId: string): boolean {
  return ruleId in POLICY;
}
