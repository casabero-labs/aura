/**
 * Privacy Policy — Fase 1.
 *
 * Three levels:
 * - local_full:    everything is included (local-only execution)
 * - cloud_minimized: redact, hash, omit with per-column/issue limits
 * - cloud_no_samples: no raw samples whatsoever
 */

import type { PrivacyLevel, PrivacyPolicyV2, PrivacyRuleV2 } from './types';

/**
 * Build a privacy policy for the given level.
 */
export function buildPrivacyPolicy(level: PrivacyLevel): PrivacyPolicyV2 {
  switch (level) {
    case 'local_full':
      return localFullPolicy();
    case 'cloud_minimized':
      return cloudMinimizedPolicy();
    case 'cloud_no_samples':
      return cloudNoSamplesPolicy();
  }
}

function localFullPolicy(): PrivacyPolicyV2 {
  return {
    level: 'local_full',
    rules: [],
  };
}

function cloudMinimizedPolicy(): PrivacyPolicyV2 {
  const rules: PrivacyRuleV2[] = [
    {
      type: 'redact',
      target: 'value',
      detail: 'Redact values matching email, phone, SSN, credit card, or address patterns',
    },
    {
      type: 'hash',
      target: 'column',
      detail: 'Hash Name, Ticket, and PassengerId columns with SHA-256',
    },
    {
      type: 'omit',
      target: 'sample',
      detail: 'Omit samples that cannot be redacted without losing diagnostic value',
    },
    {
      type: 'limit',
      target: 'sample',
      detail: 'Max 3 samples per issue; max 5 top values per column',
    },
    {
      type: 'limit',
      target: 'column',
      detail: 'Max 15 columns included in evidence',
    },
    {
      type: 'limit',
      target: 'issue',
      detail: 'Max 20 issues included in evidence',
    },
  ];

  return { level: 'cloud_minimized', rules };
}

function cloudNoSamplesPolicy(): PrivacyPolicyV2 {
  const rules: PrivacyRuleV2[] = [
    {
      type: 'omit',
      target: 'sample',
      detail: 'All sample values omitted — cloud_no_samples policy',
    },
    {
      type: 'omit',
      target: 'value',
      detail: 'All top values and sample lists omitted',
    },
    {
      type: 'limit',
      target: 'column',
      detail: 'Only column names, types, and aggregate stats included',
    },
  ];

  return { level: 'cloud_no_samples', rules };
}

/**
 * Check if a privacy policy allows sending raw samples.
 */
export function allowsRawSamples(policy: PrivacyPolicyV2): boolean {
  return policy.level === 'local_full';
}

/**
 * Check if a privacy policy allows sending top values.
 */
export function allowsTopValues(policy: PrivacyPolicyV2): boolean {
  return policy.level !== 'cloud_no_samples';
}

/**
 * Check if a privacy policy requires hashing for a column.
 */
export function requiresHash(policy: PrivacyPolicyV2, columnName: string): boolean {
  if (policy.level === 'local_full') return false;
  const sensitive = /^(Name|Ticket|PassengerId|Passport|SSN|Email|Phone|Address)$/i;
  return sensitive.test(columnName);
}

/**
 * Get privacy level enum from string — safe parser.
 */
export function parsePrivacyLevel(raw: string): PrivacyLevel {
  const valid: PrivacyLevel[] = ['local_full', 'cloud_minimized', 'cloud_no_samples'];
  if (valid.includes(raw as PrivacyLevel)) return raw as PrivacyLevel;
  return 'local_full';
}
