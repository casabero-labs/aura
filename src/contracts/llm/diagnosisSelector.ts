import type { AuditReportInput } from './evidenceEnvelopeV2';
import type { AIProvider, ProviderMetrics } from '../../types';
import type {
  EvidenceEnvelopeOptionsV2 as EnvOptions,
  DiagnosisPromptPackageV2,
  DiagnosisExecutionResult,
  DiagnosisErrorCode,
  DiagnosisPipelineFailure,
  DiagnosisInputModeV2,
  InferenceSnapshotV1,
} from './index';
import {
  buildEvidenceEnvelopeV2,
  buildDiagnosisInputPackageV2,
  exactDiagnosisPromptV2,
  buildExecutionReceiptV1,
  runDiagnosisPipeline,
} from './index';
import { isContractsV2Enabled } from './contractRegistry';
import { sha256hex } from './hash';
import { AIProviderDiagnosisAdapter } from '../../services/providers/diagnosisAdapter';
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
  auditEvidence: { datasetFingerprint: string } | null;
  envelopeOptions?: Partial<Omit<EnvOptions, 'datasetSha256' | 'delimiter'>> & { datasetSha256?: string; delimiter?: string };
  inputMode?: DiagnosisInputModeV2;
  requestedModel?: string;
  modelDigest?: string | null;
  inference?: InferenceSnapshotV1;
  onProgress?: (event: { type: 'chunk'; text: string }) => void;
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
}

export type StructuredDiagnosisOutcome = StructuredDiagnosisResult | StructuredDiagnosisFailure;

export async function runStructuredDiagnosis(
  report: AuditReportInput,
  options: DiagnosisSelectorOptions,
): Promise<StructuredDiagnosisOutcome> {
  if (!isContractsV2Enabled()) {
    return {
      success: false,
      code: 'CONTRACTS_V2_DISABLED',
      message: 'Diagnosis v2 is not enabled. Use v1 flow.',
      path: '',
      details: {},
    };
  }

  const datasetFingerprint = options.auditEvidence?.datasetFingerprint;
  if (!datasetFingerprint) {
    return {
      success: false,
      code: 'DIAGNOSIS_ADAPTER_ERROR',
      message: 'auditEvidence.datasetFingerprint is required for v2 diagnosis',
      path: 'auditEvidence',
      details: { reason: 'missing_fingerprint' },
    };
  }

  const privacyLevel: PrivacyLevel = options.envelopeOptions?.privacyLevel ?? derivePrivacyLevel(options.provider.type);

  const datasetSha256 = options.envelopeOptions?.datasetSha256
    ?? (options.auditEvidence as { datasetSha256?: string } | null | undefined)?.datasetSha256
    ?? datasetFingerprint;
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
  let rawResponseHash = '';
  let rawResponse = '';
  const startedAt = new Date().toISOString();

  const pipelineAdapter = async (_pkg: DiagnosisPromptPackageV2): Promise<string> => {
    const { text, metrics } = await adapter.diagnoseWithProgress(exactPrompt, (event) => {
      options.onProgress?.(event);
    });
    capturedMetrics = metrics;
    rawResponse = text;
    rawResponseHash = sha256hex(text);
    return text;
  };

  const outcome = await runDiagnosisPipeline(envelope, promptPackage, pipelineAdapter);

  if (!outcome.success) {
    const failure = outcome as DiagnosisPipelineFailure;
    return {
      success: false,
      code: failure.code,
      message: failure.message,
      path: failure.path,
      details: sanitizeDetails(failure.details),
    };
  }

  if (!capturedMetrics) {
    return {
      success: false,
      code: 'DIAGNOSIS_ADAPTER_ERROR',
      message: 'Adapter did not capture metrics',
      path: 'adapter',
      details: {},
    };
  }

  const inference: InferenceSnapshotV1 = options.inference ?? {
    temperature: 0.1,
    topP: 0.9,
    numCtx: 16384,
    numPredict: 1600,
    seed: null,
    keepAlive: '10m',
    timeoutSeconds: 600,
  };
  const executionReceipt = buildExecutionReceiptV1({
    input: inputPackage,
    requestedInputMode: inputMode,
    exactPrompt,
    provider: capturedMetrics.provider,
    requestedModel: options.requestedModel ?? capturedMetrics.model,
    observedModel: capturedMetrics.model,
    modelDigest: options.modelDigest,
    inference,
    startedAt,
    completedAt: new Date().toISOString(),
    rawResponse,
    validationStatus: 'valid',
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
    rawResponseHash,
    inputMode,
    inputHash: inputPackage.inputHash,
    inputSnapshot: inputPackage,
    executionReceipt,
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
