/**
 * Privacy Policy — Phase 1B.
 *
 * - parsePrivacyLevel: invalid → cloud_no_samples (fail-closed)
 * - Real PII redaction: email, phone, SSN, credit card, address, URL
 * - Detection uses semanticType, PII category, AND generic patterns
 * - No hardcoded column names (Name, Ticket, etc.)
 * - cloud_minimized produces real minimized samples
 * - cloud_no_samples: samples=[], topValues=[]
 */

import type { PrivacyLevel, PrivacyPolicyV2, PrivacyRuleV2, PIIConfig } from './types';
import { sha256hex } from './hash';

// ── PII patterns (generic, no column-name hardcoding) ──
const PII_PATTERNS: RegExp[] = [
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,  // email
  /^\+?[\d\s\-().]{7,20}$/,                                // phone (7+ digits)
  /^\d{3}-\d{2}-\d{4}$/,                                   // SSN-ish
  /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,             // credit card
  /^\d{8,}(-\d{1,4})?$/,                                   // long numeric ID (8+ digits)
  /^https?:\/\/[^\s]+$/i,                                   // URL
  /^\d+\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|blvd|lane|ln|way|ct|court|pl|place)[\s.,]/i, // address
];

const PII_SEMANTIC_TYPES = new Set([
  'name', 'email', 'phone', 'ssn', 'passport', 'id', 'identifier',
  'address', 'url', 'credit_card', 'iban', 'dni', 'document',
  'nombre', 'correo', 'telefono', 'direccion', 'documento',
]);

const PII_CATEGORY_PATTERNS = [
  /\b(pii|personal|sensitive|identif|privado|sensible|confidencial)\b/i,
];

/**
 * Build PII config from column info for smarter detection.
 */
export function buildPIIConfig(columnMetas: Array<{ name: string; semanticType?: string; inferredType?: string }>): PIIConfig {
  const semanticTypes: string[] = [];
  const categoryPatterns: RegExp[] = [];
  const columnNamePatterns: RegExp[] = [];
  const genericPatterns: RegExp[] = [...PII_PATTERNS];

  for (const meta of columnMetas) {
    if (meta.semanticType && PII_SEMANTIC_TYPES.has(meta.semanticType.toLowerCase())) {
      semanticTypes.push(meta.semanticType.toLowerCase());
      // Escape regex-special chars in column name
      const escaped = meta.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      columnNamePatterns.push(new RegExp(`^${escaped}$`, 'i'));
    }
  }

  return { semanticTypes, categoryPatterns, columnNamePatterns, genericPatterns };
}

/**
 * Determine if a column value is PII.
 */
export function isPII(value: string, config?: PIIConfig): boolean {
  const s = String(value).trim();
  if (s.length === 0) return false;

  const patterns = config?.genericPatterns || PII_PATTERNS;
  // Only match if value looks like a single data item (no commas, semicolons)
  if (/[,;]/.test(s) && s.length > 40) return false;
  return patterns.some(p => p.test(s));
}

/**
 * Determine if a column should be hashed based on semantic type and category.
 */
export function shouldHashColumn(
  columnName: string,
  semanticType?: string,
  category?: string,
  config?: PIIConfig,
): boolean {
  if (semanticType && PII_SEMANTIC_TYPES.has(semanticType.toLowerCase())) return true;
  if (category && PII_CATEGORY_PATTERNS.some(p => p.test(category))) return true;
  if (config?.columnNamePatterns?.some(p => p.test(columnName))) return true;
  return false;
}

/**
 * Redact a PII value.
 */
export function redactValue(value: string): string {
  const s = String(value).trim();
  if (s.length <= 2) return '**';
  if (s.includes('@')) {
    const [local, domain] = s.split('@');
    return `${local[0]}***@${domain}`;
  }
  if (/^\d+$/.test(s)) {
    return s.slice(0, 2) + '***' + s.slice(-2);
  }
  return s.slice(0, 1) + '***' + s.slice(-1);
}

/**
 * Hash a value deterministically with SHA-256.
 */
export function hashValue(value: string): string {
  return `sha256:${sha256hex(String(value))}`;
}

// ── Policy builders ──

export function buildPrivacyPolicy(level: PrivacyLevel): PrivacyPolicyV2 {
  switch (level) {
    case 'local_full': return localFullPolicy();
    case 'cloud_minimized': return cloudMinimizedPolicy();
    case 'cloud_no_samples': return cloudNoSamplesPolicy();
  }
}

function localFullPolicy(): PrivacyPolicyV2 {
  return { level: 'local_full', rules: [] };
}

function cloudMinimizedPolicy(): PrivacyPolicyV2 {
  const rules: PrivacyRuleV2[] = [
    { type: 'redact', target: 'value', detail: 'Redact values matching PII patterns (email, phone, SSN, credit card, address, URL)' },
    { type: 'hash', target: 'column', detail: 'Hash entire column when semanticType or category indicates PII' },
    { type: 'omit', target: 'sample', detail: 'Omit samples that cannot be redacted without losing diagnostic value' },
    { type: 'limit', target: 'sample', detail: 'Max 3 samples per issue' },
    { type: 'limit', target: 'column', detail: 'Max 15 columns in evidence' },
    { type: 'limit', target: 'issue', detail: 'Max 20 issues in evidence' },
  ];
  return { level: 'cloud_minimized', rules };
}

function cloudNoSamplesPolicy(): PrivacyPolicyV2 {
  const rules: PrivacyRuleV2[] = [
    { type: 'omit', target: 'sample', detail: 'ALL samples omitted per cloud_no_samples' },
    { type: 'omit', target: 'value', detail: 'ALL top values omitted per cloud_no_samples' },
    { type: 'limit', target: 'column', detail: 'Only column names, types, and aggregate stats' },
  ];
  return { level: 'cloud_no_samples', rules };
}

// ── Accessors ──

export function allowsRawSamples(policy: PrivacyPolicyV2): boolean {
  return policy.level === 'local_full';
}

export function allowsTopValues(policy: PrivacyPolicyV2): boolean {
  return policy.level !== 'cloud_no_samples';
}

/**
 * Parse privacy level. Fail-closed: invalid → cloud_no_samples.
 */
export function parsePrivacyLevel(raw: string): PrivacyLevel {
  const valid: PrivacyLevel[] = ['local_full', 'cloud_minimized', 'cloud_no_samples'];
  if (valid.includes(raw as PrivacyLevel)) return raw as PrivacyLevel;
  return 'cloud_no_samples'; // fail-closed
}
