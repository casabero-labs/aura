import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIProvider } from '../../types';
import { createExperimentRunner, type ExperimentRunner } from '../../services/benchmark/experimentRunner';
import type { ExperimentValidationErrorV1 } from '../../services/benchmark/experimentTypes';
import { createIndexedDbExperimentStore } from '../../services/benchmark/indexedDbExperimentStore';
import type { ExperimentStore } from '../../services/benchmark/experimentStore';
import type {
  AutomaticEvaluationV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
  HitlDecisionV1,
  HumanReviewV1,
} from '../../services/benchmark/experimentTypes';
import { createExperimentExecutionBridge } from '../../services/benchmark/experimentExecutionBridge';
import { selectCampaignRepresentatives, type CellRepresentative } from '../../services/benchmark/representativeSelector';
import { buildExperimentCampaignEvidence } from '../../services/benchmark/experimentReport';
import {
  exportExperimentEvidencePackage,
  type ExperimentEvidencePackage,
} from '../../services/benchmark/experimentArtifactExporter';
import CampaignSetupPanel from './CampaignSetupPanel';
import CampaignMatrix from './CampaignMatrix';
import ExperimentRunDetail from './ExperimentRunDetail';
import HumanRubricPanel from './HumanRubricPanel';
import ExecutionEvidencePanel from './ExecutionEvidencePanel';
import CampaignReportPanel from './CampaignReportPanel';
import { useOllamaModelCatalog } from '../../services/useOllamaModelCatalog';
import { ollamaModelId } from '../../services/ollamaModelCatalog';
import { FINAL_EVALUATION_PROTOCOL } from '../../services/benchmark/finalEvaluationProtocol';

export interface ExperimentCampaignBundle {
  campaign: ExperimentCampaignV1;
  runs: ExperimentRunV1[];
}

interface BenchmarkCampaignLabProps {
  store?: ExperimentStore;
  runner?: ExperimentRunner;
  provider?: Pick<AIProvider, 'generateText'>;
  providerForRun?: (run: ExperimentRunV1) => Pick<AIProvider, 'generateText'>;
  validateDiagnosis?: (parsed: unknown, run: ExperimentRunV1) => ExperimentValidationErrorV1[];
  createCampaignBundle?: () => Promise<ExperimentCampaignBundle>;
  evaluateRun?: (run: ExperimentRunV1) => Promise<AutomaticEvaluationV1>;
  prepareApprovedRepresentative?: (run: ExperimentRunV1) => Promise<ExperimentRunV1>;
  downloadExecutionBundle?: (run: ExperimentRunV1) => void;
  importAfterCsv?: (run: ExperimentRunV1, csvFile: File, receiptFile: File) => Promise<ExperimentRunV1>;
  onExport?: (evidencePackage: ExperimentEvidencePackage) => void;
  now?: () => string;
  ollamaBaseUrl?: string;
}

type CampaignPhase = 'idle' | 'running' | 'paused' | 'finished';

const resolvedRepresentative = (run: ExperimentRunV1): boolean =>
  ['rejected', 'blocked', 'reaudited'].includes(run.status);

const BenchmarkCampaignLab: React.FC<BenchmarkCampaignLabProps> = ({
  store: suppliedStore,
  runner: suppliedRunner,
  provider,
  providerForRun,
  validateDiagnosis,
  createCampaignBundle,
  evaluateRun,
  prepareApprovedRepresentative,
  downloadExecutionBundle,
  importAfterCsv,
  onExport,
  now = () => new Date().toISOString(),
  ollamaBaseUrl = 'http://127.0.0.1:11434',
}) => {
  const ollamaCatalog = useOllamaModelCatalog(ollamaBaseUrl);
  const store = useMemo(
    () => suppliedStore ?? createIndexedDbExperimentStore(),
    [suppliedStore],
  );
  const runner = useMemo(
    () => suppliedRunner ?? ((provider || providerForRun) && validateDiagnosis
      ? createExperimentRunner({ provider, providerForRun, validateDiagnosis, store, now })
      : null),
    [now, provider, providerForRun, store, suppliedRunner, validateDiagnosis],
  );
  const pauseRequested = useRef(false);
  const [campaign, setCampaign] = useState<ExperimentCampaignV1 | null>(null);
  const [runs, setRuns] = useState<ExperimentRunV1[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [phase, setPhase] = useState<CampaignPhase>('idle');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (campaignId: string, preferredRunId?: string | null) => {
    const [storedCampaign, storedRuns] = await Promise.all([
      store.loadCampaign(campaignId),
      store.listRuns(campaignId),
    ]);
    setCampaign(storedCampaign);
    setRuns(storedRuns);
    setSelectedRunId((current) => {
      const target = preferredRunId ?? current;
      return storedRuns.some((run) => run.runId === target)
        ? target
        : storedRuns[0]?.runId ?? null;
    });
    return storedRuns;
  }, [store]);

  useEffect(() => {
    let active = true;
    void store.listCampaigns().then(async (campaigns) => {
      if (!active || campaigns.length === 0) return;
      const latest = campaigns.at(-1)!;
      await refresh(latest.campaignId);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      active = false;
      if (!suppliedStore) store.close();
    };
  }, [refresh, store, suppliedStore]);

  const representatives = useMemo<CellRepresentative[]>(() => {
    try {
      return selectCampaignRepresentatives(runs);
    } catch {
      return [];
    }
  }, [runs]);
  const representativeIds = useMemo(
    () => new Set(representatives.map((representative) => representative.runId)),
    [representatives],
  );
  const selectedRun = runs.find((run) => run.runId === selectedRunId) ?? null;
  const attempted = runs.filter((run) => run.status !== 'planned').length;
  const completed = runs.filter((run) => run.diagnosis?.status === 'completed').length;
  const failed = runs.filter((run) => run.status === 'failed').length;
  const pendingReview = runs.filter((run) => run.status === 'awaiting_human').length;
  const allRepresentativesResolved = representatives.length === 9
    && representatives.every((representative) => resolvedRepresentative(
      runs.find((run) => run.runId === representative.runId) ?? representative.run,
    ));
  const campaignForEvidence = useMemo(() => {
    if (!campaign) return null;
    const campaignComplete = runs.length === campaign.plannedRuns
      && runs.every((run) => !['planned', 'running', 'completed', 'awaiting_human'].includes(run.status))
      && allRepresentativesResolved;
    return campaignComplete && campaign.status !== 'completed'
      ? { ...campaign, status: 'completed' as const, updatedAt: now() }
      : campaign;
  }, [allRepresentativesResolved, campaign, now, runs]);
  const evidenceDocument = useMemo(() => campaignForEvidence
    ? buildExperimentCampaignEvidence(campaignForEvidence, runs, now())
    : null, [campaignForEvidence, now, runs]);
  const evidencePackage = useMemo(() => (
    campaignForEvidence && evidenceDocument?.formalValidity.valid
      ? exportExperimentEvidencePackage({ campaign: campaignForEvidence, runs, generatedAt: evidenceDocument.generatedAt })
      : null
  ), [campaignForEvidence, evidenceDocument, runs]);
  const installedModelIds = useMemo(
    () => new Set(ollamaCatalog.models.map(ollamaModelId)),
    [ollamaCatalog.models],
  );
  const formalModelsInstalled = FINAL_EVALUATION_PROTOCOL.models.every((modelId) => installedModelIds.has(modelId));

  const createCampaign = async () => {
    if (!createCampaignBundle) return;
    setCreating(true);
    setError(null);
    try {
      const bundle = await createCampaignBundle();
      await store.createCampaign(bundle.campaign, bundle.runs);
      await refresh(bundle.campaign.campaignId, bundle.runs[0]?.runId);
      setMessage(`Experimento creado con ${bundle.campaign.plannedRuns} corridas planeadas.`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  };

  const runCampaign = async () => {
    if (!campaign || !runner) return;
    setPhase('running');
    setMessage('Experimento en ejecución');
    setError(null);
    pauseRequested.current = false;
    const candidates = (await store.listRuns(campaign.campaignId))
      .filter((run) => run.status === 'planned' || run.status === 'failed');

    try {
      for (const candidate of candidates) {
        if (pauseRequested.current) break;
        let executed = await runner.runUnit(candidate);
        if (executed.status === 'completed' && evaluateRun) {
          const evaluation = await evaluateRun(executed);
          executed = {
            ...executed,
            status: 'awaiting_human',
            updatedAt: now(),
            automaticEvaluation: evaluation,
          };
          await store.saveRun(executed);
        }
        await refresh(campaign.campaignId, selectedRunId ?? candidate.runId);
      }
      if (pauseRequested.current) {
        setPhase('paused');
        setMessage('Experimento pausado');
      } else {
        setPhase('finished');
        setMessage('Ejecución terminada; continúa con la revisión humana.');
      }
    } catch (cause: unknown) {
      setPhase('paused');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const saveHumanReview = async (review: HumanReviewV1) => {
    if (!campaign || !selectedRun || selectedRun.status !== 'awaiting_human') return;
    const next: ExperimentRunV1 = {
      ...selectedRun,
      status: 'reviewed',
      updatedAt: review.reviewedAt,
      humanReview: review,
    };
    await store.saveRun(next);
    await refresh(campaign.campaignId, next.runId);
    setMessage('Revisión humana guardada');
  };

  const recordDecision = async (status: 'approved' | 'rejected') => {
    if (!campaign || !selectedRun) return;
    setBusy(true);
    setError(null);
    try {
      const bridge = createExperimentExecutionBridge({ store, now });
      await bridge.queueForHitl(selectedRun.runId);
      const decision: HitlDecisionV1 = {
        contractId: 'aura.hitl-decision.v1',
        status,
        reviewerId: 'reviewer:oe4',
        decidedAt: now(),
        reason: status === 'approved'
          ? 'Aprobado para ejecución externa controlada.'
          : 'Rechazado durante la revisión HITL.',
      };
      await bridge.recordHitlDecision(selectedRun.runId, decision);
      await refresh(campaign.campaignId, selectedRun.runId);
      setMessage(status === 'approved' ? 'Representante aprobado' : 'Representante rechazado');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (file: File, receiptFile: File) => {
    if (!campaign || !selectedRun || !importAfterCsv) return;
    setBusy(true);
    setError(null);
    try {
      const next = await importAfterCsv(selectedRun, file, receiptFile);
      await store.saveRun(next);
      await refresh(campaign.campaignId, next.runId);
      setMessage('Recibo Python verificado; CSV importado y reauditoría registrada');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const prepareExternalExecution = async () => {
    if (!campaign || !selectedRun || !prepareApprovedRepresentative) return;
    setBusy(true);
    setError(null);
    try {
      const next = await prepareApprovedRepresentative(selectedRun);
      await store.saveRun(next);
      await refresh(campaign.campaignId, next.runId);
      setMessage(next.status === 'awaiting_external_output'
        ? 'Ejecución externa preparada; importa el CSV resultante.'
        : 'La preparación externa quedó bloqueada.');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oe4-campaign-lab" data-testid="oe4-campaign-lab">
      <header className="oe4-hero">
        <div>
          <h1>Laboratorio de evaluación LLM</h1>
          <p>Compara modelos y métodos de entrada mediante {FINAL_EVALUATION_PROTOCOL.matrix.units} diagnósticos reproducibles, sin declarar un ganador universal.</p>
        </div>
        {campaign && (
          <div className="oe4-controls">
            {phase === 'running' ? (
              <button type="button" className="btn-s" onClick={() => {
                pauseRequested.current = true;
                setMessage('Pausa solicitada; terminará la corrida actual.');
              }}>
                Pausar de forma segura
              </button>
            ) : attempted < campaign.plannedRuns ? (
              <button type="button" className="btn-p" disabled={!runner} onClick={() => void runCampaign()}>
                {phase === 'paused' || attempted > 0 ? 'Reanudar experimento' : 'Iniciar experimento'}
              </button>
            ) : null}
          </div>
        )}
      </header>

      {error && <p className="oe4-blocker" role="alert">{error}</p>}
      {message && <p className="oe4-live-message" role="status">{message}</p>}

      {!campaign ? (
        <CampaignSetupPanel
          creating={creating}
          canCreate={Boolean(createCampaignBundle) && formalModelsInstalled}
          blocker={!createCampaignBundle
            ? 'Carga y audita el dataset controlado; AURA ejecutará el preflight antes de crear el experimento.'
            : !formalModelsInstalled
              ? 'Instala o refresca los tres modelos de la campaña antes de crear el experimento.'
              : undefined}
          installedModels={ollamaCatalog.models}
          modelCatalogLoading={ollamaCatalog.loading}
          onRefreshModels={ollamaCatalog.refresh}
          onCreate={createCampaign}
        />
      ) : (
        <>
          <section className="oe4-progress" aria-label="Progreso del experimento">
            <div><span>Intentadas</span><strong>{attempted} / {campaign.plannedRuns}</strong></div>
            <div><span>Completadas</span><strong>{completed}</strong></div>
            <div><span>Fallidas</span><strong>{failed}</strong></div>
            <div><span>Revisión</span><strong>{pendingReview}</strong><small>{pendingReview} {pendingReview === 1 ? 'pendiente' : 'pendientes'} de revisión</small></div>
          </section>

          <CampaignMatrix
            runs={runs}
            selectedRunId={selectedRunId}
            representativeIds={representativeIds}
            onSelectRun={(runId) => void refresh(campaign.campaignId, runId)}
          />

          {selectedRun && (
            <div className="oe4-detail-layout">
              <div>
                <ExperimentRunDetail run={selectedRun} representative={representativeIds.has(selectedRun.runId)} />
                {selectedRun.status === 'awaiting_human' && (
                  <HumanRubricPanel reviewerId="reviewer:oe4" now={now} onSave={saveHumanReview} />
                )}
              </div>
              <div>
                <ExecutionEvidencePanel
                  run={selectedRun}
                  representative={representativeIds.has(selectedRun.runId)}
                  busy={busy}
                  onDecision={recordDecision}
                  onPrepare={prepareExternalExecution}
                  onDownloadBundle={() => selectedRun && downloadExecutionBundle?.(selectedRun)}
                  onImport={importCsv}
                  canPrepare={Boolean(prepareApprovedRepresentative)}
                  canImport={Boolean(importAfterCsv && downloadExecutionBundle)}
                />
                {evidenceDocument && (
                  <CampaignReportPanel
                    formalValidity={evidenceDocument.formalValidity}
                    evidencePackage={evidencePackage}
                    onExport={onExport}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BenchmarkCampaignLab;
