import React, { useMemo } from 'react';
import BenchmarkCampaignLab, {
  type ExperimentCampaignBundle,
} from '../../../components/benchmark/BenchmarkCampaignLab';
import type { AutomaticEvaluationV1, ExperimentRunV1 } from '../../../services/benchmark/experimentTypes';
import { createExperimentEvidenceFixture } from '../../../__tests__/fixtures/experimentEvidenceFixture';
import { createPythonReceiptFixture } from '../../../__tests__/fixtures/pythonReceiptFixture';

const NOW = '2026-07-11T18:00:00.000Z';
const HASH = 'c'.repeat(64);
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
const targetRepresentative = sourceFixture.runs.find((run) => run.sequence === 3)!;
const recoveryRun = sourceFixture.runs.find((run) => run.sequence === 6)!;

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

const prepareApprovedRepresentative = async (run: ExperimentRunV1): Promise<ExperimentRunV1> => ({
  ...run,
  status: 'awaiting_external_output',
  updatedAt: NOW,
  execution: {
    contractId: 'aura.dynamic-execution-evidence.v1',
    status: 'awaiting_external_output',
    approvedScriptHash: HASH,
    beforeDatasetSha256: run.environment.dataset.sha256,
    afterDatasetSha256: null,
    executionEnvironment: 'controlled-e2e-notebook',
    executedAt: null,
    pythonReceipt: null,
    reaudit: null,
  },
});

const importAfterCsv = async (run: ExperimentRunV1, file: File, _receiptFile: File): Promise<ExperimentRunV1> => {
  if (file.size === 0) throw new Error('The controlled after-CSV is empty.');
  return {
    ...run,
    status: 'reaudited',
    updatedAt: NOW,
    execution: {
      contractId: 'aura.dynamic-execution-evidence.v1',
      status: 'reaudited',
      approvedScriptHash: run.execution?.approvedScriptHash ?? HASH,
      beforeDatasetSha256: run.environment.dataset.sha256,
      afterDatasetSha256: HASH,
      executionEnvironment: 'controlled-e2e-notebook',
      executedAt: NOW,
      pythonReceipt: createPythonReceiptFixture({
        runId: run.runId,
        approvedScriptHash: run.execution?.approvedScriptHash ?? HASH,
        beforeDatasetSha256: run.environment.dataset.sha256,
        afterDatasetSha256: HASH,
        completedAt: NOW,
      }),
      reaudit: {
        beforeScore: 40,
        afterScore: 75,
        beforeIssueCount: 20,
        afterIssueCount: 8,
        beforeRows: 50,
        afterRows: 50,
        beforeColumns: 15,
        afterColumns: 15,
        estimatedCellsModified: 12,
        resolvedRuleIds: ['rule:trim-whitespace'],
        persistentRuleIds: [],
        newRuleIds: [],
        outcome: 'improved',
      },
    },
  };
};

const Oe4CampaignE2eHarness: React.FC = () => {
  const dependencies = useMemo(() => ({
    providerForRun: (run: ExperimentRunV1) => ({
      generateText: (prompt: string) => controlledGenerateText(prompt, run.modelId),
    }),
    validateDiagnosis: () => [],
    createCampaignBundle: createControlledBundle,
    evaluateRun: controlledEvaluation,
    prepareApprovedRepresentative,
    downloadExecutionBundle: () => undefined,
    importAfterCsv,
  }), []);

  return (
    <>
      <p role="note" className="oe4-live-message">
        Recorrido controlado E2E: valida interfaz y recuperación; no constituye evidencia de modelos.
      </p>
      <BenchmarkCampaignLab {...dependencies} now={() => NOW} />
    </>
  );
};

export default Oe4CampaignE2eHarness;
