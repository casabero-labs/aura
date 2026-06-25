/**
 * Placeholder Vocabulary — Phase 4 Loop 1.
 *
 * Closed, versioned, frozen constant. No values from LLM.
 * Used by normalize_placeholders action type.
 */

export const PLACEHOLDER_VOCABULARY_VERSION = '1.0.0';

const VOCABULARY_UNFROZEN: readonly string[] = Object.freeze([
  '',
  'n/a',
  'N/A',
  'na',
  'NA',
  'null',
  'NULL',
  'none',
  'None',
  '?',
  '-',
  '--',
  '...',
  'NaN',
  'NAN',
  'nan',
  'N/a',
]);

export const PLACEHOLDER_VOCABULARY_V2: readonly string[] = VOCABULARY_UNFROZEN;

export const PLACEHOLDER_COUNT = PLACEHOLDER_VOCABULARY_V2.length;
