import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import { sha256BytesHex, sha256hex } from '../../contracts/llm/hash';

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
  bundleHash?: string;
  inputReceiptRef?: string;
  evidenceEnvelopeRef?: string;
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
  executionId?: string;
  runId: string;
  approvedScriptHash: string;
  scriptTextSha256: string;
  beforeDatasetSha256: string;
  scriptText: string;
  scriptHashPayload: Record<string, unknown>;
  inputReceiptRef?: string;
  evidenceEnvelopeRef?: string;
  bundleHash?: string;
}

export interface PythonExecutionBundleInput {
  generatedAt: string;
  executionId?: string;
  runId?: string;
  approvedScriptHash: string;
  beforeDatasetSha256: string;
  scriptText: string;
  scriptHashPayload: Record<string, unknown>;
  inputReceiptRef?: string;
  evidenceEnvelopeRef?: string;
  computeBundleHash?: boolean;
}

export type PythonArtifactContent = string | Uint8Array;

export interface PythonReceiptExpectation {
  runId: string;
  approvedScriptHash: string;
  scriptText: string;
  beforeDatasetSha256: string;
  bundleHash?: string | null;
  inputReceiptRef?: string | null;
  evidenceEnvelopeRef?: string | null;
  afterCsv?: PythonArtifactContent | null;
}

export interface PythonExecutionChainInput {
  bundle: PythonExecutionBundleV1;
  receipt: PythonExecutionReceiptV1;
  sourceCsv: PythonArtifactContent;
  outputCsv: PythonArtifactContent | null;
}

export interface PythonReceiptBuildOptions {
  bundleHash?: string;
  inputReceiptRef?: string;
  evidenceEnvelopeRef?: string;
}

const SHA256 = /^[a-f0-9]{64}$/;
const ENVELOPE_REF = /^env:[a-f0-9]{64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const receiptPayload = (receipt: PythonExecutionReceiptV1): PythonExecutionReceiptPayloadV1 => {
  const { receiptHash: _receiptHash, ...payload } = receipt;
  return payload;
};

const parseJsonObject = (text: string, invalidCode: string, objectCode: string): Record<string, unknown> => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(invalidCode);
  }
  if (!isRecord(value)) throw new Error(objectCode);
  return value;
};

const deduplicate = (errors: string[]): string[] => [...new Set(errors)];

const hashArtifact = (content: PythonArtifactContent): string =>
  typeof content === 'string' ? sha256hex(content) : sha256BytesHex(content);

const serializeBundleForHash = (bundle: PythonExecutionBundleV1): Record<string, unknown> => {
  const { bundleHash: _bundleHash, ...rest } = bundle;
  return { ...rest };
};

export const computePythonBundleHash = (bundle: PythonExecutionBundleV1): string =>
  sha256hex(canonicalJson(serializeBundleForHash(bundle)));

export const computePythonReceiptHash = (
  receipt: PythonExecutionReceiptV1,
): string => sha256hex(canonicalJson(receiptPayload(receipt)));

export const buildPythonExecutionBundle = (
  input: PythonExecutionBundleInput,
): PythonExecutionBundleV1 => {
  const executionId = input.executionId ?? input.runId ?? '';
  if (!executionId.trim()) throw new Error('PYTHON_BUNDLE_RUN_ID_REQUIRED');
  if (input.executionId !== undefined && input.runId !== undefined && input.executionId !== input.runId) {
    throw new Error('PYTHON_BUNDLE_EXECUTION_ID_MISMATCH');
  }
  if (!SHA256.test(input.approvedScriptHash)) throw new Error('PYTHON_BUNDLE_SCRIPT_HASH_INVALID');
  if (!SHA256.test(input.beforeDatasetSha256)) throw new Error('PYTHON_BUNDLE_DATASET_HASH_INVALID');
  if (!input.scriptText.trim()) throw new Error('PYTHON_BUNDLE_SCRIPT_REQUIRED');
  if (!isRecord(input.scriptHashPayload)) throw new Error('PYTHON_BUNDLE_SCRIPT_PAYLOAD_INVALID');
  if (input.scriptHashPayload.scriptText !== input.scriptText) throw new Error('PYTHON_BUNDLE_SCRIPT_PAYLOAD_MISMATCH');
  if (sha256hex(canonicalJson(input.scriptHashPayload)) !== input.approvedScriptHash) throw new Error('PYTHON_BUNDLE_APPROVED_HASH_MISMATCH');
  if (Number.isNaN(Date.parse(input.generatedAt))) throw new Error('PYTHON_BUNDLE_TIMESTAMP_INVALID');
  if (input.inputReceiptRef !== undefined && !SHA256.test(input.inputReceiptRef)) {
    throw new Error('PYTHON_BUNDLE_INPUT_RECEIPT_REF_INVALID');
  }
  if (input.evidenceEnvelopeRef !== undefined && !ENVELOPE_REF.test(input.evidenceEnvelopeRef)) {
    throw new Error('PYTHON_BUNDLE_EVIDENCE_ENVELOPE_REF_INVALID');
  }
  const draft: PythonExecutionBundleV1 = {
    contractId: 'aura.python-execution-bundle.v1',
    contractVersion: '1.0.0',
    generatedAt: input.generatedAt,
    executionId,
    runId: executionId,
    approvedScriptHash: input.approvedScriptHash,
    scriptTextSha256: sha256hex(input.scriptText),
    beforeDatasetSha256: input.beforeDatasetSha256,
    scriptText: input.scriptText,
    scriptHashPayload: structuredClone(input.scriptHashPayload),
    ...(input.inputReceiptRef === undefined ? {} : { inputReceiptRef: input.inputReceiptRef }),
    ...(input.evidenceEnvelopeRef === undefined ? {} : { evidenceEnvelopeRef: input.evidenceEnvelopeRef }),
  };
  if (input.computeBundleHash !== false) {
    draft.bundleHash = computePythonBundleHash(draft);
  }
  return draft;
};

export const buildPythonExecutionReceipt = (
  payload: PythonExecutionReceiptPayloadV1,
): PythonExecutionReceiptV1 => {
  const unsigned = { ...payload, receiptHash: '' } as PythonExecutionReceiptV1;
  return { ...payload, receiptHash: computePythonReceiptHash(unsigned) };
};

export const parsePythonExecutionBundle = (text: string): PythonExecutionBundleV1 =>
  parseJsonObject(text, 'PYTHON_BUNDLE_JSON_INVALID', 'PYTHON_BUNDLE_OBJECT_REQUIRED') as unknown as PythonExecutionBundleV1;

export const parsePythonExecutionReceipt = (text: string): PythonExecutionReceiptV1 =>
  parseJsonObject(text, 'PYTHON_RECEIPT_JSON_INVALID', 'PYTHON_RECEIPT_OBJECT_REQUIRED') as unknown as PythonExecutionReceiptV1;

const validateBundleInternal = (bundle: PythonExecutionBundleV1): string[] => {
  const errors: string[] = [];
  if (!isRecord(bundle)) return ['bundle must be an object'];
  if (bundle.contractId !== 'aura.python-execution-bundle.v1') errors.push('bundle contractId is invalid');
  if (bundle.contractVersion !== '1.0.0') errors.push('bundle contractVersion is invalid');
  if (typeof bundle.runId !== 'string' || !bundle.runId.trim()) errors.push('bundle execution ID is required');
  if (bundle.executionId !== undefined
    && (typeof bundle.executionId !== 'string' || bundle.executionId !== bundle.runId)) {
    errors.push('bundle execution ID mismatch');
  }
  if (!SHA256.test(bundle.approvedScriptHash)) errors.push('bundle approved script hash is invalid');
  const scriptText = typeof bundle.scriptText === 'string' ? bundle.scriptText : '';
  if (!SHA256.test(bundle.scriptTextSha256) || sha256hex(scriptText) !== bundle.scriptTextSha256) {
    errors.push('bundle script text hash mismatch');
  }
  if (!SHA256.test(bundle.beforeDatasetSha256)) errors.push('bundle source dataset hash is invalid');
  if (!scriptText.trim()) errors.push('bundle script is required');
  if (!isRecord(bundle.scriptHashPayload)) {
    errors.push('bundle script hash payload is invalid');
  } else {
    if (bundle.scriptHashPayload.scriptText !== bundle.scriptText) errors.push('bundle script payload mismatch');
    if (SHA256.test(bundle.approvedScriptHash)
      && sha256hex(canonicalJson(bundle.scriptHashPayload)) !== bundle.approvedScriptHash) {
      errors.push('bundle approved script hash mismatch');
    }
  }
  if (Number.isNaN(Date.parse(bundle.generatedAt))) errors.push('bundle generatedAt is invalid');
  if (bundle.inputReceiptRef !== undefined && !SHA256.test(bundle.inputReceiptRef)) {
    errors.push('bundle input receipt reference is invalid');
  }
  if (bundle.evidenceEnvelopeRef !== undefined && !ENVELOPE_REF.test(bundle.evidenceEnvelopeRef)) {
    errors.push('bundle evidence envelope reference is invalid');
  }
  if (bundle.bundleHash !== undefined) {
    if (!SHA256.test(bundle.bundleHash)) {
      errors.push('bundle bundleHash is invalid');
    } else {
      const expected = computePythonBundleHash({ ...bundle, bundleHash: undefined });
      if (expected !== bundle.bundleHash) errors.push('bundle bundleHash mismatch');
    }
  }
  return deduplicate(errors);
};

export const validatePythonExecutionBundle = (bundle: PythonExecutionBundleV1): string[] =>
  validateBundleInternal(bundle);

const validateTimestamps = (receipt: PythonExecutionReceiptV1, errors: string[]): void => {
  const started = Date.parse(receipt.execution?.startedAt ?? '');
  const completed = Date.parse(receipt.execution?.completedAt ?? '');
  if (Number.isNaN(started) || Number.isNaN(completed)) {
    errors.push('execution timestamps are invalid');
    return;
  }
  if (completed < started) errors.push('execution timestamps are inverted');
};

export const validatePythonExecutionReceipt = (
  receipt: PythonExecutionReceiptV1,
  expected: PythonReceiptExpectation,
): string[] => {
  const errors: string[] = [];
  if (!isRecord(receipt)) return ['receipt must be an object'];
  if (receipt.contractId !== 'aura.python-execution-receipt.v1') errors.push('receipt contractId is invalid');
  if (receipt.contractVersion !== '1.0.0') errors.push('receipt contractVersion is invalid');
  if (receipt.runId !== expected.runId) errors.push('receipt runId does not match the execution');
  if (!SHA256.test(receipt.approvedScriptHash) || receipt.approvedScriptHash !== expected.approvedScriptHash) errors.push('approved script hash mismatch');
  const expectedScriptTextHash = sha256hex(expected.scriptText);
  if (!SHA256.test(receipt.scriptTextSha256) || receipt.scriptTextSha256 !== expectedScriptTextHash) errors.push('script text hash mismatch');
  if (!SHA256.test(receipt.beforeDatasetSha256) || receipt.beforeDatasetSha256 !== expected.beforeDatasetSha256) errors.push('source dataset hash mismatch');
  if (!['passed', 'failed'].includes(receipt.syntax?.status)) errors.push('syntax status is invalid');
  if (!['passed', 'failed'].includes(receipt.execution?.status)) errors.push('execution status is invalid');
  if (typeof receipt.pythonVersion !== 'string' || !receipt.pythonVersion.trim()) errors.push('pythonVersion is required');
  if (receipt.pandasVersion !== null
    && (typeof receipt.pandasVersion !== 'string' || !receipt.pandasVersion.trim())) {
    errors.push('pandasVersion is invalid');
  }
  if (typeof receipt.platform !== 'string' || !receipt.platform.trim()) errors.push('platform is required');
  if (!Number.isFinite(receipt.execution?.durationMs) || receipt.execution.durationMs < 0) errors.push('execution duration is invalid');
  validateTimestamps(receipt, errors);
  if (!SHA256.test(receipt.execution?.stdoutSha256 ?? '') || !SHA256.test(receipt.execution?.stderrSha256 ?? '')) errors.push('stream hashes are invalid');
  if (!SHA256.test(receipt.receiptHash) || computePythonReceiptHash(receipt) !== receipt.receiptHash) errors.push('receipt hash is invalid');

  if (receipt.bundleHash !== undefined) {
    if (!SHA256.test(receipt.bundleHash)) errors.push('receipt bundleHash is invalid');
  }
  if (expected.bundleHash !== undefined && expected.bundleHash !== null) {
    if (!SHA256.test(expected.bundleHash)) {
      errors.push('expected bundleHash is invalid');
    } else if (receipt.bundleHash === undefined) {
      errors.push('receipt is missing bundleHash');
    } else if (receipt.bundleHash !== expected.bundleHash) {
      errors.push('receipt bundleHash does not match the bundle');
    }
  }
  if (expected.inputReceiptRef !== undefined && expected.inputReceiptRef !== null) {
    if (!SHA256.test(expected.inputReceiptRef)) {
      errors.push('expected inputReceiptRef is invalid');
    } else if (receipt.inputReceiptRef === undefined) {
      errors.push('receipt is missing inputReceiptRef');
    } else if (receipt.inputReceiptRef !== expected.inputReceiptRef) {
      errors.push('receipt inputReceiptRef does not match the bundle');
    }
  }
  if (expected.evidenceEnvelopeRef !== undefined && expected.evidenceEnvelopeRef !== null) {
    if (!ENVELOPE_REF.test(expected.evidenceEnvelopeRef)) {
      errors.push('expected evidenceEnvelopeRef is invalid');
    } else if (receipt.evidenceEnvelopeRef === undefined) {
      errors.push('receipt is missing evidenceEnvelopeRef');
    } else if (receipt.evidenceEnvelopeRef !== expected.evidenceEnvelopeRef) {
      errors.push('receipt evidenceEnvelopeRef does not match the bundle');
    }
  }

  const syntaxStatus = receipt.syntax?.status;
  const executionStatus = receipt.execution?.status;
  if (syntaxStatus !== 'passed' && executionStatus === 'passed') {
    errors.push('execution cannot pass when syntax failed');
  }

  if (syntaxStatus === 'passed' && receipt.syntax.error !== null) {
    errors.push('passed syntax cannot declare an error');
  }
  if (syntaxStatus === 'failed' && !receipt.syntax.error) {
    errors.push('syntax failure requires an error');
  }
  if (executionStatus === 'passed' && receipt.execution.error !== null) {
    errors.push('passed execution cannot declare an error');
  }
  if (executionStatus === 'failed' && !receipt.execution.error) {
    errors.push('execution failure requires an error');
  }

  const fullyPassed = syntaxStatus === 'passed' && executionStatus === 'passed';
  if (fullyPassed) {
    if (!SHA256.test(receipt.afterDatasetSha256 ?? '')) errors.push('successful execution requires an output hash');
    if (!receipt.output || !Number.isInteger(receipt.output.rowCount) || receipt.output.rowCount < 0
      || !Number.isInteger(receipt.output.columnCount) || receipt.output.columnCount < 0) {
      errors.push('successful execution requires valid output dimensions');
    }
    if (expected.afterCsv === undefined || expected.afterCsv === null) {
      errors.push('successful execution requires the output CSV');
    } else if (hashArtifact(expected.afterCsv) !== receipt.afterDatasetSha256) {
      errors.push('output CSV hash mismatch');
    }
  } else {
    if (receipt.afterDatasetSha256 !== null || receipt.output !== null) errors.push('failed execution cannot certify an output');
    if (expected.afterCsv !== undefined && expected.afterCsv !== null) errors.push('failed execution cannot include an output CSV');
  }
  return deduplicate(errors);
};

export const validatePythonExecutionChain = (
  input: PythonExecutionChainInput,
): string[] => {
  const bundleErrors = validateBundleInternal(input.bundle);
  if (bundleErrors.length > 0) return bundleErrors;
  const errors = [...bundleErrors];
  if (hashArtifact(input.sourceCsv) !== input.bundle.beforeDatasetSha256) errors.push('source dataset hash mismatch');
  const expectedBundleHash = input.bundle.bundleHash ?? null;
  const expectedInputReceiptRef = input.bundle.inputReceiptRef ?? null;
  const expectedEvidenceEnvelopeRef = input.bundle.evidenceEnvelopeRef ?? null;
  errors.push(...validatePythonExecutionReceipt(input.receipt, {
    runId: input.bundle.runId,
    approvedScriptHash: input.bundle.approvedScriptHash,
    scriptText: input.bundle.scriptText,
    beforeDatasetSha256: input.bundle.beforeDatasetSha256,
    bundleHash: expectedBundleHash,
    inputReceiptRef: expectedInputReceiptRef,
    evidenceEnvelopeRef: expectedEvidenceEnvelopeRef,
    afterCsv: input.outputCsv,
  }));
  return deduplicate(errors);
};
