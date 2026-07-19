import { sha256hex } from './hash';
import { canonicalJson } from './diagnosisPromptV2';
import { exactDiagnosisPromptV2 } from './diagnosisInputPackageV2';
import { isDiagnosisInputPackageV2_5 } from './diagnosisEvidenceIdentityV1';
import type {
  DiagnosisInputPackageV2,
  ExecutionReceiptV1,
  InferenceSnapshotV1,
} from './types';

export const computeInferenceHash = (inference: InferenceSnapshotV1): string =>
  sha256hex(canonicalJson(inference));

const receiptPayload = (receipt: Omit<ExecutionReceiptV1, 'receiptHash'>) => ({
  ...receipt,
  startedAt: undefined,
  completedAt: undefined,
});

export interface BuildExecutionReceiptInput {
  input: DiagnosisInputPackageV2;
  requestedInputMode: DiagnosisInputPackageV2['inputMode'];
  exactPrompt: string;
  provider: string;
  requestedModel: string;
  observedModel: string | null;
  modelDigest?: string | null;
  inference: InferenceSnapshotV1;
  startedAt: string;
  completedAt: string;
  rawResponse: string;
  validationStatus: ExecutionReceiptV1['validationStatus'];
  validationErrorCodes?: string[];
  /** Hash of the deterministic alias-to-stable-ref resolution for V2.5-C. */
  resolvedCitationsHash?: string;
  /**
   * AURA-CIERRE-DETERMINISTIC-HITL-02-R2 — raw validation result before
   * governance normalization. When absent, defaults to the same values as
   * the effective validationStatus/validationErrorCodes. When present,
   * must be 'invalid' iff normalizationApplied is true.
   */
  rawValidationStatus?: ExecutionReceiptV1['rawValidationStatus'];
  rawValidationErrorCodes?: string[];
  normalizationApplied?: boolean;
}

const assertSha256 = (value: string, field: string): void => {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase 64-character SHA-256.`);
  }
};

export const buildExecutionReceiptV1 = (source: BuildExecutionReceiptInput): ExecutionReceiptV1 => {
  if (source.requestedInputMode !== source.input.inputMode) {
    throw new Error('TRACE_INPUT_MODE_MISMATCH: requested and effective input modes differ.');
  }
  if (source.exactPrompt !== exactDiagnosisPromptV2(source.input)) {
    throw new Error('TRACE_PROMPT_MISMATCH: exact prompt differs from the canonical input package.');
  }
  if (sha256hex(source.exactPrompt) !== source.input.promptHash) {
    throw new Error('TRACE_PROMPT_HASH_MISMATCH: prompt hash does not match exact prompt.');
  }
  if (source.resolvedCitationsHash !== undefined) {
    assertSha256(source.resolvedCitationsHash, 'resolvedCitationsHash');
  }
  const rawValidStatus = source.rawValidationStatus;
  const rawErrorCodes = source.rawValidationErrorCodes;

  if (source.normalizationApplied) {
    if (rawValidStatus !== 'invalid') {
      throw new Error('NORMALIZED_RECEIPT_REQUIRES_RAW_INVALID: rawValidationStatus must be "invalid" when normalizationApplied is true.');
    }
    if (!rawErrorCodes || rawErrorCodes.length === 0) {
      throw new Error('NORMALIZED_RECEIPT_REQUIRES_RAW_ERROR_CODES: rawValidationErrorCodes must be non-empty when normalizationApplied is true.');
    }
    if (!rawErrorCodes.includes('DIAGNOSIS_REVIEW_DOWNGRADE')) {
      throw new Error('NORMALIZED_RECEIPT_REQUIRES_REVIEW_DOWNGRADE: rawValidationErrorCodes must include DIAGNOSIS_REVIEW_DOWNGRADE.');
    }
  }

  if (rawErrorCodes !== undefined && rawValidStatus === undefined) {
    throw new Error('RAW_ERROR_CODES_REQUIRE_STATUS: rawValidationErrorCodes require rawValidationStatus.');
  }
  if (rawValidStatus === 'valid' && (rawErrorCodes ?? []).length > 0) {
    throw new Error('VALID_RAW_REQUIRES_EMPTY_ERROR_CODES: rawValidationErrorCodes must be empty when rawValidationStatus is "valid".');
  }
  if (rawValidStatus === 'invalid' && source.normalizationApplied !== true) {
    throw new Error('INVALID_RAW_WITHOUT_NORMALIZATION: rawValidationStatus cannot be "invalid" unless normalizationApplied is true.');
  }

  const aliasTrace = isDiagnosisInputPackageV2_5(source.input)
    ? {
        evidenceAliasContract: source.input.evidenceAliasContract,
        evidenceAliasMapHash: source.input.evidenceAliasMapHash,
        projectionHash: source.input.projectionHash,
        ...(source.resolvedCitationsHash !== undefined
          ? { resolvedCitationsHash: source.resolvedCitationsHash }
          : {}),
      }
    : {};

  const stable: Omit<ExecutionReceiptV1, 'receiptHash'> = {
    contractId: 'aura.execution-receipt.v1',
    contractVersion: '1.0.0',
    requestedInputMode: source.requestedInputMode,
    effectiveInputMode: source.input.inputMode,
    includedSections: [...source.input.includedSections],
    evidenceEnvelopeRef: source.input.evidenceEnvelopeRef,
    promptVersion: source.input.promptVersion,
    promptHash: source.input.promptHash,
    inputHash: source.input.inputHash,
    responseSchemaHash: source.input.responseSchemaHash,
    ...aliasTrace,
    provider: source.provider,
    requestedModel: source.requestedModel,
    observedModel: source.observedModel,
    modelDigest: source.modelDigest ?? null,
    inferenceHash: computeInferenceHash(source.inference),
    startedAt: source.startedAt,
    completedAt: source.completedAt,
    rawResponseHash: sha256hex(source.rawResponse),
    validationStatus: source.validationStatus,
    validationErrorCodes: [...(source.validationErrorCodes ?? [])],
    ...(source.normalizationApplied ? { normalizationApplied: true } : {}),
    ...(rawValidStatus !== undefined ? { rawValidationStatus: rawValidStatus } : {}),
    ...(rawErrorCodes !== undefined ? { rawValidationErrorCodes: [...rawErrorCodes] } : {}),
  };
  if (source.validationStatus === 'valid') {
    if (!source.observedModel || (typeof source.observedModel === 'string' && source.observedModel.trim() === '')) {
      throw new Error('VALID_RECEIPT_REQUIRES_OBSERVED_MODEL: observedModel must be non-null and non-empty.');
    }
    if ((source.validationErrorCodes ?? []).length > 0) {
      throw new Error('VALID_RECEIPT_REQUIRES_EMPTY_ERROR_CODES: validationErrorCodes must be empty.');
    }
    if (source.requestedModel.trim() === '' || source.requestedModel !== source.observedModel) {
      throw new Error('VALID_RECEIPT_REQUIRES_MODEL_MATCH: requestedModel and observedModel must match.');
    }
    if (isDiagnosisInputPackageV2_5(source.input) && !source.resolvedCitationsHash) {
      throw new Error('V2_5_VALID_RECEIPT_REQUIRES_RESOLVED_CITATIONS_HASH: valid alias-aware receipts must certify citation resolution.');
    }
  }
  if (source.validationStatus === 'invalid') {
    if ((source.validationErrorCodes ?? []).length === 0) {
      throw new Error('INVALID_RECEIPT_REQUIRES_ERROR_CODES: validationErrorCodes must contain at least one code.');
    }
  }
  return { ...stable, receiptHash: sha256hex(canonicalJson(receiptPayload(stable))) };
};

export const validateExecutionReceiptIntegrityV1 = (
  receipt: ExecutionReceiptV1,
  input: DiagnosisInputPackageV2,
  exactPrompt: string,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (receipt.contractId !== 'aura.execution-receipt.v1' || receipt.contractVersion !== '1.0.0') errors.push('execution receipt contract mismatch');
  if (receipt.requestedInputMode !== receipt.effectiveInputMode || receipt.effectiveInputMode !== input.inputMode) errors.push('input mode mismatch');
  if (canonicalJson(receipt.includedSections) !== canonicalJson(input.includedSections)) errors.push('included sections mismatch');
  if (receipt.evidenceEnvelopeRef !== input.evidenceEnvelopeRef) errors.push('evidence envelope mismatch');
  if (receipt.promptVersion !== input.promptVersion) errors.push('prompt version mismatch');
  if (receipt.promptHash !== input.promptHash || receipt.promptHash !== sha256hex(exactPrompt)) errors.push('prompt hash mismatch');
  if (receipt.inputHash !== input.inputHash) errors.push('input hash mismatch');
  if (receipt.responseSchemaHash !== input.responseSchemaHash) errors.push('response schema hash mismatch');

  if (isDiagnosisInputPackageV2_5(input)) {
    if (receipt.evidenceAliasContract !== input.evidenceAliasContract) errors.push('evidence alias contract mismatch');
    if (receipt.evidenceAliasMapHash !== input.evidenceAliasMapHash) errors.push('evidence alias map hash mismatch');
    if (receipt.projectionHash !== input.projectionHash) errors.push('projection hash mismatch');
    if (!receipt.resolvedCitationsHash || !/^[a-f0-9]{64}$/.test(receipt.resolvedCitationsHash)) {
      errors.push('alias-aware receipt requires a valid resolved citations hash');
    }
  }

  const { receiptHash, ...stable } = receipt;
  if (receiptHash !== sha256hex(canonicalJson(receiptPayload(stable)))) errors.push('receipt hash mismatch');

  if (receipt.validationStatus === 'valid') {
    if (receipt.observedModel === null || receipt.observedModel.trim() === '') errors.push('valid receipt requires a non-null observed model');
    if (receipt.requestedModel.trim() === '' || receipt.requestedModel !== receipt.observedModel) errors.push('valid receipt requires requested and observed model equality');
    if (receipt.validationErrorCodes.length > 0) errors.push('valid receipt must have empty validationErrorCodes');
  } else if (receipt.validationStatus === 'invalid') {
    if (receipt.validationErrorCodes.length === 0) errors.push('invalid receipt must have at least one validationErrorCode');
  } else {
    errors.push('unknown validation status');
  }

  if (receipt.rawValidationStatus === 'valid') {
    if (receipt.normalizationApplied === true) errors.push('rawValidationStatus cannot be "valid" when normalizationApplied is true');
    if ((receipt.rawValidationErrorCodes ?? []).length > 0) errors.push('rawValidationStatus "valid" requires empty rawValidationErrorCodes');
  }
  if (receipt.rawValidationStatus === 'invalid') {
    if (receipt.normalizationApplied !== true) errors.push('rawValidationStatus "invalid" requires normalizationApplied === true');
    if (!receipt.rawValidationErrorCodes || receipt.rawValidationErrorCodes.length === 0) errors.push('rawValidationStatus "invalid" requires non-empty rawValidationErrorCodes');
  }
  if (receipt.normalizationApplied === true) {
    if (receipt.rawValidationStatus !== 'invalid') errors.push('normalizationApplied === true requires rawValidationStatus === "invalid"');
    if (!receipt.rawValidationErrorCodes || !receipt.rawValidationErrorCodes.includes('DIAGNOSIS_REVIEW_DOWNGRADE')) errors.push('normalizationApplied === true requires DIAGNOSIS_REVIEW_DOWNGRADE in rawValidationErrorCodes');
  }
  if (receipt.rawValidationStatus === undefined && receipt.rawValidationErrorCodes !== undefined) {
    errors.push('rawValidationErrorCodes require rawValidationStatus');
  }

  return { valid: errors.length === 0, errors };
};

export const validateExecutionReceiptV1 = (
  receipt: ExecutionReceiptV1,
  input: DiagnosisInputPackageV2,
  exactPrompt: string,
  inference: InferenceSnapshotV1,
): { valid: boolean; errors: string[] } => {
  const errors = [...validateExecutionReceiptIntegrityV1(receipt, input, exactPrompt).errors];
  if (receipt.inferenceHash !== computeInferenceHash(inference)) errors.push('inference hash mismatch');

  return { valid: errors.length === 0, errors };
};
