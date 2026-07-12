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
  DiagnosisErrorCode,
  DiagnosisError,
} from './types';
import type { ProviderMetrics } from '../../types';
import { sha256hex } from './hash';
import { parseDiagnosisResponseV2, type DiagnosisParseOutcome, type ParseFailure } from './diagnosisParserV2';
import { validateDiagnosisResponseV2 } from './diagnosisValidatorV2';

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
  code: DiagnosisErrorCode;
  message: string;
  path: string;
  details: unknown;
}

export type DiagnosisPipelineOutcome = DiagnosisPipelineResult | DiagnosisPipelineFailure;

function failure(
  code: DiagnosisErrorCode,
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
    const pf: ParseFailure = parsed as ParseFailure;
    return {
      success: false,
      code: pf.error.code,
      message: pf.error.message,
      path: pf.error.path,
      details: pf.error.details,
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
    // Validator emits typed codes directly — no re-interpretation needed
    return {
      success: false,
      code: firstError.code as DiagnosisErrorCode,
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
