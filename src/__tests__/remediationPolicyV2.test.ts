/**
 * Remediation Policy v2 — Unit Tests.
 */
import { describe, it, expect } from 'vitest';
import { lookupRemediationAction, isKnownRule } from '../contracts/llm/remediationPolicyV2';

describe('lookupRemediationAction', () => {
  it('rule:trim-whitespace → trim_whitespace', () => {
    expect(lookupRemediationAction('rule:trim-whitespace')).toBe('trim_whitespace');
  });
  it('rule:exact-duplicates → drop_exact_duplicates', () => {
    expect(lookupRemediationAction('rule:exact-duplicates')).toBe('drop_exact_duplicates');
  });
  it('rule:toxic-placeholders → normalize_placeholders', () => {
    expect(lookupRemediationAction('rule:toxic-placeholders')).toBe('normalize_placeholders');
  });
  it('rule:capitalization-chaos → normalize_casing', () => {
    expect(lookupRemediationAction('rule:capitalization-chaos')).toBe('normalize_casing');
  });
  it('rule:disguised-numbers → convert_disguised_numbers', () => {
    expect(lookupRemediationAction('rule:disguised-numbers')).toBe('convert_disguised_numbers');
  });
  it('unknown rule → requires_human_review', () => {
    expect(lookupRemediationAction('rule:nonexistent')).toBe('requires_human_review');
  });
});

describe('isKnownRule', () => {
  it('known rule returns true', () => {
    expect(isKnownRule('rule:trim-whitespace')).toBe(true);
  });
  it('unknown rule returns false', () => {
    expect(isKnownRule('rule:made-up')).toBe(false);
  });
});
