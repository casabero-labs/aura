// @vitest-environment jsdom

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BenchmarkCampaignLab from '../components/benchmark/BenchmarkCampaignLab';
import { createExperimentRunner } from '../services/benchmark/experimentRunner';
import { createInMemoryExperimentStore } from '../services/benchmark/inMemoryExperimentStore';
import type { ExperimentStore } from '../services/benchmark/experimentStore';
import type {
  AutomaticEvaluationV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from '../services/benchmark/experimentTypes';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';
import { FINAL_EVALUATION_PROTOCOL } from '../services/benchmark/finalEvaluationProtocol';

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
      warmupReceipt: null,
      diagnosis: null,
      executionReceipt: null,
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
    model: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
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
      contractErrors: [],
      anchoredEvidenceRefs: [],
      anchoredBadSampleRefs: [],
  },
  script: {
    contractValid: true,
    syntaxValid: null,
    safe: true,
    coveredActions: ['rule:test|column=>trim_whitespace'],
    missingActions: [],
    unsupportedActions: [],
  },
});

describe('BenchmarkCampaignLab - automatic diagnosis campaign', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:aura-oe4'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        models: FINAL_EVALUATION_PROTOCOL.models.map((name) => ({
          name,
          size: 3_000_000_000,
          modified_at: NOW,
        })),
      }),
    } as Response)));
  });

  it('creates 27 units, pauses safely, resumes and produces an automatic report', async () => {
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

    expect(screen.getByRole('heading', { name: 'Laboratorio de evaluación LLM' })).toBeTruthy();
    expect(screen.queryByText('Objetivo específico 4')).toBeNull();
    expect(screen.getByText(`Evaluación reproducible · v${FINAL_EVALUATION_PROTOCOL.version}`)).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Crear experimento' }));
    expect(await screen.findByText('0 / 27')).toBeTruthy();
    const matrixCells = screen.getAllByTestId('oe4-matrix-cell');
    expect(matrixCells).toHaveLength(9);
    for (const label of ['Contexto mínimo', 'Evidencia equilibrada', 'Evidencia completa']) {
      expect(matrixCells.filter((cell) => cell.textContent?.includes(label))).toHaveLength(3);
    }

    await user.click(screen.getByRole('button', { name: 'Iniciar experimento' }));
    await waitFor(() => expect(generateText).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('region', { name: 'Ejecución actual' })).toBeTruthy();
    expect(screen.getByText('Calentamiento excluido')).toBeTruthy();
    expect(screen.getByText(/Corrida actual \d+ de 27/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pausar de forma segura' }));

    await act(async () => {
      resolveFirst?.(providerResult('aura.diagnosis.v2'));
    });
    await waitFor(() => expect(screen.getByText('Experimento pausado')).toBeTruthy());
    expect(screen.getByText('Con score automático')).toBeTruthy();
    expect(screen.getByText('sin revisión humana obligatoria')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Reanudar experimento' }));
    await waitFor(() => expect(screen.getByText(/Ejecución terminada.*reporte automático/)).toBeTruthy());

    expect(screen.getByText(/aura\.diagnosis\.v2/)).toBeTruthy();
    expect(screen.queryByText(/aura\.script\.v2/)).toBeNull();
    expect(screen.getAllByText('10 ms')).toHaveLength(1);

    expect(screen.queryByLabelText('Claridad')).toBeNull();
    expect(screen.queryByText('Script')).toBeNull();
    expect((screen.getByRole('button', { name: 'Exportar 9 archivos' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('blocks resuming an obsolete protocol and offers a new preserved campaign', async () => {
    const user = userEvent.setup();
    const bundle = plannedFixture();
    const oldCampaign = { ...bundle.campaign, protocolVersion: '2.3.0' };
    const oldRuns = bundle.runs.map((run) => ({ ...run, protocolVersion: '2.3.0' }));
    const store: ExperimentStore = {
      createCampaign: vi.fn(),
      listCampaigns: async () => [oldCampaign],
      loadCampaign: async () => oldCampaign,
      listRuns: async () => oldRuns,
      loadRun: async () => null,
      listAttemptEvents: async () => [],
      getNextPlannedRun: async () => oldRuns[0] ?? null,
      saveRun: vi.fn(),
      appendAttemptEvent: vi.fn(),
      close: vi.fn(),
    };

    const createCampaignBundle = vi.fn(async () => bundle);
    render(
      <BenchmarkCampaignLab
        store={store}
        runner={{ runUnit: vi.fn(), runUnits: vi.fn() }}
        createCampaignBundle={createCampaignBundle}
        now={() => LATER}
      />,
    );

    expect(await screen.findByRole('button', {
      name: 'Crear experimento',
    })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Perfil 64 GB' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reanudar experimento' })).toBeNull();
    expect(screen.getByText(/Campaña anterior conservada como piloto inválido/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Perfil 64 GB' }));
    await user.click(screen.getByRole('button', { name: 'Crear experimento' }));
    expect(createCampaignBundle).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.1,
      numCtx: 32768,
      numPredict: 8192,
      timeoutSeconds: 900,
    }));
  });

  it('pauses automatically after the first failed run and does not consume the remaining units', async () => {
    const user = userEvent.setup();
    const store = createInMemoryExperimentStore();
    const bundle = plannedFixture();
    const runUnit = vi.fn(async (run: ExperimentRunV1) => ({
      ...run,
      status: 'failed' as const,
    }));

    render(
      <BenchmarkCampaignLab
        store={store}
        runner={{ runUnit, runUnits: vi.fn() }}
        createCampaignBundle={async () => bundle}
        now={() => LATER}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Crear experimento' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar experimento' }));

    expect(await screen.findByText(/Primera corrida fallida/)).toBeTruthy();
    expect(runUnit).toHaveBeenCalledTimes(1);
  });

  it('shows the current provider response in diagnosis.response.stream.json', async () => {
    const user = userEvent.setup();
    const store = createInMemoryExperimentStore();
    const bundle = plannedFixture();
    let finishRun: ((run: ExperimentRunV1) => void) | null = null;
    const runUnit = vi.fn(async (run: ExperimentRunV1, options) => {
      options?.onProgress?.({ runId: run.runId, phase: 'diagnosis', state: 'started' });
      options?.onResponseChunk?.({
        runId: run.runId,
        chunk: '{"contractId":',
        accumulatedText: '{"contractId":',
      });
      options?.onResponseChunk?.({
        runId: run.runId,
        chunk: '"aura.diagnosis.v2"}',
        accumulatedText: '{"contractId":"aura.diagnosis.v2"}',
      });
      return new Promise<ExperimentRunV1>((resolve) => {
        finishRun = resolve;
      });
    });

    render(
      <BenchmarkCampaignLab
        store={store}
        runner={{ runUnit, runUnits: vi.fn() }}
        createCampaignBundle={async () => bundle}
        now={() => LATER}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Crear experimento' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar experimento' }));

    expect(await screen.findByText('diagnosis.response.stream.json')).toBeTruthy();
    expect(screen.getByTestId('oe4-diagnosis-response-stream-content').textContent)
      .toBe('{"contractId":"aura.diagnosis.v2"}');
    expect(screen.getByText('34 caracteres recibidos')).toBeTruthy();

    await act(async () => {
      finishRun?.({ ...bundle.runs[0], status: 'failed' });
    });
  });

  it('keeps script, HITL and remediation outside the Laboratory', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const selectedRunId = fixture.runs.find((run) => run.repetition === 2)!.runId;
    const store = createInMemoryExperimentStore();
    await store.createCampaign(fixture.campaign, fixture.runs);

    render(
      <BenchmarkCampaignLab
        store={store}
        now={() => LATER}
      />,
    );

    await user.click(await screen.findByRole('button', { name: `Abrir ${selectedRunId}` }));
    expect(screen.getByRole('heading', { name: 'Diagnóstico LLM' })).toBeTruthy();
    expect(screen.queryByText('Revisión humana')).toBeNull();
    expect(screen.queryByText('Script')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aprobar representante' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Preparar ejecución externa' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Exportar 9 archivos' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('exports the nine-file report only when every formal gate is satisfied', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const store = createInMemoryExperimentStore();
    await store.createCampaign(fixture.campaign, fixture.runs);
    const onExport = vi.fn();

    render(<BenchmarkCampaignLab store={store} onExport={onExport} now={() => fixture.generatedAt} />);

    const exportButton = await screen.findByRole('button', { name: 'Exportar 9 archivos' });
    expect((exportButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(exportButton);

    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport.mock.calls[0][0].artifacts).toHaveLength(9);
  });
});
