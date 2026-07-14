import type { AuditReportInput } from './evidenceEnvelopeV2';
import type { AIProvider, ProviderMetrics } from '../../types';
import type {
  EvidenceEnvelopeOptionsV2 as EnvOptions,
  DiagnosisPromptPackageV2,
  DiagnosisExecutionResult,
  DiagnosisErrorCode,
  DiagnosisPipelineFailure,
  DiagnosisInputModeV2,
  DiagnosisInputPackageV2,
  ExecutionReceiptV1,
  InferenceSnapshotV1,
  DiagnosisFailureEvidenceV2,
} from './index';
import {
  buildEvidenceEnvelopeV2,
  buildDiagnosisInputPackageV2,
  exactDiagnosisPromptV2,
  buildExecutionReceiptV1,
  runDiagnosisPipeline,
} from './index';
import { sha256hex } from './hash';
import { AIProviderDiagnosisAdapter } from '../../services/providers/diagnosisAdapter';
import type { DiagnosisAdapterProgressEvent } from '../../services/providers/diagnosisAdapter';
import { buildRemediationContext } from './remediationContextV2';

export { isContractsV2Enabled } from './contractRegistry';

function derivePrivacyLevel(providerType: AIProvider['type']): PrivacyLevel {
  switch (providerType) {
    case 'local':
    case 'ollama':
    case 'chrome':
      return 'local_full';
    case 'cloud':
    default:
      return 'cloud_minimized';
  }
}

type PrivacyLevel = 'local_full' | 'cloud_minimized' | 'cloud_no_samples';

export interface DiagnosisSelectorOptions {
  provider: AIProvider;
  auditEvidence: { datasetSha256?: string; datasetFingerprint?: string } | null;
  envelopeOptions?: Partial<Omit<EnvOptions, 'datasetSha256' | 'delimiter'>> & { datasetSha256?: string; delimiter?: string };
  inputMode?: DiagnosisInputModeV2;
  requestedModel?: string;
  modelDigest?: string | null;
  inference?: InferenceSnapshotV1;
  onProgress?: (event: DiagnosisAdapterProgressEvent) => void;
  onInputPrepared?: (input: DiagnosisInputPackageV2) => void;
}

export interface StructuredDiagnosisResult {
  success: true;
  result: DiagnosisExecutionResult;
}

export interface StructuredDiagnosisFailure {
  success: false;
  code: DiagnosisErrorCode;
  message: string;
  path: string;
  details: Record<string, unknown>;
  inputSnapshot?: DiagnosisInputPackageV2;
  executionReceipt?: ExecutionReceiptV1;
  rawResponseHash?: string;
}

export type StructuredDiagnosisOutcome = StructuredDiagnosisResult | StructuredDiagnosisFailure | DiagnosisFailureEvidenceV2;

const defaultInference = (): InferenceSnapshotV1 => ({
  temperature: 0.1, topP: 0.9, numCtx: 16384, numPredict: 4096,
  think: false, seed: null, keepAlive: '10m', timeoutSeconds: 600,
});

function makeFailureEvidence(
  code: string,
  message: string,
  path: string,
  inputPackage: DiagnosisInputPackageV2,
  receipt: ExecutionReceiptV1,
  rawResponse: string,
): DiagnosisFailureEvidenceV2 {
  return {
    contractId: 'aura.diagnosis-failure-evidence.v2',
    code,
    message,
    path,
    inputSnapshot: inputPackage,
    executionReceipt: receipt,
    rawResponseHash: receipt.rawResponseHash,
    rawResponse,
  };
}

function makeInvalidReceipt(
  inputPackage: DiagnosisInputPackageV2,
  inputMode: DiagnosisInputModeV2,
  exactPrompt: string,
  provider: string,
  requestedModel: string | null,
  observedModel: string | null,
  modelDigest: string | null | undefined,
  inference: InferenceSnapshotV1,
  startedAt: string,
  rawResponse: string,
  errorCodes: string[],
): ExecutionReceiptV1 {
  return buildExecutionReceiptV1({
    input: inputPackage,
    requestedInputMode: inputMode,
    exactPrompt,
    provider: provider || 'unknown',
    requestedModel: requestedModel ?? '',
    observedModel,
    modelDigest: modelDigest ?? null,
    inference,
    startedAt,
    completedAt: new Date().toISOString(),
    rawResponse: rawResponse || '',
    validationStatus: 'invalid',
    validationErrorCodes: errorCodes,
  });
}

export async function runStructuredDiagnosis(
  report: AuditReportInput,
  options: DiagnosisSelectorOptions,
): Promise<StructuredDiagnosisOutcome> {
  const datasetSha256 = options.auditEvidence?.datasetSha256
    ?? options.envelopeOptions?.datasetSha256;
  if (!datasetSha256) {
    return {
      success: false,
      code: 'DIAGNOSIS_ADAPTER_ERROR',
      message: 'auditEvidence.datasetSha256 is required for v2 diagnosis',
      path: 'auditEvidence',
      details: { reason: 'missing_dataset_sha256' },
    };
  }
  if (!/^[a-f0-9]{64}$/.test(datasetSha256)) {
    return {
      success: false,
      code: 'DIAGNOSIS_ADAPTER_ERROR',
      message: 'auditEvidence.datasetSha256 must be a 64-character hex SHA-256',
      path: 'auditEvidence',
      details: { reason: 'invalid_dataset_sha256' },
    };
  }
  const datasetFingerprint = options.auditEvidence?.datasetFingerprint;

  if (!options.requestedModel || options.requestedModel.trim().length === 0) {
    const privacyLevel = options.envelopeOptions?.privacyLevel ?? derivePrivacyLevel(options.provider.type);
    const delimiter = options.envelopeOptions?.delimiter ?? report.delimiterDetected;
    const envelope = buildEvidenceEnvelopeV2(report, {
      privacyLevel, datasetSha256, delimiter,
      tokenBudget: options.envelopeOptions?.tokenBudget,
      excludeColumns: options.envelopeOptions?.excludeColumns,
      excludeIssues: options.envelopeOptions?.excludeIssues,
    });
    const inputMode = options.inputMode ?? 'smart_sample';
    const inputPackage = buildDiagnosisInputPackageV2(report, envelope, inputMode);
    options.onInputPrepared?.(inputPackage);
    const exactPrompt = exactDiagnosisPromptV2(inputPackage);
    const startedAt = new Date().toISOString();
    const inference = options.inference ?? defaultInference();
    const invalidReceipt = makeInvalidReceipt(
      inputPackage, inputMode, exactPrompt,
      options.provider.name, null, null, options.modelDigest,
      inference, startedAt, '', ['DIAGNOSIS_MODEL_NOT_REQUESTED'],
    );
    return makeFailureEvidence(
      'DIAGNOSIS_MODEL_NOT_REQUESTED',
      'requestedModel is required for v2 diagnosis',
      'options.requestedModel',
      inputPackage, invalidReceipt, '',
    );
  }

  const privacyLevel: PrivacyLevel = options.envelopeOptions?.privacyLevel ?? derivePrivacyLevel(options.provider.type);

  const delimiter = options.envelopeOptions?.delimiter ?? report.delimiterDetected;

  const envelopeOptions: EnvOptions = {
    privacyLevel,
    datasetSha256,
    delimiter,
    tokenBudget: options.envelopeOptions?.tokenBudget,
    excludeColumns: options.envelopeOptions?.excludeColumns,
    excludeIssues: options.envelopeOptions?.excludeIssues,
  };


  const envelope = buildEvidenceEnvelopeV2(report, envelopeOptions);
  const inputMode = options.inputMode ?? 'smart_sample';
  const inputPackage = buildDiagnosisInputPackageV2(report, envelope, inputMode);
  options.onInputPrepared?.(inputPackage);
  const exactPrompt = exactDiagnosisPromptV2(inputPackage);
  const promptPackage: DiagnosisPromptPackageV2 = {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: inputPackage.evidenceEnvelopeRef,
    promptVersion: inputPackage.promptVersion,
    promptHash: inputPackage.promptHash,
    systemInstruction: inputPackage.systemInstruction,
    userPayload: inputPackage.userPayload,
    responseSchema: inputPackage.responseSchema,
    generatedAt: new Date().toISOString(),
  };

  const adapter = new AIProviderDiagnosisAdapter({ provider: options.provider });

  let capturedMetrics: ProviderMetrics | null = null;
  let rawResponse = '';
  const startedAt = new Date().toISOString();

  const pipelineAdapter = async (_pkg: DiagnosisPromptPackageV2): Promise<string> => {
    const { text, metrics } = await adapter.diagnoseWithProgress(exactPrompt, (event) => {
      options.onProgress?.(event);
    }, inputPackage.responseSchema);
    capturedMetrics = metrics;
    rawResponse = text;
    return text;
  };

  const outcome = await runDiagnosisPipeline(envelope, promptPackage, pipelineAdapter);

  if (!outcome.success) {
    const failure = outcome as DiagnosisPipelineFailure;
    const responseWasTruncated = capturedMetrics?.finishReason === 'length';
    const failureCode = responseWasTruncated ? 'DIAGNOSIS_RESPONSE_TRUNCATED' : failure.code;
    const failureMessage = responseWasTruncated
      ? `Ollama alcanzó el límite de salida después de ${capturedMetrics?.tokensGenerated ?? 'un número desconocido de'} tokens antes de completar la respuesta JSON.`
      : failure.message;
    const failurePath = responseWasTruncated ? '$' : failure.path;
    const inference = options.inference ?? defaultInference();
    const invalidReceipt = makeInvalidReceipt(
      inputPackage, inputMode, exactPrompt,
      capturedMetrics?.provider ?? options.provider.name ?? 'unknown',
      options.requestedModel,
      capturedMetrics?.model ?? null,
      options.modelDigest,
      inference, startedAt, rawResponse,
      [failureCode],
    );
    return makeFailureEvidence(
      failureCode, failureMessage, failurePath,
      inputPackage, invalidReceipt, rawResponse,
    );
  }

  if (!capturedMetrics) {
    const inference = options.inference ?? defaultInference();
    const invalidReceipt = makeInvalidReceipt(
      inputPackage, inputMode, exactPrompt,
      options.provider.name ?? 'unknown',
      options.requestedModel,
      null, options.modelDigest,
      inference, startedAt, rawResponse,
      ['DIAGNOSIS_ADAPTER_ERROR'],
    );
    return makeFailureEvidence(
      'DIAGNOSIS_ADAPTER_ERROR',
      'Adapter did not capture metrics',
      'adapter',
      inputPackage, invalidReceipt, rawResponse,
    );
  }

  if (!capturedMetrics.model || capturedMetrics.model !== options.requestedModel) {
    const inference = options.inference ?? defaultInference();
    const invalidReceipt = makeInvalidReceipt(
      inputPackage, inputMode, exactPrompt,
      capturedMetrics.provider,
      options.requestedModel,
      capturedMetrics.model,
      options.modelDigest,
      inference, startedAt, rawResponse,
      ['DIAGNOSIS_MODEL_MISMATCH'],
    );
    return makeFailureEvidence(
      'DIAGNOSIS_MODEL_MISMATCH',
      `Requested ${options.requestedModel}, observed ${capturedMetrics.model ?? 'null'}`,
      'metrics.model',
      inputPackage, invalidReceipt, rawResponse,
    );
  }

  const inference: InferenceSnapshotV1 = options.inference ?? defaultInference();
  const executionReceipt = buildExecutionReceiptV1({
    input: inputPackage,
    requestedInputMode: inputMode,
    exactPrompt,
    provider: capturedMetrics.provider,
    requestedModel: options.requestedModel,
    observedModel: capturedMetrics.model,
    modelDigest: options.modelDigest,
    inference,
    startedAt,
    completedAt: new Date().toISOString(),
    rawResponse,
    validationStatus: 'valid',
    ...(outcome.normalizationEvidence.applied
      ? {
          normalizationApplied: true,
          rawValidationStatus: 'invalid' as const,
          rawValidationErrorCodes: [...new Set(outcome.rawValidation.errorCodes)],
        }
      : {}),
  });

  const result: DiagnosisExecutionResult = {
    version: 2,
    diagnosis: outcome.response,
    metrics: {
      latencyMs: capturedMetrics.latencyMs,
      tokensGenerated: capturedMetrics.tokensGenerated,
      firstTokenMs: capturedMetrics.firstTokenMs,
      model: capturedMetrics.model,
      provider: capturedMetrics.provider,
      isLocal: capturedMetrics.isLocal,
    },
    promptHash: promptPackage.promptHash,
    evidenceEnvelopeRef: promptPackage.evidenceEnvelopeRef,
    promptVersion: promptPackage.promptVersion,
    rawResponseHash: executionReceipt.rawResponseHash,
    rawResponse,
    inputMode,
    inputHash: inputPackage.inputHash,
    inputSnapshot: inputPackage,
    executionReceipt,
    rawDiagnosis: outcome.rawResponse,
    rawValidation: outcome.rawValidation,
    normalizationEvidence: outcome.normalizationEvidence,
    remediationContext: (() => {
      const ctx = buildRemediationContext(envelope);
      ctx.evidenceEnvelopeRef = promptPackage.evidenceEnvelopeRef;
      ctx.inputReceiptRef = executionReceipt.receiptHash;
      return ctx;
    })(),
  };

  return { success: true, result };
}

function sanitizeDetails(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== 'object') return {};
  const sanitized: Record<string, unknown> = {};
  const d = details as Record<string, unknown>;
  for (const [key, value] of Object.entries(d)) {
    if (key === 'validationErrors' && Array.isArray(value)) {
      sanitized[key] = value.map((e: unknown) => {
        if (e && typeof e === 'object') {
          const err = e as Record<string, unknown>;
          return {
            code: err.code,
            path: err.path,
            message: err.message,
          };
        }
        return e;
      });
    } else if (key === 'value' || key === 'rawResponse') {
      continue;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
