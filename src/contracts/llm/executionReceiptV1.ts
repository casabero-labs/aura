import { sha256hex } from './hash';
import { canonicalJson } from './diagnosisPromptV2';
import { exactDiagnosisPromptV2 } from './diagnosisInputPackageV2';
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
  observedModel: string;
  modelDigest?: string | null;
  inference: InferenceSnapshotV1;
  startedAt: string;
  completedAt: string;
  rawResponse: string;
  validationStatus: ExecutionReceiptV1['validationStatus'];
  validationErrorCodes?: string[];
}

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
  };
  return { ...stable, receiptHash: sha256hex(canonicalJson(receiptPayload(stable))) };
};

export const validateExecutionReceiptV1 = (
  receipt: ExecutionReceiptV1,
  input: DiagnosisInputPackageV2,
  exactPrompt: string,
  inference: InferenceSnapshotV1,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (receipt.requestedInputMode !== receipt.effectiveInputMode || receipt.effectiveInputMode !== input.inputMode) errors.push('input mode mismatch');
  if (canonicalJson(receipt.includedSections) !== canonicalJson(input.includedSections)) errors.push('included sections mismatch');
  if (receipt.evidenceEnvelopeRef !== input.evidenceEnvelopeRef) errors.push('evidence envelope mismatch');
  if (receipt.promptHash !== input.promptHash || receipt.promptHash !== sha256hex(exactPrompt)) errors.push('prompt hash mismatch');
  if (receipt.inputHash !== input.inputHash) errors.push('input hash mismatch');
  if (receipt.responseSchemaHash !== input.responseSchemaHash) errors.push('response schema hash mismatch');
  if (receipt.inferenceHash !== computeInferenceHash(inference)) errors.push('inference hash mismatch');
  const { receiptHash, ...stable } = receipt;
  if (receiptHash !== sha256hex(canonicalJson(receiptPayload(stable)))) errors.push('receipt hash mismatch');
  return { valid: errors.length === 0, errors };
};
