import type { InferenceSnapshotV1 } from '../../contracts/llm/types';
import type { AIConfig } from '../../types';
import type { ExperimentCampaignEvidenceDocumentV1 } from './experimentReport';
import {
  OE4_INPUT_MODE_LABELS,
  type OE4InputMode,
  type OE4ModelId,
} from './finalEvaluationProtocol';

export interface CampaignPipelineConfigurationV1 {
  contractId: 'aura.campaign-pipeline-configuration.v1';
  contractVersion: '1.0.0';
  generatedAt: string;
  campaignId: string;
  protocolVersion: string;
  cellId: string;
  providerType: 'ollama';
  ollamaBaseUrl: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  inputModeLabel: string;
  inference: InferenceSnapshotV1;
  selection: {
    attemptedRuns: number;
    validRuns: number;
    failedRuns: number;
    groundTruthAlignment: number | null;
    reliability: number | null;
    evidenceSupport: number | null;
    hallucinationSafety: number | null;
    efficiency: number | null;
    balancedScore: number | null;
  };
  interpretation: string;
}

const balancedCellId = (document: ExperimentCampaignEvidenceDocumentV1): string => {
  const recommendation = document.decisionSupport.recommendations
    .find((entry) => entry.useCase === 'balanced');
  return (recommendation
    ? document.decisionSupport.scores.find((entry) =>
      entry.modelId === recommendation.modelId && entry.inputMode === recommendation.inputMode)?.cellId
    : undefined)
      ?? document.decisionSupport.scores[0]?.cellId
      ?? '';
};

export const buildCampaignPipelineConfiguration = (
  document: ExperimentCampaignEvidenceDocumentV1,
  selectedCellId = balancedCellId(document),
  ollamaBaseUrl = 'http://127.0.0.1:11434',
): CampaignPipelineConfigurationV1 => {
  const score = document.decisionSupport.scores.find((entry) => entry.cellId === selectedCellId)
    ?? document.decisionSupport.scores[0];
  if (!score) throw new Error('La campaña no contiene combinaciones evaluables.');
  const cell = document.aggregation.matrix.cells.find((entry) => entry.cellId === score.cellId);
  const run = document.runs
    .filter((entry) => entry.modelId === score.modelId && entry.inputMode === score.inputMode)
    .sort((left, right) => left.sequence - right.sequence)[0];
  if (!cell || !run) throw new Error(`No existe evidencia de corrida para ${score.cellId}.`);

  return {
    contractId: 'aura.campaign-pipeline-configuration.v1',
    contractVersion: '1.0.0',
    generatedAt: document.generatedAt,
    campaignId: document.campaign.campaignId,
    protocolVersion: document.campaign.protocolVersion,
    cellId: score.cellId,
    providerType: 'ollama',
    ollamaBaseUrl,
    modelId: score.modelId,
    inputMode: score.inputMode,
    inputModeLabel: OE4_INPUT_MODE_LABELS[score.inputMode],
    inference: structuredClone(run.environment.inference),
    selection: {
      attemptedRuns: cell.attemptedRuns,
      validRuns: cell.completedRuns,
      failedRuns: cell.failedRuns,
      groundTruthAlignment: score.accuracy,
      reliability: score.reliability,
      evidenceSupport: score.evidenceSupport,
      hallucinationSafety: score.hallucinationSafety,
      efficiency: score.efficiency,
      balancedScore: score.balanced,
    },
    interpretation: 'Configuración observada en esta campaña y este hardware. Aplicarla no garantiza el mismo resultado con otro dataset.',
  };
};

export const applyCampaignConfigurationToAIConfig = (
  current: AIConfig,
  configuration: CampaignPipelineConfigurationV1,
): AIConfig => ({
  ...current,
  providerType: 'ollama',
  model: configuration.modelId,
  ollamaModel: configuration.modelId,
  ollamaBaseUrl: configuration.ollamaBaseUrl,
  inputMode: configuration.inputMode,
  temperature: configuration.inference.temperature,
  ollamaTopP: configuration.inference.topP,
  ollamaNumCtx: configuration.inference.numCtx,
  ollamaNumPredict: configuration.inference.numPredict,
  ollamaSeed: configuration.inference.seed,
  ollamaKeepAlive: configuration.inference.keepAlive,
  ollamaTimeoutSeconds: configuration.inference.timeoutSeconds,
});
