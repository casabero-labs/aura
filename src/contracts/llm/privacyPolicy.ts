/**
 * Privacy Policy — Phase 1B.
 *
 * - parsePrivacyLevel: invalid → cloud_no_samples (fail-closed)
 * - Real PII redaction: email, phone, SSN, credit card, address, URL
 * - Detection uses semanticType, PII category, generic value patterns and a
 *   generic person-name column vocabulary (name/nombre/apellido/surname…).
 *   No dataset-specific column names (no «Titanic» special cases).
 * - cloud_minimized produces real minimized samples
 * - cloud_no_samples: samples=[], topValues=[]
 *
 * What happens to a sample or top value (applied by the evidence envelope
 * through `minimizeEvidenceValue`, the single place where masking happens):
 *
 * | level            | PII column (*)        | PII-shaped value      | anything else |
 * |------------------|-----------------------|-----------------------|---------------|
 * | local_full       | sha256:<hex> (hashed) | redacted (marker ***) | as in file    |
 * | cloud_minimized  | sha256:<hex> (hashed) | redacted (marker ***) | as in file    |
 * | cloud_no_samples | omitted               | omitted               | omitted       |
 *
 * (*) semanticType or category indicates PII, or the column name denotes a
 *     person's name (`isPersonNameColumn`). Names are therefore treated like
 *     emails: hashed under every level that ships samples, local models
 *     included (an email column was already hashed under local_full; a
 *     passenger name travelling in clear next to it was the inconsistency).
 *
 * The minimization above is the baseline for every level that ships samples;
 * a policy's `rules` list the level-specific additions (cloud limits). That is
 * why local_full declares no rules while still hashing PII columns.
 *
 * Numbers are never masked by digit count alone: in a numeric column (or when
 * the value itself is a number) only the credit-card shape is PII, and a plain
 * decimal literal is never a phone. A redacted value always contains the ***
 * marker and the sample carries `metadata.redacted: true`; it is never
 * presented as the original value.
 */

import type { PrivacyLevel, PrivacyPolicyV2, PrivacyRuleV2, PIIConfig } from './types';
import { sha256hex } from './hash';

// ── PII patterns (generic, no column-name hardcoding) ──
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const CREDIT_CARD_PATTERN = /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/;
const PII_PATTERNS: RegExp[] = [
  EMAIL_PATTERN,                                           // email
  /^\+?[\d\s\-().]{7,20}$/,                                // phone (7+ digits)
  /^\d{3}-\d{2}-\d{4}$/,                                   // SSN-ish
  CREDIT_CARD_PATTERN,                                     // credit card
  /^\d{8,}(-\d{1,4})?$/,                                   // long numeric ID (8+ digits)
  /^https?:\/\/[^\s]+$/i,                                   // URL
  /^\d+\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|blvd|lane|ln|way|ct|court|pl|place)[\s.,]/i, // address
];

/** Patterns still applied to numeric values: a 16-digit card number is PII even as a number. */
const NUMERIC_VALUE_PII_PATTERNS: RegExp[] = [CREDIT_CARD_PATTERN];

/** A plain decimal number literal ("512.3292", "-0.5", "1.2e2"): a measurement, not a phone. */
const DECIMAL_LITERAL = /^-?\d+\.\d+(?:[eE][+-]?\d+)?$/;
const NUMERIC_LITERAL = /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/;

/** Semantic types whose digits ARE the personal datum; numeric context does not exempt them. */
const DIGIT_PII_SEMANTIC_TYPES = new Set([
  'phone', 'ssn', 'passport', 'id', 'identifier', 'credit_card', 'iban', 'dni', 'document',
  'telefono', 'documento',
]);

const PII_SEMANTIC_TYPES = new Set([
  'name', 'email', 'phone', 'ssn', 'passport', 'id', 'identifier',
  'address', 'url', 'credit_card', 'iban', 'dni', 'document',
  'nombre', 'correo', 'telefono', 'direccion', 'documento',
]);

const PII_CATEGORY_PATTERNS = [
  /\b(pii|personal|sensitive|identif|privado|sensible|confidencial)\b/i,
];

// ── Person-name columns (generic vocabulary, EN/ES) ──
/** Tokens that on their own denote a person's name. */
const PERSON_NAME_TOKENS = new Set([
  'nombre', 'nombres', 'apellido', 'apellidos', 'surname', 'surnames',
  'firstname', 'lastname', 'fullname', 'givenname', 'familyname', 'middlename',
  'forename', 'nombrecompleto',
]);
/** Qualifiers that make a bare «name» token refer to a person (product_name does not). */
const PERSON_QUALIFIER_TOKENS = new Set([
  'first', 'last', 'full', 'given', 'family', 'middle', 'maiden', 'sur',
  'passenger', 'customer', 'client', 'person', 'patient', 'employee', 'user',
  'contact', 'owner', 'member', 'student', 'guest', 'holder', 'applicant',
  'pasajero', 'cliente', 'persona', 'paciente', 'empleado', 'usuario',
  'contacto', 'titular', 'estudiante', 'socio',
]);

const columnTokens = (columnName: string): string[] => columnName
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter(Boolean);

/**
 * True when the column name denotes a person's name: «Name», «nombre»,
 * «Apellidos», «first_name», «PassengerName», «nombre_cliente». A bare «name»
 * counts; «product_name» or «file_name» do not.
 */
export function isPersonNameColumn(columnName: string): boolean {
  const tokens = columnTokens(columnName);
  if (tokens.length === 0) return false;
  if (tokens.some(t => PERSON_NAME_TOKENS.has(t))) return true;
  if (tokens.includes('name') || tokens.includes('names')) {
    const others = tokens.filter(t => t !== 'name' && t !== 'names');
    return others.length === 0 || others.some(t => PERSON_QUALIFIER_TOKENS.has(t));
  }
  return false;
}

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

/** Column context of a value: lets numeric columns keep their numbers. */
export interface PIIValueContext {
  inferredType?: string;
  semanticType?: string;
}

const isNumericContext = (value: unknown, s: string, context?: PIIValueContext): boolean => {
  const semantic = context?.semanticType?.toLowerCase();
  if (semantic && DIGIT_PII_SEMANTIC_TYPES.has(semantic)) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return context?.inferredType === 'number' && NUMERIC_LITERAL.test(s);
};

/**
 * Determine if a column value is PII.
 *
 * A number (or a numeric literal in a column inferred as `number`) is only PII
 * when it has a credit-card shape: a fare, an amount or a count is never a
 * «phone» or an «ID» because of how many digits it has. A plain decimal literal
 * is never treated as a phone number in any column.
 */
export function isPII(value: unknown, config?: PIIConfig, context?: PIIValueContext): boolean {
  const s = String(value ?? '').trim();
  if (s.length === 0) return false;

  if (isNumericContext(value, s, context)) {
    return NUMERIC_VALUE_PII_PATTERNS.some(p => p.test(s));
  }

  const patterns = config?.genericPatterns || PII_PATTERNS;
  // Only match if value looks like a single data item (no commas, semicolons)
  if (/[,;]/.test(s) && s.length > 40) return false;
  if (DECIMAL_LITERAL.test(s)) {
    // A measurement such as "512.3292": only the non-digit-count patterns apply.
    return EMAIL_PATTERN.test(s);
  }
  return patterns.some(p => p.test(s));
}

/**
 * Determine if a column should be hashed based on semantic type, category or
 * a person-name column name.
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
  if (isPersonNameColumn(columnName)) return true;
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

// ── Applying a policy to one value ──

export interface MinimizedEvidenceValue {
  value: string | number | null;
  /** The value was replaced by `sha256:<hex>` (whole PII column). */
  hashed: boolean;
  /** The value was replaced by a *** masked form (PII-shaped value). */
  redacted: boolean;
  /** The value matched a PII pattern (informative even when sent raw). */
  pii: boolean;
}

/**
 * Single place where a privacy level is applied to a sample or top value, so
 * samples and topValues behave the same way. See the table at the top of the
 * file. It is the same for every level that ships samples; `cloud_no_samples`
 * omission is handled by the caller (no sample or top value is built).
 */
export function minimizeEvidenceValue(
  value: unknown,
  options: {
    hashColumn: boolean;
    config?: PIIConfig;
    context?: PIIValueContext;
  },
): MinimizedEvidenceValue {
  const raw: string | number | null = value === null || value === undefined
    ? null
    : typeof value === 'number' ? value : String(value);
  const pii = raw !== null && isPII(raw, options.config, options.context);

  if (raw === null) {
    return { value: raw, hashed: false, redacted: false, pii };
  }
  if (options.hashColumn) {
    return { value: hashValue(String(raw)), hashed: true, redacted: false, pii };
  }
  if (pii) {
    return { value: redactValue(String(raw)), hashed: false, redacted: true, pii };
  }
  return { value: raw, hashed: false, redacted: false, pii };
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
    { type: 'redact', target: 'value', detail: 'Redact values matching PII patterns (email, phone, SSN, credit card, address, URL); numbers only when card-shaped' },
    { type: 'hash', target: 'column', detail: 'Hash entire column when semanticType, category or a person-name column name indicates PII' },
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

/**
 * True when the level ships samples without level-specific limits. It does NOT
 * mean unmasked: PII columns and PII-shaped values are minimized at every level
 * that ships samples (see the table at the top of the file).
 */
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
