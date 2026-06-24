/**
 * Diagnosis v2 — Structured Error Factory.
 *
 * Every error includes code, message, path, details.
 * No stack traces or sensitive samples exposed.
 */

import type { DiagnosisError, DiagnosisErrorCode } from './types';

export function diagnosisError(
  code: DiagnosisErrorCode,
  message: string,
  path: string,
  details: unknown,
): DiagnosisError {
  return { code, message, path, details };
}

export const Errors = {
  jsonInvalid: (path: string, details: unknown): DiagnosisError =>
    diagnosisError('DIAGNOSIS_JSON_INVALID', 'Response is not valid JSON', path, details),

  schemaInvalid: (path: string, details: unknown): DiagnosisError =>
    diagnosisError('DIAGNOSIS_SCHEMA_INVALID', 'Response fails schema validation', path, details),

  referenceInvalid: (path: string, details: unknown): DiagnosisError =>
    diagnosisError('DIAGNOSIS_REFERENCE_INVALID', 'Referenced entity does not exist in envelope', path, details),

  envelopeMismatch: (path: string, details: unknown): DiagnosisError =>
    diagnosisError('DIAGNOSIS_ENVELOPE_MISMATCH', 'evidenceEnvelopeRef does not match', path, details),

  reviewDowngrade: (path: string, details: unknown): DiagnosisError =>
    diagnosisError('DIAGNOSIS_REVIEW_DOWNGRADE', 'Response reduced review protections below envelope level', path, details),

  executableContent: (path: string, details: unknown): DiagnosisError =>
    diagnosisError('DIAGNOSIS_EXECUTABLE_CONTENT', 'Response contains executable code or commands', path, details),

  contractsV2Disabled: (): DiagnosisError =>
    diagnosisError('CONTRACTS_V2_DISABLED', 'Contracts v2 is not enabled', '', 'Set CONTRACTS_V2_ENABLED=true'),
};
