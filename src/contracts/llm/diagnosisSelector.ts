import type { AuditReportInput } from './evidenceEnvelopeV2';
import type { AIProvider } from '../../types';
import type {
  EvidenceEnvelopeOptionsV2 as EnvOptions,
  DiagnosisPromptOptionsV2,
  DiagnosisPipelineOutcome,
  DiagnosisPromptPackageV2,
} from './index';
import {
  buildEvidenceEnvelopeV2,
  buildDiagnosisPromptV2,
  runDiagnosisPipeline,
  isContractsV2Enabled,
} from './index';
import { AIProviderDiagnosisAdapter } from '../../services/providers/diagnosisAdapter';

export { isContractsV2Enabled } from './index';

export interface DiagnosisSelectorOptions {
  provider: AIProvider;
  envelopeOptions?: Partial<Omit<EnvOptions, 'datasetSha256' | 'delimiter'>> & { datasetSha256?: string; delimiter?: string };
  promptOptions?: Partial<DiagnosisPromptOptionsV2>;
  maxConfidence?: number;
}

export async function runDiagnosis(
  report: AuditReportInput,
  options: DiagnosisSelectorOptions,
): Promise<DiagnosisPipelineOutcome> {
  if (!isContractsV2Enabled()) {
    return {
      success: false,
      code: 'CONTRACTS_V2_DISABLED',
      message: 'Diagnosis v2 is not enabled. Use v1 flow.',
      path: '',
      details: {},
    };
  }

  const envelopeOptions: EnvOptions = {
    privacyLevel: options?.envelopeOptions?.privacyLevel ?? 'local_full',
    datasetSha256: options?.envelopeOptions?.datasetSha256 ?? '0000000000000000000000000000000000000000000000000000000000000000',
    delimiter: options?.envelopeOptions?.delimiter ?? ',',
    tokenBudget: options?.envelopeOptions?.tokenBudget,
    excludeColumns: options?.envelopeOptions?.excludeColumns,
    excludeIssues: options?.envelopeOptions?.excludeIssues,
  };

  const promptOptions: DiagnosisPromptOptionsV2 = {
    maxConfidence: options?.maxConfidence ?? 1,
    ...options?.promptOptions,
  };

  const envelope = buildEvidenceEnvelopeV2(report, envelopeOptions);
  const promptPackage = buildDiagnosisPromptV2(envelope, promptOptions);

  const adapter = new AIProviderDiagnosisAdapter({ provider: options.provider });

  const pipelineAdapter = async (pkg: DiagnosisPromptPackageV2): Promise<string> => {
    const fullPrompt = pkg.systemInstruction + '\n\n' + pkg.userPayload;
    const { text } = await adapter.diagnose(fullPrompt);
    return text;
  };

  return runDiagnosisPipeline(envelope, promptPackage, pipelineAdapter);
}
