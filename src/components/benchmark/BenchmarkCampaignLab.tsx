import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIProvider } from '../../types';
import type { InferenceSnapshotV1 } from '../../contracts/llm/types';
import type { DiagnosisPipelineOutcome } from '../../contracts/llm/diagnosisPipelineV2';
import {
  createExperimentRunner,
  type ExperimentRunner,
  type ExperimentRunProgressPhase,
} from '../../services/benchmark/experimentRunner';
import type { ExperimentValidationErrorV1 } from '../../services/benchmark/experimentTypes';
import { createIndexedDbExperimentStore } from '../../services/benchmark/indexedDbExperimentStore';
import type { ExperimentStore } from '../../services/benchmark/experimentStore';
import type {
  AutomaticEvaluationV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from '../../services/benchmark/experimentTypes';
import { buildExperimentCampaignEvidence } from '../../services/benchmark/experimentReport';
import {
  exportExperimentEvidencePackage,
  type ExperimentEvidencePackage,
} from '../../services/benchmark/experimentArtifactExporter';
import CampaignSetupPanel from './CampaignSetupPanel';
import CampaignMatrix from './CampaignMatrix';
import ExperimentRunDetail from './ExperimentRunDetail';
import CampaignReportPanel from './CampaignReportPanel';
import CampaignResultsExplorer from './CampaignResultsExplorer';
import CampaignConfigurationPanel from './CampaignConfigurationPanel';
import BenchmarkGlossary from './BenchmarkGlossary';
import { useOllamaModelCatalog } from '../../services/useOllamaModelCatalog';
import { ollamaModelId } from '../../services/ollamaModelCatalog';
import {
  FINAL_EVALUATION_PROTOCOL,
  OE4_INPUT_MODE_LABELS,
} from '../../services/benchmark/finalEvaluationProtocol';
import SyntaxDisplay from '../SyntaxDisplay';
import { buildExperimentFailureArchive } from '../../services/benchmark/experimentFailureArchive';
import { downloadBlob } from '../../utils/download';
import {
  buildCampaignPipelineConfiguration,
  type CampaignPipelineConfigurationV1,
} from '../../services/benchmark/campaignPipelineConfiguration';

export interface ExperimentCampaignBundle {
  campaign: ExperimentCampaignV1;
  runs: ExperimentRunV1[];
}

interface BenchmarkCampaignLabProps {
  store?: ExperimentStore;
  runner?: ExperimentRunner;
  provider?: Pick<AIProvider, 'generateText' | 'generateTextWithProgress'>;
  providerForRun?: (run: ExperimentRunV1) => Pick<AIProvider, 'generateText' | 'generateTextWithProgress'>;
  validateDiagnosis?: (parsed: unknown, run: ExperimentRunV1) => ExperimentValidationErrorV1[];
  processDiagnosis?: (rawResponse: string, run: ExperimentRunV1) => DiagnosisPipelineOutcome;
  initialInference?: InferenceSnapshotV1;
  createCampaignBundle?: (inference: InferenceSnapshotV1) => Promise<ExperimentCampaignBundle>;
  evaluateRun?: (run: ExperimentRunV1) => Promise<AutomaticEvaluationV1>;
  onExport?: (evidencePackage: ExperimentEvidencePackage) => void;
  onApplyPipelineConfiguration?: (configuration: CampaignPipelineConfigurationV1) => void;
  onGoToAudit?: () => void;
  now?: () => string;
  ollamaBaseUrl?: string;
}

type CampaignPhase = 'idle' | 'running' | 'paused' | 'finished';

interface ActiveExecution {
  runId: string;
  sequence: number;
  modelId: string;
  inputMode: ExperimentRunV1['inputMode'];
  repetition: number;
  phase: ExperimentRunProgressPhase | 'evaluation' | 'saving';
  startedAtMs: number;
}

const shortModelName = (modelId: string): string => {
  if (modelId.includes('Qwen3.5-4B-GGUF')) return 'Qwen3.5 4B';
  if (modelId.includes('gemma-4-E4B')) return 'Gemma 4 E4B';
  return 'SmolLM3 3B';
};

const phaseLabel: Record<ActiveExecution['phase'], string> = {
  warmup: 'Calentamiento excluido',
  diagnosis: 'Diagnóstico LLM',
  evaluation: 'Evaluación automática',
  saving: 'Guardando evidencia',
};

const BenchmarkCampaignLab: React.FC<BenchmarkCampaignLabProps> = ({
  store: suppliedStore,
  runner: suppliedRunner,
  provider,
  providerForRun,
  validateDiagnosis,
  processDiagnosis,
  initialInference = FINAL_EVALUATION_PROTOCOL.inference,
  createCampaignBundle,
  evaluateRun,
  onExport,
  onApplyPipelineConfiguration,
  onGoToAudit,
  now = () => new Date().toISOString(),
  ollamaBaseUrl = 'http://127.0.0.1:11434',
}) => {
  const ollamaCatalog = useOllamaModelCatalog(ollamaBaseUrl);
  const store = useMemo(
    () => suppliedStore ?? createIndexedDbExperimentStore(),
    [suppliedStore],
  );
  const runner = useMemo(
    () => suppliedRunner ?? ((provider || providerForRun) && (processDiagnosis || validateDiagnosis)
      ? createExperimentRunner({ provider, providerForRun, validateDiagnosis, processDiagnosis, store, now })
      : null),
    [now, processDiagnosis, provider, providerForRun, store, suppliedRunner, validateDiagnosis],
  );
  const pauseRequested = useRef(false);
  const [campaign, setCampaign] = useState<ExperimentCampaignV1 | null>(null);
  const [runs, setRuns] = useState<ExperimentRunV1[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [phase, setPhase] = useState<CampaignPhase>('idle');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeExecution, setActiveExecution] = useState<ActiveExecution | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveDiagnosisResponse, setLiveDiagnosisResponse] = useState('');
  const [draftInference, setDraftInference] = useState<InferenceSnapshotV1>(() => ({ ...initialInference }));
  const [selectedResultCellId, setSelectedResultCellId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeExecution) {
      setElapsedSeconds(0);
      return undefined;
    }
    const updateElapsed = () => setElapsedSeconds(Math.max(
      0,
      Math.floor((Date.now() - activeExecution.startedAtMs) / 1000),
    ));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [activeExecution]);

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

  const selectedRun = runs.find((run) => run.runId === selectedRunId) ?? null;
  const attempted = runs.filter((run) => run.status !== 'planned').length;
  const completed = runs.filter((run) => run.diagnosis?.status === 'completed').length;
  const failed = runs.filter((run) => run.status === 'failed').length;
  const automaticallyEvaluated = runs.filter((run) => run.automaticEvaluation !== null).length;
  const campaignUsesCurrentProtocol = campaign?.protocolVersion === FINAL_EVALUATION_PROTOCOL.version;
  const campaignForEvidence = useMemo(() => {
    if (!campaign) return null;
    const campaignComplete = runs.length === campaign.plannedRuns
      && runs.every((run) => !['planned', 'running'].includes(run.status));
    return campaignComplete && campaign.status !== 'completed'
      ? { ...campaign, status: 'completed' as const, updatedAt: now() }
      : campaign;
  }, [campaign, now, runs]);
  const evidenceDocument = useMemo(() => campaignForEvidence
    ? buildExperimentCampaignEvidence(campaignForEvidence, runs, now())
    : null, [campaignForEvidence, now, runs]);
  const evidencePackage = useMemo(() => (
    campaignForEvidence && evidenceDocument?.formalValidity.valid
      ? exportExperimentEvidencePackage({
        campaign: campaignForEvidence,
        runs,
        generatedAt: evidenceDocument.generatedAt,
        selectedCellId: selectedResultCellId ?? undefined,
        ollamaBaseUrl,
      })
      : null
  ), [campaignForEvidence, evidenceDocument, ollamaBaseUrl, runs, selectedResultCellId]);
  const installedModelIds = useMemo(
    () => new Set(ollamaCatalog.models.map(ollamaModelId)),
    [ollamaCatalog.models],
  );
  const formalModelsInstalled = FINAL_EVALUATION_PROTOCOL.models.every((modelId) => installedModelIds.has(modelId));
  const selectedPipelineConfiguration = useMemo(() => {
    if (!evidenceDocument?.formalValidity.valid) return null;
    try {
      return buildCampaignPipelineConfiguration(
        evidenceDocument,
        selectedResultCellId ?? undefined,
        ollamaBaseUrl,
      );
    } catch {
      return null;
    }
  }, [evidenceDocument, ollamaBaseUrl, selectedResultCellId]);

  useEffect(() => {
    if (!evidenceDocument?.formalValidity.valid) {
      setSelectedResultCellId(null);
      return;
    }
    if (selectedResultCellId && evidenceDocument.decisionSupport.scores.some((score) => score.cellId === selectedResultCellId)) return;
    const balanced = evidenceDocument.decisionSupport.recommendations.find((entry) => entry.useCase === 'balanced');
    const initial = (balanced
      ? evidenceDocument.decisionSupport.scores.find((score) =>
        score.modelId === balanced.modelId && score.inputMode === balanced.inputMode)?.cellId
      : undefined)
      ?? evidenceDocument.decisionSupport.scores[0]?.cellId
      ?? null;
    setSelectedResultCellId(initial);
  }, [evidenceDocument, selectedResultCellId]);

  const createCampaign = async () => {
    if (!createCampaignBundle) return;
    setCreating(true);
    setError(null);
    try {
      const bundle = await createCampaignBundle(draftInference);
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
    if (!campaignUsesCurrentProtocol) {
      setError(`Esta campaña usa el protocolo ${campaign.protocolVersion}. Crea una nueva campaña con ${FINAL_EVALUATION_PROTOCOL.version}.`);
      return;
    }
    setPhase('running');
    setMessage('Experimento en ejecución');
    setError(null);
    pauseRequested.current = false;
    const candidates = (await store.listRuns(campaign.campaignId))
      .filter((run) => run.status === 'planned');
    let automaticPauseReason: string | null = null;

    try {
      for (const candidate of candidates) {
        if (pauseRequested.current) break;
        setSelectedRunId(candidate.runId);
        setActiveExecution({
          runId: candidate.runId,
          sequence: candidate.sequence,
          modelId: candidate.modelId,
          inputMode: candidate.inputMode,
          repetition: candidate.repetition,
          phase: 'warmup',
          startedAtMs: Date.now(),
        });
        setLiveDiagnosisResponse('');
        let executed = await runner.runUnit(candidate, {
          onProgress: (progress) => {
            if (progress.state === 'started') {
              setActiveExecution((current) => current && current.runId === progress.runId
                ? { ...current, phase: progress.phase }
                : current);
            }
          },
          onResponseChunk: ({ runId, accumulatedText }) => {
            if (runId === candidate.runId) setLiveDiagnosisResponse(accumulatedText);
          },
        });
        if (executed.status === 'completed' && evaluateRun) {
          setActiveExecution((current) => current ? { ...current, phase: 'evaluation' } : current);
          const evaluation = await evaluateRun(executed);
          executed = {
            ...executed,
            status: 'completed',
            updatedAt: now(),
            automaticEvaluation: evaluation,
          };
          await store.saveRun(executed);
        }
        setActiveExecution((current) => current ? { ...current, phase: 'saving' } : current);
        await refresh(campaign.campaignId, candidate.runId);
        if (candidate.sequence === 1 && executed.status === 'failed') {
          automaticPauseReason = 'Primera corrida fallida. AURA pausó la campaña para evitar consumir las 26 restantes.';
          pauseRequested.current = true;
        }
      }
      if (pauseRequested.current) {
        setPhase('paused');
        setMessage(automaticPauseReason ?? 'Experimento pausado');
      } else {
        setPhase('finished');
        setMessage('Ejecución terminada. El reporte automático incluye las corridas válidas y los fallos observados.');
      }
    } catch (cause: unknown) {
      setPhase('paused');
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActiveExecution(null);
    }
  };

  const downloadFailurePackage = (run: ExperimentRunV1): void => {
    if (!campaign) return;
    const archive = buildExperimentFailureArchive({
      campaign,
      run,
      generatedAt: now(),
    });
    downloadBlob(archive.filename, new Blob([archive.bytes], { type: 'application/zip' }));
  };

  return (
    <div className="oe4-campaign-lab editorial-workbench" data-testid="oe4-campaign-lab" aria-labelledby="oe4-lab-title">
      <header className="oe4-hero">
        <div>
          <p className="oe4-eyebrow">09 · Laboratorio</p>
          <h1 id="oe4-lab-title">Laboratorio de evaluación LLM</h1>
          <p>Compara modelos y métodos de entrada mediante {FINAL_EVALUATION_PROTOCOL.matrix.units} diagnósticos reproducibles, sin declarar un ganador universal.</p>
        </div>
        {campaign && (
          <div className="oe4-controls">
            {!campaignUsesCurrentProtocol ? null : phase === 'running' ? (
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

      {campaign && !campaignUsesCurrentProtocol && (
        <p className="oe4-blocker" role="alert">
          Campaña anterior conservada como piloto inválido: protocolo {campaign.protocolVersion}. No la reanudes; crea una nueva campaña con {FINAL_EVALUATION_PROTOCOL.version}.
        </p>
      )}

      {!campaign || !campaignUsesCurrentProtocol ? (
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
          inference={draftInference}
          onInferenceChange={setDraftInference}
          onRefreshModels={ollamaCatalog.refresh}
          onCreate={createCampaign}
        />
      ) : (
        <>
          <section className="oe4-progress" aria-label="Progreso del experimento">
            <div><span>Intentadas</span><strong>{attempted} / {campaign.plannedRuns}</strong></div>
            <div><span>Válidas</span><strong>{completed}</strong></div>
            <div><span>Fallidas</span><strong>{failed}</strong></div>
            <div><span>Con score automático</span><strong>{automaticallyEvaluated}</strong><small>sin revisión humana obligatoria</small></div>
          </section>

          {phase === 'running' && activeExecution && (
            <section className="oe4-live-execution" aria-live="polite" aria-label="Ejecución actual">
              <div className="oe4-live-execution-head">
                <div>
                  <p className="oe4-eyebrow">Corrida actual {activeExecution.sequence} de {campaign.plannedRuns}</p>
                  <h2>{shortModelName(activeExecution.modelId)} · {OE4_INPUT_MODE_LABELS[activeExecution.inputMode]}</h2>
                </div>
                <span className="oe4-live-pulse">EN CURSO</span>
              </div>
              <div className="oe4-live-execution-grid">
                <div><span>Fase</span><strong>{phaseLabel[activeExecution.phase]}</strong></div>
                <div><span>Repetición</span><strong>{activeExecution.repetition}</strong></div>
                <div><span>Tiempo transcurrido</span><strong>{Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s</strong></div>
                <div><span>Progreso</span><strong>{attempted} terminadas · {campaign.plannedRuns - attempted} restantes</strong></div>
              </div>
              <div className="oe4-live-progress-track" aria-hidden="true">
                <span style={{ width: `${Math.max(2, (attempted / campaign.plannedRuns) * 100)}%` }} />
              </div>
              <div className="oe4-live-stream">
                <div className="oe4-live-stream-meta">
                  <span>Respuesta real del modelo</span>
                  <span>{liveDiagnosisResponse.length.toLocaleString('es-CO')} caracteres recibidos</span>
                </div>
                <SyntaxDisplay
                  filename="diagnosis.response.stream.json"
                  content={liveDiagnosisResponse || (activeExecution.phase === 'warmup'
                    ? 'Esperando que termine el calentamiento excluido…'
                    : 'Esperando el primer fragmento del modelo…')}
                  copyText={liveDiagnosisResponse || undefined}
                  maxHeight={320}
                  wrap
                  autoScroll
                  role="log"
                  ariaLive="polite"
                  testId="oe4-diagnosis-response-stream"
                  contentTestId="oe4-diagnosis-response-stream-content"
                />
              </div>
            </section>
          )}

          <CampaignMatrix
            runs={runs}
            selectedRunId={selectedRunId}
            activeRunId={activeExecution?.runId ?? null}
            onSelectRun={(runId) => void refresh(campaign.campaignId, runId)}
          />

          {evidenceDocument?.formalValidity.valid && (
            <>
              <CampaignResultsExplorer
                evidenceDocument={evidenceDocument}
                selectedCellId={selectedResultCellId ?? undefined}
                onSelectedCellIdChange={setSelectedResultCellId}
              />
              {selectedPipelineConfiguration && (
                <CampaignConfigurationPanel
                  configuration={selectedPipelineConfiguration}
                  modelInstalled={installedModelIds.has(selectedPipelineConfiguration.modelId)}
                  onApply={onApplyPipelineConfiguration}
                  onGoToAudit={onGoToAudit}
                />
              )}
              <BenchmarkGlossary />
            </>
          )}

          {selectedRun && (
            <div className="oe4-detail-layout">
              <div>
                <ExperimentRunDetail
                  run={selectedRun}
                  onDownloadFailurePackage={selectedRun.status === 'failed'
                    ? () => downloadFailurePackage(selectedRun)
                    : undefined}
                />
              </div>
              <div>
                {evidenceDocument && (
                  <CampaignReportPanel
                    evidenceDocument={evidenceDocument}
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
