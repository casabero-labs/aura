import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../../contracts/llm/hash';

export type PythonCheckStatus = 'passed' | 'failed';

export interface PythonExecutionReceiptV1 {
  contractId: 'aura.python-execution-receipt.v1';
  contractVersion: '1.0.0';
  runId: string;
  approvedScriptHash: string;
  scriptTextSha256: string;
  beforeDatasetSha256: string;
  afterDatasetSha256: string | null;
  pythonVersion: string;
  pandasVersion: string | null;
  platform: string;
  syntax: { status: PythonCheckStatus; error: string | null };
  execution: {
    status: PythonCheckStatus;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    stdoutSha256: string;
    stderrSha256: string;
    error: string | null;
  };
  output: { rowCount: number; columnCount: number } | null;
  receiptHash: string;
}

export type PythonExecutionReceiptPayloadV1 = Omit<PythonExecutionReceiptV1, 'receiptHash'>;

export interface PythonExecutionBundleV1 {
  contractId: 'aura.python-execution-bundle.v1';
  contractVersion: '1.0.0';
  generatedAt: string;
  runId: string;
  approvedScriptHash: string;
  scriptTextSha256: string;
  beforeDatasetSha256: string;
  scriptText: string;
  scriptHashPayload: Record<string, unknown>;
}

export interface PythonReceiptExpectation {
  runId: string;
  approvedScriptHash: string;
  scriptText: string;
  beforeDatasetSha256: string;
  afterCsv?: string | null;
}

const SHA256 = /^[a-f0-9]{64}$/;

const receiptPayload = (receipt: PythonExecutionReceiptV1): Omit<PythonExecutionReceiptV1, 'receiptHash'> => {
  const { receiptHash: _receiptHash, ...payload } = receipt;
  return payload;
};

export const buildPythonExecutionReceipt = (
  payload: PythonExecutionReceiptPayloadV1,
): PythonExecutionReceiptV1 => {
  const unsigned = { ...payload, receiptHash: '' } as PythonExecutionReceiptV1;
  return { ...payload, receiptHash: computePythonReceiptHash(unsigned) };
};

export const computePythonReceiptHash = (
  receipt: PythonExecutionReceiptV1,
): string => sha256hex(canonicalJson(receiptPayload(receipt)));

export const buildPythonExecutionBundle = (input: {
  generatedAt: string;
  runId: string;
  approvedScriptHash: string;
  beforeDatasetSha256: string;
  scriptText: string;
  scriptHashPayload: Record<string, unknown>;
}): PythonExecutionBundleV1 => {
  if (!input.runId.trim()) throw new Error('PYTHON_BUNDLE_RUN_ID_REQUIRED');
  if (!SHA256.test(input.approvedScriptHash)) throw new Error('PYTHON_BUNDLE_SCRIPT_HASH_INVALID');
  if (!SHA256.test(input.beforeDatasetSha256)) throw new Error('PYTHON_BUNDLE_DATASET_HASH_INVALID');
  if (!input.scriptText.trim()) throw new Error('PYTHON_BUNDLE_SCRIPT_REQUIRED');
  if (input.scriptHashPayload.scriptText !== input.scriptText) throw new Error('PYTHON_BUNDLE_SCRIPT_PAYLOAD_MISMATCH');
  if (sha256hex(canonicalJson(input.scriptHashPayload)) !== input.approvedScriptHash) throw new Error('PYTHON_BUNDLE_APPROVED_HASH_MISMATCH');
  if (Number.isNaN(Date.parse(input.generatedAt))) throw new Error('PYTHON_BUNDLE_TIMESTAMP_INVALID');
  return {
    contractId: 'aura.python-execution-bundle.v1',
    contractVersion: '1.0.0',
    generatedAt: input.generatedAt,
    runId: input.runId,
    approvedScriptHash: input.approvedScriptHash,
    scriptTextSha256: sha256hex(input.scriptText),
    beforeDatasetSha256: input.beforeDatasetSha256,
    scriptText: input.scriptText,
    scriptHashPayload: structuredClone(input.scriptHashPayload),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parsePythonExecutionReceipt = (text: string): PythonExecutionReceiptV1 => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('PYTHON_RECEIPT_JSON_INVALID');
  }
  if (!isRecord(value)) throw new Error('PYTHON_RECEIPT_OBJECT_REQUIRED');
  return value as unknown as PythonExecutionReceiptV1;
};

export const validatePythonExecutionReceipt = (
  receipt: PythonExecutionReceiptV1,
  expected: PythonReceiptExpectation,
): string[] => {
  const errors: string[] = [];
  if (!isRecord(receipt)) return ['receipt must be an object'];
  if (receipt.contractId !== 'aura.python-execution-receipt.v1') errors.push('receipt contractId is invalid');
  if (receipt.contractVersion !== '1.0.0') errors.push('receipt contractVersion is invalid');
  if (receipt.runId !== expected.runId) errors.push('receipt runId does not match the run');
  if (!SHA256.test(receipt.approvedScriptHash) || receipt.approvedScriptHash !== expected.approvedScriptHash) errors.push('approved script hash mismatch');
  const expectedScriptTextHash = sha256hex(expected.scriptText);
  if (!SHA256.test(receipt.scriptTextSha256) || receipt.scriptTextSha256 !== expectedScriptTextHash) errors.push('script text hash mismatch');
  if (!SHA256.test(receipt.beforeDatasetSha256) || receipt.beforeDatasetSha256 !== expected.beforeDatasetSha256) errors.push('source dataset hash mismatch');
  if (!['passed', 'failed'].includes(receipt.syntax?.status)) errors.push('syntax status is invalid');
  if (!['passed', 'failed'].includes(receipt.execution?.status)) errors.push('execution status is invalid');
  if (!receipt.pythonVersion?.trim()) errors.push('pythonVersion is required');
  if (!receipt.platform?.trim()) errors.push('platform is required');
  if (!Number.isFinite(receipt.execution?.durationMs) || receipt.execution.durationMs < 0) errors.push('execution duration is invalid');
  if (Number.isNaN(Date.parse(receipt.execution?.startedAt)) || Number.isNaN(Date.parse(receipt.execution?.completedAt))) errors.push('execution timestamps are invalid');
  if (!SHA256.test(receipt.execution?.stdoutSha256 ?? '') || !SHA256.test(receipt.execution?.stderrSha256 ?? '')) errors.push('stream hashes are invalid');
  if (!SHA256.test(receipt.receiptHash) || computePythonReceiptHash(receipt) !== receipt.receiptHash) errors.push('receipt hash is invalid');

  const passed = receipt.syntax?.status === 'passed' && receipt.execution?.status === 'passed';
  if (passed) {
    if (!SHA256.test(receipt.afterDatasetSha256 ?? '')) errors.push('successful execution requires an output hash');
    if (receipt.syntax.error !== null || receipt.execution.error !== null) errors.push('successful execution cannot contain errors');
    if (!receipt.output || !Number.isInteger(receipt.output.rowCount) || receipt.output.rowCount < 0
      || !Number.isInteger(receipt.output.columnCount) || receipt.output.columnCount < 0) {
      errors.push('successful execution requires valid output dimensions');
    }
    if (expected.afterCsv === undefined || expected.afterCsv === null) {
      errors.push('successful execution requires the output CSV');
    } else if (sha256hex(expected.afterCsv) !== receipt.afterDatasetSha256) {
      errors.push('output CSV hash mismatch');
    }
  } else {
    if (receipt.afterDatasetSha256 !== null || receipt.output !== null) errors.push('failed execution cannot certify an output');
    if (receipt.syntax?.status === 'failed' && !receipt.syntax.error) errors.push('syntax failure requires an error');
    if (receipt.execution?.status === 'failed' && !receipt.execution.error) errors.push('execution failure requires an error');
  }
  return [...new Set(errors)];
};
