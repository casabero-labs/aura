// @vitest-environment jsdom

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BenchmarkCampaignLab from '../components/benchmark/BenchmarkCampaignLab';
import { createExperimentRunner } from '../services/benchmark/experimentRunner';
import { createInMemoryExperimentStore } from '../services/benchmark/inMemoryExperimentStore';
import type {
  AutomaticEvaluationV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from '../services/benchmark/experimentTypes';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

const NOW = '2026-07-11T15:00:00.000Z';
const LATER = '2026-07-11T15:01:00.000Z';

const plannedFixture = (): { campaign: ExperimentCampaignV1; runs: ExperimentRunV1[] } => {
  const source = createExperimentEvidenceFixture();
  return {
    campaign: { ...source.campaign, status: 'ready', updatedAt: NOW },
    runs: source.runs.map((run) => ({
      ...run,
      status: 'planned',
      updatedAt: NOW,
      diagnosis: null,
      script: null,
      automaticEvaluation: null,
      humanReview: null,
      hitl: null,
      execution: null,
      attempts: [],
    })),
  };
};

const providerResult = (contractId: 'aura.diagnosis.v2' | 'aura.script.v2') => ({
  text: JSON.stringify({ contractId }),
  metrics: {
    provider: 'fake',
    model: 'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL',
    latencyMs: 10,
    firstTokenMs: 1,
    totalDurationMs: 10,
    promptTokens: 20,
    tokensGenerated: 12,
    isLocal: true,
    timestamp: LATER,
  },
});

const automaticEvaluation = (): AutomaticEvaluationV1 => ({
  contractId: 'aura.automatic-evaluation.v1',
  evaluatedAt: LATER,
  diagnosis: {
    primary: { tp: 12, fp: 1, fn: 4, precision: 12 / 13, recall: 0.75, f1: 0.8275862068965517 },
    engineCoverage: 41 / 55,
    evidenceFidelity: 0.9,
    extendedDiscoveryKeys: [],
    contractCompliant: true,
    inventedColumns: [],
    unsupportedClaims: [],
    anchoringScore: 0.9,
  },
  script: {
    contractValid: true,
    syntaxValid: true,
    safe: true,
    coveredActions: ['rule:test|column=>trim_whitespace'],
    missingActions: [],
    unsupportedActions: [],
  },
});

describe('BenchmarkCampaignLab - Task 10 human flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:aura-oe4'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('creates 45 units, pauses safely, resumes, exposes raw evidence and records the rubric', async () => {
    const user = userEvent.setup();
    const store = createInMemoryExperimentStore();
    const bundle = plannedFixture();
    let resolveFirst: ((value: ReturnType<typeof providerResult>) => void) | null = null;
    let call = 0;
    const generateText = vi.fn(async (_prompt: string) => {
      call += 1;
      if (call === 1) {
        return new Promise<ReturnType<typeof providerResult>>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return providerResult('aura.diagnosis.v2');
    });
    const runner = createExperimentRunner({
      providerForRun: (run) => ({
        generateText: async (prompt) => {
          const output = await generateText(prompt);
          return { ...output, metrics: { ...output.metrics, model: run.modelId } };
        },
      }), store, now: () => LATER,
      validateDiagnosis: () => [],
    });

    render(
      <BenchmarkCampaignLab
        store={store}
        runner={runner}
        createCampaignBundle={async () => bundle}
        evaluateRun={async () => automaticEvaluation()}
        now={() => LATER}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Crear experimento' }));
    expect(await screen.findByText('0 / 45')).toBeTruthy();
    expect(screen.getAllByTestId('oe4-matrix-cell')).toHaveLength(9);

    await user.click(screen.getByRole('button', { name: 'Iniciar experimento' }));
    await waitFor(() => expect(generateText).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Pausar de forma segura' }));

    await act(async () => {
      resolveFirst?.(providerResult('aura.diagnosis.v2'));
    });
    await waitFor(() => expect(screen.getByText('Experimento pausado')).toBeTruthy());
    expect(screen.getByText('1 pendiente de revisión')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reanudar experimento' }));
    await waitFor(() => expect(screen.getByText('45 pendientes de revisión')).toBeTruthy());

    expect(screen.getByText(/aura\.diagnosis\.v2/)).toBeTruthy();
    expect(screen.queryByText(/aura\.script\.v2/)).toBeNull();
    expect(screen.getAllByText('10 ms')).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText('Claridad'), '4');
    await user.selectOptions(screen.getByLabelText('Trazabilidad'), '3');
    await user.selectOptions(screen.getByLabelText('Accionabilidad'), '3');
    await user.type(screen.getByLabelText('Notas de revisión'), 'Evidencia clara y verificable.');
    await user.click(screen.getByRole('button', { name: 'Guardar evaluación humana' }));

    expect(await screen.findByText('Revisión humana guardada')).toBeTruthy();
    expect(screen.getByText('44 pendientes de revisión')).toBeTruthy();
  });

  it('records an explicit representative decision and imports an external after-CSV', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const representativeId = fixture.runs.find((run) => run.repetition === 3)!.runId;
    const runs = fixture.runs.map((run) => run.runId === representativeId
      ? { ...run, status: 'reviewed' as const, hitl: null }
      : run);
    const store = createInMemoryExperimentStore();
    await store.createCampaign(fixture.campaign, runs);
    const prepareApprovedRepresentative = vi.fn(async (run: ExperimentRunV1) => ({
      ...run,
      status: 'awaiting_external_output' as const,
      execution: {
        contractId: 'aura.dynamic-execution-evidence.v1' as const,
        status: 'awaiting_external_output' as const,
        approvedScriptHash: 'a'.repeat(64),
        beforeDatasetSha256: run.environment.dataset.sha256,
        afterDatasetSha256: null,
        executionEnvironment: 'colab_notebook:1.0.0',
        executedAt: null,
        reaudit: null,
      },
    }));
    const importAfterCsv = vi.fn(async (run: ExperimentRunV1) => ({
      ...run,
      status: 'reaudited' as const,
      updatedAt: LATER,
      execution: {
        contractId: 'aura.dynamic-execution-evidence.v1' as const,
        status: 'reaudited' as const,
        approvedScriptHash: 'a'.repeat(64),
        beforeDatasetSha256: run.environment.dataset.sha256,
        afterDatasetSha256: 'b'.repeat(64),
        executionEnvironment: 'Google Colab controlado',
        executedAt: LATER,
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
          outcome: 'improved' as const,
        },
      },
    }));

    render(
      <BenchmarkCampaignLab
        store={store}
        prepareApprovedRepresentative={prepareApprovedRepresentative}
        importAfterCsv={importAfterCsv}
        now={() => LATER}
      />,
    );

    await user.click(await screen.findByRole('button', { name: `Abrir ${representativeId}` }));
    await user.click(screen.getByRole('button', { name: 'Aprobar representante' }));
    expect(await screen.findByText('Representante aprobado')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Preparar ejecución externa' }));
    expect(prepareApprovedRepresentative).toHaveBeenCalledOnce();
    expect(await screen.findByText('Ejecución externa preparada; importa el CSV resultante.')).toBeTruthy();

    const file = new File(['customer_id\n1\n'], 'after.csv', { type: 'text/csv' });
    await user.upload(await screen.findByLabelText('CSV resultante'), file);
    await user.click(screen.getByRole('button', { name: 'Importar y reauditar' }));

    expect(importAfterCsv).toHaveBeenCalledOnce();
    expect(await screen.findByText('40 → 75')).toBeTruthy();
  });

  it('exports the five-file report only when every formal gate is satisfied', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const store = createInMemoryExperimentStore();
    await store.createCampaign(fixture.campaign, fixture.runs);
    const onExport = vi.fn();

    render(<BenchmarkCampaignLab store={store} onExport={onExport} now={() => fixture.generatedAt} />);

    const exportButton = await screen.findByRole('button', { name: 'Exportar expediente TFM' });
    expect((exportButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(exportButton);

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0].artifacts).toHaveLength(5);
  });
});
