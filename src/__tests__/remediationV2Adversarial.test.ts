/**
 * Remediation v2 — Adversarial Tests.
 */
import { describe, it, expect } from 'vitest';
import { computeEffectiveActionability } from '../contracts/llm/remediationBuilderV2';
import { lookupRemediationAction } from '../contracts/llm/remediationPolicyV2';
import type { RemediationContextIssueV2, RemediationContextColumnV2, Actionability } from '../contracts/llm';

const normalCol: RemediationContextColumnV2 = { columnId: 'col:Age', name: 'Age', position: 0, duplicateOrdinal: 0, isAmbiguous: false, isDuplicate: false };
const ambiguousCol: RemediationContextColumnV2 = { ...normalCol, isAmbiguous: true, isDuplicate: true };

function makeIssue(overrides: Partial<RemediationContextIssueV2> = {}): RemediationContextIssueV2 {
  return {
    issueId: 'iss-1',
    ruleId: 'rule:trim-whitespace',
    columnId: 'col:Age',
    scope: 'column',
    evidenceRefs: [],
    actionability: 'auto_safe' as Actionability,
    automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'OK' },
    ...overrides,
  };
}

describe('computeEffectiveActionability', () => {
  it('trusted not_actionable stays not_actionable', () => {
    const r = computeEffectiveActionability(makeIssue({ actionability: 'not_actionable' }), { requiresHumanReview: false }, [normalCol]);
    expect(r).toBe('not_actionable');
  });
  it('trusted review_only stays review_only', () => {
    const r = computeEffectiveActionability(makeIssue({ actionability: 'review_only' }), { requiresHumanReview: false }, [normalCol]);
    expect(r).toBe('review_only');
  });
  it('missing diagnosis issue → review_only', () => {
    const r = computeEffectiveActionability(makeIssue(), undefined, [normalCol]);
    expect(r).toBe('review_only');
  });
  it('authorization false → review_only', () => {
    const r = computeEffectiveActionability(makeIssue({ automaticAuthorization: { actionType: 'trim_whitespace', authorized: false, conditionsMet: [], reason: 'No' } }), { requiresHumanReview: false }, [normalCol]);
    expect(r).toBe('review_only');
  });
  it('ambiguous column → review_only', () => {
    const r = computeEffectiveActionability(makeIssue(), { requiresHumanReview: false }, [ambiguousCol]);
    expect(r).toBe('review_only');
  });
  it('diagnosis requiresHumanReview → review_only', () => {
    const r = computeEffectiveActionability(makeIssue(), { requiresHumanReview: true }, [normalCol]);
    expect(r).toBe('review_only');
  });
  it('auto_safe with exact match → auto_safe', () => {
    const r = computeEffectiveActionability(makeIssue(), { requiresHumanReview: false }, [normalCol]);
    expect(r).toBe('auto_safe');
  });
  it('unknown rule with auth true cannot be auto_safe', () => {
    const r = computeEffectiveActionability(makeIssue({ ruleId: 'rule:unknown', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: [], reason: 'X' } }), { requiresHumanReview: false }, [normalCol]);
    expect(r).toBe('review_only');
  });
  it('authorization actionType mismatch → review_only', () => {
    const r = computeEffectiveActionability(makeIssue({ automaticAuthorization: { actionType: 'drop_exact_duplicates', authorized: true, conditionsMet: [], reason: 'X' } }), { requiresHumanReview: false }, [normalCol]);
    expect(r).toBe('review_only');
  });
});

describe('lookupRemediationAction — adversarial', () => {
  it('malicious SQL injection in ruleId does not crash', () => {
    expect(() => lookupRemediationAction("rule:'; DROP TABLE")).not.toThrow();
  });
  it('empty string returns requires_human_review', () => {
    expect(lookupRemediationAction('')).toBe('requires_human_review');
  });
  it('regex characters do not affect lookup', () => {
    expect(lookupRemediationAction('rule:.*')).toBe('requires_human_review');
  });
});
