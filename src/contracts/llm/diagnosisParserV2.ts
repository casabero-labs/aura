/**
 * Diagnosis Parser v2 — Strict JSON Parser.
 *
 * Rules:
 * - Accept ONLY complete JSON (no fragment extraction)
 * - NO markdown block stripping (```json)
 * - NO quote repair
 * - NO brace auto-closing
 * - NO LLM-based repair
 * - NO eval() or Function()
 * - Error structured if JSON.parse fails
 *
 * A response wrapped in ```json blocks is INVALID unless
 * the provider stripped them before delivery via a shared,
 * documented transform. No per-provider heuristics.
 */

import type { DiagnosisResponseV2, DiagnosisError } from './types';
import { Errors } from './diagnosisV2Errors';

export interface ParseResult {
  success: true;
  response: DiagnosisResponseV2;
}

export interface ParseFailure {
  success: false;
  error: DiagnosisError;
}

export type DiagnosisParseOutcome = ParseResult | ParseFailure;

/**
 * Strip leading/trailing whitespace only.
 * Does NOT strip markdown blocks, fix quotes, or close braces.
 */
function sanitize(raw: string): string {
  return raw.trim();
}

/**
 * Strict JSON parse — no repair, no extraction, no eval.
 */
export function parseDiagnosisResponseV2(raw: string): DiagnosisParseOutcome {
  const cleaned = sanitize(raw);

  if (cleaned.length === 0) {
    return {
      success: false,
      error: Errors.jsonInvalid('', 'Empty response'),
    };
  }

  // If response doesn't start with '{', it's not JSON
  if (cleaned[0] !== '{') {
    return {
      success: false,
      error: Errors.jsonInvalid('', {
        reason: 'Response does not start with {',
        preview: cleaned.slice(0, 100),
      }),
    };
  }

  // If response ends with '}', it's likely clean JSON
  if (cleaned[cleaned.length - 1] !== '}') {
    return {
      success: false,
      error: Errors.jsonInvalid('', {
        reason: 'Response does not end with }',
        preview: cleaned.slice(-100),
      }),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      error: Errors.jsonInvalid('', {
        reason: 'JSON.parse failed',
        error: err instanceof Error ? err.message : String(err),
        preview: cleaned.slice(0, 200),
      }),
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      error: Errors.jsonInvalid('', {
        reason: 'Parsed value is not an object',
        type: typeof parsed,
      }),
    };
  }

  return {
    success: true,
    response: parsed as DiagnosisResponseV2,
  };
}
