/**
 * Diagnosis Pipeline v2 — Orchestrator.
 *
 * Provider-neutral: receives a DiagnosisPromptPackageV2 and an adapter,
 * executes the full pipeline, and returns a validated DiagnosisResponseV2.
 *
 * CONTRACTS_V2_ENABLED=false → CONTRACTS_V2_DISABLED
 * Adapter must return raw string (provider output)
 * Raw response is NEVER returned as valid diagnosis
 */

import type {
  DiagnosisPromptPackageV2,
  DiagnosisResponseV2,
  EvidenceEnvelopeV2,
} from './types';
import { parseDiagnosisResponseV2, type DiagnosisParseOutcome } from './diagnosisParserV2';
import { validateDiagnosisResponseV2 } from './diagnosisValidatorV2';
import { isContractsV2Enabled } from './contractRegistry';

/**
 * Provider adapter interface — returns raw model output as string.
 * Example adapter for testing:
 *   async (pkg) => '{"contractId":"aura.diagnosis.v2","contractVersion":"2.0.0",...}'
 */
export type DiagnosisAdapter = (
  pkg: DiagnosisPromptPackageV2,
) => Promise<string>;

/**
 * Pipeline result — either a validated DiagnosisResponseV2 or a structured error.
 */
export interface DiagnosisPipelineResult {
  success: true;
  response: DiagnosisResponseV2;
}

export interface DiagnosisPipelineFailure {
  success: false;
  code: string;
  message: string;
  path: string;
  details: unknown;
}

export type DiagnosisPipelineOutcome = DiagnosisPipelineResult | DiagnosisPipelineFailure;

function failure(
  code: string,
  message: string,
  path: string,
  details: unknown,
): DiagnosisPipelineFailure {
  return { success: false, code, message, path, details };
}

/**
 * Run the full diagnosis pipeline:
 *   promptPackage + adapter → raw string → parsed → validated → DiagnosisResponseV2
 *
 * Never returns raw response as valid.
 */
export async function runDiagnosisPipeline(
  envelope: EvidenceEnvelopeV2,
  promptPackage: DiagnosisPromptPackageV2,
  adapter: DiagnosisAdapter,
): Promise<DiagnosisPipelineOutcome> {
  if (!isContractsV2Enabled()) {
    return failure(
      'CONTRACTS_V2_DISABLED',
      'Contracts v2 is not enabled',
      '',
      'Set CONTRACTS_V2_ENABLED=true to use Diagnosis v2 pipeline',
    );
  }

  // 1. Invoke provider adapter
  let raw: string;
  try {
    raw = await adapter(promptPackage);
  } catch (err) {
    return failure(
      'DIAGNOSIS_ADAPTER_ERROR',
      'Adapter threw an error',
      'adapter',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (typeof raw !== 'string') {
    return failure(
      'DIAGNOSIS_ADAPTER_ERROR',
      'Adapter must return a string',
      'adapter',
      typeof raw,
    );
  }

  // 2. Parse — strict JSON only
  const parsed = parseDiagnosisResponseV2(raw);
  if (!parsed.success) {
    return {
      success: false,
      code: parsed.error.code,
      message: parsed.error.message,
      path: parsed.error.path,
      details: parsed.error.details,
    };
  }

  // 3. Validate — reference checks, schema, HITL, coherence, coverage
  // Wrap in try/catch to handle any unexpected exceptions from validator
  let validation;
  try {
    validation = validateDiagnosisResponseV2(parsed.response, envelope);
  } catch (err) {
    return failure(
      'DIAGNOSIS_SCHEMA_INVALID',
      'Validator threw an unexpected error',
      '',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!validation.valid) {
    const firstError = validation.errors[0];
    const code = mapErrorToCode(firstError);

    return {
      success: false,
      code,
      message: firstError.message,
      path: firstError.path,
      details: {
        validationErrors: validation.errors,
      },
    };
  }

  return { success: true, response: parsed.response };
}

/**
 * Map a ValidationErrorV2 to a typed DiagnosisErrorCode.
 * Uses path + code prefix pattern matching rather than word-search.
 */
function mapErrorToCode(error: { path: string; message: string }): string {
  const { path, message } = error;

  if (path === 'evidenceEnvelopeRef' || message.includes('ENVELOPE_MISMATCH')) {
    return 'DIAGNOSIS_ENVELOPE_MISMATCH';
  }
  if (message.includes('executable') || message.includes('Executable')) {
    return 'DIAGNOSIS_EXECUTABLE_CONTENT';
  }
  if (message.includes('review') || message.includes('Review') || message.includes('requiresHumanReview')) {
    return 'DIAGNOSIS_REVIEW_DOWNGRADE';
  }
  if (message.includes('does not exist') || message.includes('unknown') || message.includes('orphan')) {
    return 'DIAGNOSIS_REFERENCE_INVALID';
  }
  if (path.startsWith('issues[') || path.startsWith('diagnosisBlocks[') || path.startsWith('limitations[')) {
    return 'DIAGNOSIS_SCHEMA_INVALID';
  }
  if (message.includes('Must be') || message.includes('Exceeds') || message.includes('Duplicate') || message.includes('Missing')) {
    return 'DIAGNOSIS_SCHEMA_INVALID';
  }

  return 'DIAGNOSIS_SCHEMA_INVALID';
}

/**
 * Build envelope + prompt + run pipeline in one call.
 * Convenience wrapper for the full flow.
 */
export async function diagnoseWithV2(
  envelope: EvidenceEnvelopeV2,
  adapter: DiagnosisAdapter,
): Promise<DiagnosisPipelineOutcome> {
  const { buildDiagnosisPromptV2 } = await import('./diagnosisPromptV2');
  const promptPackage = buildDiagnosisPromptV2(envelope);
  return runDiagnosisPipeline(envelope, promptPackage, adapter);
}
