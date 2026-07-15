import React, { useMemo } from 'react';
import BenchmarkCampaignLab, {
  type ExperimentCampaignBundle,
} from '../../../components/benchmark/BenchmarkCampaignLab';
import type { AutomaticEvaluationV1, ExperimentRunV1 } from '../../../services/benchmark/experimentTypes';
import { createExperimentEvidenceFixture } from '../../../__tests__/fixtures/experimentEvidenceFixture';
import type { ProviderProgressEvent } from '../../../types';

const NOW = '2026-07-11T18:00:00.000Z';
const RELEASE_KEY = 'aura_oe4_e2e_first_call_released';

declare global {
  interface Window {
    __OE4_E2E_WAITING__?: boolean;
    __OE4_E2E_RELEASE__?: () => void;
    __OE4_E2E_GENERATE_CALL_COUNT__: number;
  }
}

window.__OE4_E2E_GENERATE_CALL_COUNT__ = 0;

const planned = (run: ExperimentRunV1): ExperimentRunV1 => ({
  ...run,
  status: 'planned',
  updatedAt: NOW,
  warmupReceipt: null,
  diagnosis: null,
  executionReceipt: null,
  script: null,
  automaticEvaluation: null,
  humanReview: null,
  hitl: null,
  execution: null,
  attempts: [],
});

const sourceFixture = createExperimentEvidenceFixture();
const sourceByRunId = new Map(sourceFixture.runs.map((run) => [run.runId, run]));
const targetRepresentative = sourceFixture.runs.find((run) => run.sequence === 2)!;
const recoveryRun = sourceFixture.runs.find((run) => run.sequence === 4)!;

const createControlledBundle = async (): Promise<ExperimentCampaignBundle> => ({
  campaign: {
    ...sourceFixture.campaign,
    campaignId: 'campaign:oe4:e2e-controlled',
    status: 'ready',
    createdAt: NOW,
    updatedAt: NOW,
    runIds: sourceFixture.runs.map((run) => run.runId),
  },
  runs: sourceFixture.runs.map((run) => {
    const campaignRun = {
      ...run,
      campaignId: 'campaign:oe4:e2e-controlled',
    };
    return run.runId === targetRepresentative.runId || run.runId === recoveryRun.runId
      ? planned(campaignRun)
      : campaignRun;
  }),
});

const controlledEvaluation = async (run: ExperimentRunV1): Promise<AutomaticEvaluationV1> => {
  const evaluation = sourceByRunId.get(run.runId)?.automaticEvaluation;
  if (!evaluation) throw new Error(`No controlled evaluation for ${run.runId}.`);
  return structuredClone(evaluation);
};

const controlledGenerateText = async (prompt: string, model: string) => {
    window.__OE4_E2E_GENERATE_CALL_COUNT__ = (window.__OE4_E2E_GENERATE_CALL_COUNT__ ?? 0) + 1;
    if (localStorage.getItem(RELEASE_KEY) !== 'true') {
      window.__OE4_E2E_WAITING__ = true;
      await new Promise<void>((resolve) => {
        window.__OE4_E2E_RELEASE__ = () => {
          localStorage.setItem(RELEASE_KEY, 'true');
          window.__OE4_E2E_WAITING__ = false;
          resolve();
        };
      });
    }
    const script = prompt.includes('aura.script.v2');
    return {
      text: JSON.stringify({ contractId: script ? 'aura.script.v2' : 'aura.diagnosis.v2' }),
      metrics: {
        provider: 'oe4-controlled-e2e',
        model,
        latencyMs: 12,
        firstTokenMs: 2,
        totalDurationMs: 12,
        promptTokens: 24,
        tokensGenerated: 8,
        isLocal: true,
        timestamp: NOW,
      },
    };
};

const Oe4CampaignE2eHarness: React.FC = () => {
  const dependencies = useMemo(() => ({
    providerForRun: (run: ExperimentRunV1) => ({
      generateText: (prompt: string) => controlledGenerateText(prompt, run.modelId),
      generateTextWithProgress: async (
        prompt: string,
        onProgress: (event: ProviderProgressEvent) => void,
      ) => {
        const resultPromise = controlledGenerateText(prompt, run.modelId);
        const firstChunk = '{"contractId":';
        onProgress({
          stage: 'generating',
          message: 'Recibiendo respuesta del modelo',
          chunk: firstChunk,
        });
        const result = await resultPromise;
        onProgress({
          stage: 'generating',
          message: 'Recibiendo respuesta del modelo',
          chunk: result.text.slice(firstChunk.length),
        });
        return result;
      },
    }),
    validateDiagnosis: () => [],
    createCampaignBundle: createControlledBundle,
    evaluateRun: controlledEvaluation,
  }), []);

  return (
    <>
      <p role="note" className="oe4-live-message">
        Recorrido controlado E2E: valida interfaz y recuperación; no constituye evidencia de modelos.
      </p>
      <BenchmarkCampaignLab
        {...dependencies}
        now={() => NOW}
        onApplyPipelineConfiguration={() => undefined}
        onGoToAudit={() => undefined}
      />
    </>
  );
};

export default Oe4CampaignE2eHarness;
