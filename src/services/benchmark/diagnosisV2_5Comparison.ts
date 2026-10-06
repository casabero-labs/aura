import {
  buildDiagnosisInputPackageV2 as buildLegacyInput,
  exactDiagnosisPromptV2,
  type DiagnosisInputReport,
} from '../../contracts/llm/diagnosisInputPackageV2';
import { buildDiagnosisInputPackageV2_5 } from '../../contracts/llm/diagnosisInputPackageV2_5';
import { canonicalJson, estimatePromptTokens } from '../../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../../contracts/llm/hash';
import type {
  DiagnosisInputModeV2,
  EvidenceEnvelopeV2,
} from '../../contracts/llm/types';

export const DIAGNOSIS_V2_5_COMPARISON_CONTRACT = 'aura.diagnosis-v2.5-comparison.v1' as const;

interface PromptShapeMetrics {
  promptCharacters: number;
  estimatedPromptTokens: number;
  userPayloadCharacters: number;
  responseSchemaCharacters: number;
  visibleReferenceOccurrences: number;
  visibleReferenceCharacters: number;
}

interface ModeComparison {
  inputMode: DiagnosisInputModeV2;
  legacy: PromptShapeMetrics;
  v2_5_c: PromptShapeMetrics & {
    aliasCount: number;
    internalAliasMapCharacters: number;
  };
  delta: {
    promptCharacters: number;
    estimatedPromptTokens: number;
    visibleReferenceCharacters: number;
    promptCharactersPercent: number;
  };
}

export interface DiagnosisV2_5ComparisonV1 {
  contractId: typeof DIAGNOSIS_V2_5_COMPARISON_CONTRACT;
  contractVersion: '1.0.0';
  fixtureHash: string;
  methodology: {
    comparison: 'same_report_same_envelope_same_input_mode';
    tokenEstimate: 'ceil(characters/4)';
    tokenizerStatus: 'structural_proxy_not_provider_tokenizer';
    modelCalls: 0;
  };
  modes: ModeComparison[];
  totals: {
    legacyPromptCharacters: number;
    v2_5_cPromptCharacters: number;
    promptCharacterDelta: number;
    legacyEstimatedPromptTokens: number;
    v2_5_cEstimatedPromptTokens: number;
    estimatedPromptTokenDelta: number;
    legacyVisibleReferenceCharacters: number;
    v2_5_cVisibleReferenceCharacters: number;
    visibleReferenceCharacterDelta: number;
  };
  conclusions: string[];
}

const quotedMatches = (text: string, pattern: RegExp): string[] =>
  [...text.matchAll(pattern)].map((match) => match[1] ?? '');

const promptMetrics = (
  prompt: string,
  userPayload: string,
  responseSchema: Record<string, unknown>,
  referencePattern: RegExp,
): PromptShapeMetrics => {
  // Count only references exposed in the generated user payload. Examples in
  // the fixed system instruction are not evidence and must not inflate this metric.
  const refs = quotedMatches(userPayload, referencePattern);
  return {
    promptCharacters: prompt.length,
    estimatedPromptTokens: estimatePromptTokens(prompt),
    userPayloadCharacters: userPayload.length,
    responseSchemaCharacters: canonicalJson(responseSchema).length,
    visibleReferenceOccurrences: refs.length,
    visibleReferenceCharacters: refs.reduce((sum, ref) => sum + ref.length, 0),
  };
};

const percent = (delta: number, base: number): number =>
  base === 0 ? 0 : Number(((delta / base) * 100).toFixed(4));

const stableFixtureDescriptor = (
  report: DiagnosisInputReport,
  envelope: EvidenceEnvelopeV2,
): Record<string, unknown> => ({
  report,
  envelopeConfiguration: {
    datasetSha256: envelope.datasetFingerprint.sha256,
    delimiter: envelope.datasetFingerprint.delimiter,
    privacyLevel: envelope.privacyPolicy.level,
  },
});

export const buildDiagnosisV2_5Comparison = (
  report: DiagnosisInputReport,
  envelope: EvidenceEnvelopeV2,
): DiagnosisV2_5ComparisonV1 => {
  const modes: DiagnosisInputModeV2[] = ['prompt_libre', 'smart_sample', 'recommended'];
  const comparisons = modes.map((inputMode): ModeComparison => {
    const legacy = buildLegacyInput(report, envelope, inputMode);
    const current = buildDiagnosisInputPackageV2_5(report, envelope, inputMode);
    const legacyPrompt = exactDiagnosisPromptV2(legacy);
    const currentPrompt = exactDiagnosisPromptV2(current);
    const legacyMetrics = promptMetrics(
      legacyPrompt,
      legacy.userPayload,
      legacy.responseSchema,
      /"(ev-\d{4,})"/g,
    );
    const currentMetrics = {
      ...promptMetrics(
        currentPrompt,
        current.userPayload,
        current.responseSchema,
        /"(e\d+)"/g,
      ),
      aliasCount: current.evidenceAliasMap.entries.length,
      internalAliasMapCharacters: canonicalJson(current.evidenceAliasMap).length,
    };
    const promptCharacterDelta = currentMetrics.promptCharacters - legacyMetrics.promptCharacters;
    return {
      inputMode,
      legacy: legacyMetrics,
      v2_5_c: currentMetrics,
      delta: {
        promptCharacters: promptCharacterDelta,
        estimatedPromptTokens:
          currentMetrics.estimatedPromptTokens - legacyMetrics.estimatedPromptTokens,
        visibleReferenceCharacters:
          currentMetrics.visibleReferenceCharacters - legacyMetrics.visibleReferenceCharacters,
        promptCharactersPercent: percent(promptCharacterDelta, legacyMetrics.promptCharacters),
      },
    };
  });

  const sum = (select: (entry: ModeComparison) => number): number =>
    comparisons.reduce((total, entry) => total + select(entry), 0);
  const legacyPromptCharacters = sum((entry) => entry.legacy.promptCharacters);
  const v2_5_cPromptCharacters = sum((entry) => entry.v2_5_c.promptCharacters);
  const legacyEstimatedPromptTokens = sum((entry) => entry.legacy.estimatedPromptTokens);
  const v2_5_cEstimatedPromptTokens = sum((entry) => entry.v2_5_c.estimatedPromptTokens);
  const legacyVisibleReferenceCharacters = sum((entry) => entry.legacy.visibleReferenceCharacters);
  const v2_5_cVisibleReferenceCharacters = sum((entry) => entry.v2_5_c.visibleReferenceCharacters);

  return {
    contractId: DIAGNOSIS_V2_5_COMPARISON_CONTRACT,
    contractVersion: '1.0.0',
    fixtureHash: sha256hex(canonicalJson(stableFixtureDescriptor(report, envelope))),
    methodology: {
      comparison: 'same_report_same_envelope_same_input_mode',
      tokenEstimate: 'ceil(characters/4)',
      tokenizerStatus: 'structural_proxy_not_provider_tokenizer',
      modelCalls: 0,
    },
    modes: comparisons,
    totals: {
      legacyPromptCharacters,
      v2_5_cPromptCharacters,
      promptCharacterDelta: v2_5_cPromptCharacters - legacyPromptCharacters,
      legacyEstimatedPromptTokens,
      v2_5_cEstimatedPromptTokens,
      estimatedPromptTokenDelta: v2_5_cEstimatedPromptTokens - legacyEstimatedPromptTokens,
      legacyVisibleReferenceCharacters,
      v2_5_cVisibleReferenceCharacters,
      visibleReferenceCharacterDelta:
        v2_5_cVisibleReferenceCharacters - legacyVisibleReferenceCharacters,
    },
    conclusions: [
      'This artifact measures prompt structure only and does not replace a model campaign.',
      'Estimated tokens use ceil(characters/4), not a provider tokenizer.',
      'Internal stable refs and alias maps are persisted in the snapshot but are not exposed to the LLM prompt.',
      'A campaign with real providers remains required before claiming latency, compliance or output-token improvement.',
    ],
  };
};
