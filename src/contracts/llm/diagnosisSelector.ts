import type { AuditReportInput } from './evidenceEnvelopeV2';
import type { AIProvider, ProviderMetrics } from '../../types';
import type {
  EvidenceEnvelopeOptionsV2 as EnvOptions,
  DiagnosisPromptOptionsV2,
  DiagnosisPromptPackageV2,
  DiagnosisExecutionResult,
  DiagnosisErrorCode,
  DiagnosisPipelineFailure,
} from './index';
import {
  buildEvidenceEnvelopeV2,
  buildDiagnosisPromptV2,
  buildCompactDiagnosisPromptV2,
  shouldUseCompactPrompt,
  estimatePromptTokens,
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
  promptOptions?: Partial<DiagnosisPromptOptionsV2>;
  maxConfidence?: number;
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

  const datasetSha256 = options.envelopeOptions?.datasetSha256 ?? datasetFingerprint;
  const delimiter = options.envelopeOptions?.delimiter ?? report.delimiterDetected;

  const envelopeOptions: EnvOptions = {
    privacyLevel,
    datasetSha256,
    delimiter,
    tokenBudget: options.envelopeOptions?.tokenBudget,
    excludeColumns: options.envelopeOptions?.excludeColumns,
    excludeIssues: options.envelopeOptions?.excludeIssues,
  };

  const promptOptions: DiagnosisPromptOptionsV2 = {
    maxConfidence: options.maxConfidence ?? 1,
    ...options.promptOptions,
  };

  const envelope = buildEvidenceEnvelopeV2(report, envelopeOptions);
  const fullPromptPackage = buildDiagnosisPromptV2(envelope, promptOptions);
  const fullPrompt = fullPromptPackage.systemInstruction + '\n\n' + fullPromptPackage.userPayload;

  const providerType = options.provider.type;
  const estimatedTokens = estimatePromptTokens(fullPrompt);
  const useCompactPrompt = shouldUseCompactPrompt(fullPrompt, providerType);

  const promptPackage = useCompactPrompt
    ? buildCompactDiagnosisPromptV2(envelope, promptOptions)
    : fullPromptPackage;

  const adapter = new AIProviderDiagnosisAdapter({ provider: options.provider });

  let capturedMetrics: ProviderMetrics | null = null;
  let rawResponseHash = '';

  const pipelineAdapter = async (_pkg: DiagnosisPromptPackageV2): Promise<string> => {
    const promptText = promptPackage.systemInstruction + '\n\n' + promptPackage.userPayload;
    const { text, metrics } = await adapter.diagnoseWithProgress(promptText, (event) => {
      options.onProgress?.(event);
    });
    capturedMetrics = metrics;
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
    remediationContext: (() => {
      const ctx = buildRemediationContext(envelope);
      ctx.evidenceEnvelopeRef = promptPackage.evidenceEnvelopeRef;
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
