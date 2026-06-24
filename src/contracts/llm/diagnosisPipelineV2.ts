/**
 * Diagnosis Pipeline v2 — Orchestrator.
 *
 * Provider-neutral: receives a DiagnosisPromptPackageV2 and an adapter,
 * executes the full pipeline, and returns a validated DiagnosisResponseV2.
 *
 * CONTRACTS_V2_ENABLED=false → throws CONTRACTS_V2_DISABLED
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
import { DiagnosisErrors } from './diagnosisV2Errors';

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
  parseErrors?: DiagnosisParseOutcome['success'] extends false ? DiagnosisParseOutcome : never;
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
  const validation = validateDiagnosisResponseV2(parsed.response, envelope);
  if (!validation.valid) {
    const firstError = validation.errors[0];
    let code = 'DIAGNOSIS_SCHEMA_INVALID';
    if (firstError.message.includes('ENVELOPE_MISMATCH')) code = 'DIAGNOSIS_ENVELOPE_MISMATCH';
    else if (firstError.message.includes('executable')) code = 'DIAGNOSIS_EXECUTABLE_CONTENT';
    else if (firstError.message.includes('requires human review')) code = 'DIAGNOSIS_REVIEW_DOWNGRADE';
    else if (firstError.message.includes('does not exist') || firstError.message.includes('unknown')) code = 'DIAGNOSIS_REFERENCE_INVALID';
    else if (firstError.message.includes('additionalProperties')) code = 'DIAGNOSIS_SCHEMA_INVALID';
    else if (firstError.message.includes('Must be') || firstError.message.includes('Exceeds') || firstError.message.includes('Duplicate')) code = 'DIAGNOSIS_SCHEMA_INVALID';

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
