import type { AuditReportInput } from './evidenceEnvelopeV2';
import type { AIProvider, ProviderMetrics } from '../../types';
import type { PrivacyLevel } from './types';
import type {
  EvidenceEnvelopeOptionsV2 as EnvOptions,
  DiagnosisPromptOptionsV2,
  DiagnosisPipelineOutcome,
  DiagnosisPromptPackageV2,
  DiagnosisExecutionResult,
} from './index';
import {
  buildEvidenceEnvelopeV2,
  buildDiagnosisPromptV2,
  runDiagnosisPipeline,
  isContractsV2Enabled,
} from './index';
import { sha256hex } from './hash';
import { AIProviderDiagnosisAdapter } from '../../services/providers/diagnosisAdapter';

export { isContractsV2Enabled } from './index';

export type DiagnosisProviderType = 'local' | 'cloud' | 'ollama' | 'chrome' | 'webllm_experimental';

function derivePrivacyLevel(providerType: DiagnosisProviderType): PrivacyLevel {
  switch (providerType) {
    case 'local':
    case 'ollama':
    case 'webllm_experimental':
    case 'chrome':
      return 'local_full';
    case 'cloud':
    default:
      return 'cloud_minimized';
  }
}

export interface DiagnosisSelectorOptions {
  provider: AIProvider;
  providerType: DiagnosisProviderType;
  auditEvidence?: { datasetFingerprint: string } | null;
  envelopeOptions?: Partial<Omit<EnvOptions, 'datasetSha256' | 'delimiter'>> & { datasetSha256?: string; delimiter?: string };
  promptOptions?: Partial<DiagnosisPromptOptionsV2>;
  maxConfidence?: number;
}

export interface StructuredDiagnosisResult {
  success: true;
  result: DiagnosisExecutionResult;
}

export interface StructuredDiagnosisFailure {
  success: false;
  code: string;
  message: string;
  path: string;
  details: unknown;
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

  const privacyLevel = options.envelopeOptions?.privacyLevel ?? derivePrivacyLevel(options.providerType);

  const datasetSha256 = options.auditEvidence?.datasetFingerprint
    ?? options.envelopeOptions?.datasetSha256
    ?? '0000000000000000000000000000000000000000000000000000000000000000';

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
  const promptPackage = buildDiagnosisPromptV2(envelope, promptOptions);

  const adapter = new AIProviderDiagnosisAdapter({ provider: options.provider });

  let capturedMetrics: ProviderMetrics | null = null;
  let rawResponseHash = '';

  const pipelineAdapter = async (_pkg: DiagnosisPromptPackageV2): Promise<string> => {
    const fullPrompt = promptPackage.systemInstruction + '\n\n' + promptPackage.userPayload;
    const { text, metrics } = await adapter.diagnose(fullPrompt);
    capturedMetrics = metrics;
    rawResponseHash = sha256hex(text);
    return text;
  };

  const outcome = await runDiagnosisPipeline(envelope, promptPackage, pipelineAdapter);

  if (!outcome.success) {
    const failure = outcome as DiagnosisPipelineOutcome & { success: false };
    return {
      success: false,
      code: failure.code,
      message: failure.message,
      path: failure.path,
      details: failure.details,
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
  };

  return { success: true, result };
}
