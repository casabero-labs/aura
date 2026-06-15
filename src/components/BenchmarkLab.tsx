import React, { useEffect, useMemo, useState } from 'react';
import { Activity, FlaskConical, ArrowLeft, Play, BarChart3, Database, FileJson, Gauge, ShieldAlert, Zap, CheckCircle2, ThermometerSun } from 'lucide-react';
import { AuditReport, AIConfig, BenchmarkResult, AuditExecutionEvidence, DeterministicValidationReport, ExecutionTraceEvent, InputMode } from '../types';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { runBenchmarkForConfig } from '../services/benchmarkService';
import { compositeScore, experimentStats, exportBenchmarkJson } from '../services/benchmark/evaluationService';
import { ScoreBarChart, ScatterPlot, HallucinationChart, LatencyChart } from './BenchmarkCharts';

interface BenchmarkLabProps {
  report: AuditReport;
  rawData: Record<string, any>[];
  csvFields: string[];
  csvDelimiter: string;
  fileName?: string;
  aiConfig: AIConfig;
  auditEvidence?: AuditExecutionEvidence;
  deterministicValidation?: DeterministicValidationReport | null;
  onResultsChange?: (results: BenchmarkResult[]) => void;
  onBack: () => void;
  onApplyConfig?: (config: AIConfig) => void;
}

const statusLabel: Record<BenchmarkResult['status'], string> = {
  pending: 'Pendiente',
  running: 'Ejecutando',
  completed: 'Completado',
  error: 'Error',
  unavailable: 'No disponible'
};

const evidenceLabel: Record<BenchmarkResult['evidenceStatus'], string> = {
  planned: 'Plan',
  attempted_failed: 'Inválida',
  preliminary_valid: 'Preliminar',
  formal_valid: 'Formal'
};

const inputModeLabel: Record<InputMode, string> = {
  prompt_libre: 'Prompt libre',
  smart_sample: 'Contrato AURA',
  enhanced_registry: 'Registro técnico',
  copy_paste_bad_samples: 'Bad samples',
  recommended: 'Recomendado'
};

const traceLabel = (event: ExecutionTraceEvent) => {
  const details = event.details
    ? Object.entries(event.details)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' · ')
    : '';
  return details ? `${event.stage} · ${details}` : event.stage;
};

const BenchmarkLab: React.FC<BenchmarkLabProps> = ({
  report,
  aiConfig,
  auditEvidence,
  deterministicValidation,
  onResultsChange,
  onBack,
  onApplyConfig,
}) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'local' | 'cloud'>(aiConfig.providerType === 'cloud' && aiConfig.apiKey ? 'cloud' : 'local');
  const [selectedModel, setSelectedModel] = useState(aiConfig.model || AVAILABLE_MODELS.local[0]?.id || '');
  const [selectedTemperature, setSelectedTemperature] = useState(aiConfig.temperature ?? 0.7);
  const [selectedInputMode, setSelectedInputMode] = useState<InputMode>(aiConfig.inputMode || 'smart_sample');
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [appliedConfigId, setAppliedConfigId] = useState<string | null>(null);

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  const cloudModels = aiConfig.cloudProvider
    ? AVAILABLE_MODELS.cloud.filter(m => m.provider.toLowerCase() === aiConfig.cloudProvider)
    : AVAILABLE_MODELS.cloud;

  const providerModels = selectedProvider === 'local' ? AVAILABLE_MODELS.local : cloudModels;
  const completedResults = results.filter(r => r.status === 'completed');
  const activeRun = results.find((result) => result.id === runningId);

  useEffect(() => {
    const models = selectedProvider === 'local' ? AVAILABLE_MODELS.local : cloudModels;
    if (!models.some((model) => model.id === selectedModel)) {
      setSelectedModel(models[0]?.id || '');
    }
  }, [cloudModels, selectedModel, selectedProvider]);

  // ── Winner recommendation ──
  const winner = useMemo(() => {
    if (completedResults.length === 0) return null;
    return completedResults.reduce((best, r) =>
      (r.compositeScore ?? 0) > (best.compositeScore ?? 0) ? r : best
    );
  }, [completedResults]);

  const fastest = useMemo(() => {
    if (completedResults.length === 0) return null;
    return completedResults.reduce((best, r) =>
      r.latencyMs < best.latencyMs ? r : best
    );
  }, [completedResults]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('es-CO', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { time, msg }].slice(-28));
  };

  const runSingleBenchmark = async (
    providerType: 'local' | 'cloud',
    modelId: string,
    inputMode: InputMode,
    temperature: number,
  ) => {
    const runConfig: AIConfig = {
      ...aiConfig,
      providerType,
      model: modelId,
      temperature,
      inputMode,
      cloudProvider: providerType === 'cloud'
        ? (cloudModels.find(m => m.id === modelId)?.provider?.toLowerCase() as any)
        : undefined
    };

    const pendingId = `lab-${providerType}-${modelId}-${inputMode}-${Date.now()}`;
    const pending: BenchmarkResult = {
      id: pendingId,
      provider: providerType === 'local' ? 'WebLLM' : 'Gemini',
      providerType,
      inputMode,
      model: modelId,
      temperature,
      status: 'running',
      latencyMs: 0,
      firstTokenMs: 0,
      tokensGenerated: 0,
      tokensPerSecond: 0,
      contractCompliance: false,
      formatCompliance: false,
      pythonScriptIncluded: false,
      hallucinatedColumns: [],
      unsupportedClaims: 0,
      evidenceStatus: 'planned',
      startedAt: new Date().toISOString(),
      datasetFingerprint: auditEvidence?.datasetFingerprint,
      timestamp: new Date().toISOString()
    };

    setResults(prev => [pending, ...prev]);
    setRunningId(pendingId);
    addLog(`inicia ${providerType} · ${modelId} · ${inputModeLabel[inputMode]} · temp=${temperature}`);

    try {
      const result = await runBenchmarkForConfig(report, runConfig, inputMode, (event) => {
        addLog(traceLabel(event));
        setResults(prev => prev.map(item => item.id === pendingId
          ? { ...item, executionTrace: [...(item.executionTrace || []), event] }
          : item
        ));
      }, deterministicValidation?.groundTruthMatched);
      const maxLat = Math.max(...results.map(r => r.latencyMs), result.latencyMs, 1000);
      result.compositeScore = compositeScore(result, undefined, maxLat);
      setResults(prev => prev.map(r => r.id === pendingId ? result : r));
      addLog(`finaliza ${result.status} · latencia=${result.latencyMs}ms · score=${result.compositeScore?.toFixed(2) ?? '-'}`);
      return result;
    } catch (err) {
      const errorResult: BenchmarkResult = {
        ...pending,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        completedAt: new Date().toISOString()
      };
      setResults(prev => prev.map(r => r.id === pendingId ? errorResult : r));
      addLog(`error · ${errorResult.error}`);
      return errorResult;
    } finally {
      setRunningId(null);
    }
  };

  const runSelected = async () => {
    if (!selectedModel) return;
    setIsRunning(true);
    await runSingleBenchmark(selectedProvider, selectedModel, selectedInputMode, selectedTemperature);
    setIsRunning(false);
    setShowCharts(true);
  };

  const runAllInputModes = async () => {
    if (!selectedModel) return;
    setIsRunning(true);
    const modes: InputMode[] = ['smart_sample', 'enhanced_registry', 'copy_paste_bad_samples', 'recommended', 'prompt_libre'];
    for (const inputMode of modes) {
      await runSingleBenchmark(selectedProvider, selectedModel, inputMode, selectedTemperature);
    }
    setIsRunning(false);
    setShowCharts(true);
  };

  const runComparison = async () => {
    setIsRunning(true);
    const localModel = AVAILABLE_MODELS.local[0];
    const cloudModel = cloudModels[0];

    if (localModel) {
      await runSingleBenchmark('local', localModel.id, 'smart_sample', selectedTemperature);
    }
    if (cloudModel && aiConfig.apiKey) {
      await runSingleBenchmark('cloud', cloudModel.id, 'smart_sample', selectedTemperature);
    }
    setIsRunning(false);
    setShowCharts(true);
  };

  const handleExportJson = () => {
    if (results.length === 0) return;
    const blob = new Blob([exportBenchmarkJson(results)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aura_benchmark_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('exporta JSON benchmark');
  };

  const handleApplyWinner = () => {
    if (!winner || !onApplyConfig) return;
    const config: AIConfig = {
      ...aiConfig,
      providerType: winner.providerType,
      model: winner.model,
      temperature: winner.temperature ?? aiConfig.temperature,
      cloudProvider: winner.cloudProvider,
      inputMode: winner.inputMode,
    };
    onApplyConfig(config);
    setAppliedConfigId(winner.id);
    addLog(`configuración aplicada a AURA: ${winner.providerType} · ${winner.model} · temp=${config.temperature} · ${inputModeLabel[winner.inputMode]}`);
  };

  return (
    <div className="benchmark-lab-page">
      {/* Header */}
      <header className="lab-header">
        <button className="lab-back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Volver al flujo
        </button>
        <div className="lab-title-block">
          <FlaskConical size={20} className="lab-flask-icon" />
          <div>
            <h1>Laboratorio de calibración</h1>
            <p>
              Compara configuraciones de diagnóstico sobre el dataset perfilado. Encuentra la mejor combinación de proveedor, modelo y temperatura para tu caso.
            </p>
          </div>
        </div>
      </header>

      {/* ── Config Zone ── */}
      <section className="lab-section">
        <div className="lab-runner">
          <p className="sec-eye" style={{ marginBottom: 'var(--space-md)' }}>configuración del experimento</p>
          <div className="lab-runner-controls">
            <label>
              <span>Proveedor</span>
              <select value={selectedProvider} disabled={isRunning} onChange={(event) => setSelectedProvider(event.target.value as 'local' | 'cloud')}>
                <option value="local">Local WebLLM</option>
                <option value="cloud" disabled={!aiConfig.apiKey}>Cloud configurado</option>
              </select>
            </label>
            <label>
              <span>Modelo</span>
              <select value={selectedModel} disabled={isRunning} onChange={(event) => setSelectedModel(event.target.value)}>
                {providerModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </label>
            <label>
              <span>Entrada</span>
              <select value={selectedInputMode} disabled={isRunning} onChange={(event) => setSelectedInputMode(event.target.value as InputMode)}>
                <option value="smart_sample">Contrato AURA</option>
                <option value="enhanced_registry">Registro técnico</option>
                <option value="copy_paste_bad_samples">Bad samples</option>
                <option value="recommended">Recomendado</option>
                <option value="prompt_libre">Prompt libre</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <ThermometerSun size={14} style={{ color: 'var(--ink3)' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink2)' }}>Temperatura</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(selectedTemperature * 100)}
                disabled={isRunning}
                onChange={(e) => setSelectedTemperature(Number(e.target.value) / 100)}
                className="settings-slider"
                style={{ width: 120, margin: 0 }}
              />
              <code style={{ fontSize: '12px', minWidth: 30 }}>{selectedTemperature.toFixed(2)}</code>
            </label>
          </div>
          <div className="lab-runner-actions">
            <button className="btn-p" onClick={runSelected} disabled={isRunning || !selectedModel}>
              <Play size={14} /> {isRunning ? 'Ejecutando' : 'Ejecutar corrida'}
            </button>
            <button className="btn-s" onClick={runAllInputModes} disabled={isRunning || !selectedModel}>
              <Activity size={14} /> Comparar modos de entrada
            </button>
            <button className="btn-s" onClick={runComparison} disabled={isRunning || !aiConfig.apiKey}>
              <Gauge size={14} /> Local vs cloud
            </button>
            <button className="btn-s" onClick={handleExportJson} disabled={results.length === 0}>
              <FileJson size={14} /> Exportar evidencia
            </button>
          </div>
        </div>
      </section>

      {/* ── Recommendation Panel ── */}
      {winner && (
        <section className="lab-section">
          <div className="lab-recommendation">
            <div className="lab-recommendation-header">
              <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
              <strong>Mejor configuración</strong>
              <span>{winner.providerType === 'local' ? 'Local-first' : 'Cloud'} · {winner.model} · temp={winner.temperature?.toFixed(2)}</span>
            </div>
            <div className="lab-recommendation-grid">
              <div className="lab-recommendation-card lab-recommendation-card--score">
                <span>Score compuesto</span>
                <strong>{winner.compositeScore?.toFixed(4)}</strong>
              </div>
              <div className="lab-recommendation-card">
                <span>Latencia</span>
                <strong>{winner.latencyMs}ms</strong>
              </div>
              <div className="lab-recommendation-card">
                <span>Alucinaciones</span>
                <strong>{winner.hallucinatedColumns.length}</strong>
              </div>
              <div className="lab-recommendation-card">
                <span>Evidencia</span>
                <strong style={{ color: winner.evidenceStatus === 'formal_valid' ? 'var(--success)' : 'var(--orange)' }}>
                  {evidenceLabel[winner.evidenceStatus]}
                </strong>
              </div>
            </div>

            {/* Tradeoff info */}
            <div className="lab-tradeoff">
              <p className="lab-tradeoff-title">Tradeoff</p>
              <div className="lab-tradeoff-grid">
                <div>
                  <span>Calidad</span>
                  <strong>{winner.compositeScore && winner.compositeScore >= 0.7 ? 'Alta' : winner.compositeScore && winner.compositeScore >= 0.4 ? 'Media' : 'Baja'}</strong>
                </div>
                <div>
                  <span>Velocidad</span>
                  <strong>{winner.latencyMs < 5000 ? 'Rápida' : winner.latencyMs < 15000 ? 'Moderada' : 'Lenta'}</strong>
                </div>
                <div>
                  <span>Privacidad</span>
                  <strong>{winner.providerType === 'local' ? 'Local (sin envío)' : 'Cloud (datos viajan)'}</strong>
                </div>
              </div>
            </div>

            {onApplyConfig && (
              <div className="lab-recommendation-actions">
                <button className="btn-p" onClick={handleApplyWinner} disabled={appliedConfigId === winner.id}>
                  <Zap size={14} />
                  {appliedConfigId === winner.id ? 'Configuración aplicada' : 'Aplicar esta configuración a AURA'}
                </button>
                {appliedConfigId === winner.id && (
                  <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> El diagnóstico principal usará esta configuración
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Log panel */}
      <section className="lab-section">
        <div className="lab-log-panel">
          <div className="live-trace-head">
            <span>tail -f aura.experiment.log</span>
            <code>{activeRun ? `${activeRun.providerType}/${activeRun.inputMode}` : 'idle'}</code>
          </div>
          <div className="terminal-log" role="log" aria-live="polite">
            {logs.length === 0 ? (
              <div className="terminal-log-row">
                <span className="terminal-log-time">--:--:--</span>
                <strong className="terminal-log-stage">lab.idle</strong>
                <code className="terminal-log-meta">Selecciona proveedor, modelo y temperatura para iniciar una corrida.</code>
              </div>
            ) : logs.map((log, index) => (
              <div className="terminal-log-row" key={`${log.time}-${index}`}>
                <span className="terminal-log-time">{log.time}</span>
                <strong className="terminal-log-stage">benchmark</strong>
                <code className="terminal-log-meta">{log.msg}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Table */}
      <section className="lab-section">
        <div className="section-header">
          <h3>Resultados comparados</h3>
          <span className="lab-count">{completedResults.length} corridas completadas</span>
        </div>

        {results.length > 0 && (
          <div className="benchmark-summary-strip">
            <div className="bss-item">
              <span className="bss-value">{results.length}</span>
              <span className="bss-label">corridas</span>
            </div>
            <div className="bss-item bss-item--formal">
              <span className="bss-value">{results.filter(r => r.evidenceStatus === 'formal_valid').length}</span>
              <span className="bss-label">formal</span>
            </div>
            <div className="bss-item">
              <span className="bss-value">{completedResults.length > 0 ? Math.max(...completedResults.map(r => r.compositeScore ?? 0)).toFixed(2) : '—'}</span>
              <span className="bss-label">mejor score</span>
            </div>
            <div className="bss-item">
              <span className="bss-value">{fastest ? `${fastest.latencyMs}ms` : '—'}</span>
              <span className="bss-label">menor latencia</span>
            </div>
          </div>
        )}

        <div className="lab-table-wrap">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Modelo</th>
                <th>Entrada</th>
                <th>Temp</th>
                <th>Estado</th>
                <th>Latencia</th>
                <th>Contrato</th>
                <th>Script</th>
                <th>Alucin.</th>
                <th>Score</th>
                <th>Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr>
                  <td colSpan={11} className="lab-empty">
                    Sin ejecuciones. Configura proveedor, modelo y temperatura para iniciar.
                  </td>
                </tr>
              )}
              {results.map(result => {
                const isWinner = winner?.id === result.id;
                return (
                  <tr key={result.id} className={`${result.status === 'running' ? 'lab-running' : ''} ${isWinner ? 'lab-row--winner' : ''}`}>
                    <td>
                      <strong>{result.provider}</strong>
                      {isWinner && <CheckCircle2 size={12} style={{ color: 'var(--success)', marginLeft: 4 }} />}
                    </td>
                    <td>{result.model}</td>
                    <td>{inputModeLabel[result.inputMode]}</td>
                    <td><code>{result.temperature?.toFixed(2)}</code></td>
                    <td>
                      <span className={`lab-status lab-status-${result.status}`}>
                        {result.status === 'running' && <Activity size={12} />}
                        {statusLabel[result.status]}
                      </span>
                      {result.error && <small className="lab-error">{result.error}</small>}
                    </td>
                    <td>{result.latencyMs ? `${result.latencyMs}ms` : '-'}</td>
                    <td>{(result.contractCompliance ?? result.formatCompliance) ? 'OK' : '-'}</td>
                    <td>{result.pythonScriptIncluded ? 'OK' : '-'}</td>
                    <td>
                      {result.hallucinatedColumns.length === 0 ? (
                        <span className="lab-clean">0</span>
                      ) : (
                        <span className="lab-halluc">{result.hallucinatedColumns.length}</span>
                      )}
                    </td>
                    <td><strong>{typeof result.compositeScore === 'number' ? result.compositeScore.toFixed(3) : '-'}</strong></td>
                    <td>
                      <span className={`lab-evidence lab-evidence-${result.evidenceStatus}`}>
                        {evidenceLabel[result.evidenceStatus]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* D3 Charts */}
      {showCharts && completedResults.length > 0 && (
        <section className="lab-section">
          <div className="section-header">
            <h3>Visualización</h3>
          </div>
          <div className="lab-charts-grid">
            <div className="lab-chart-card">
              <h4>Score Compuesto por Modelo</h4>
              <ScoreBarChart results={completedResults} />
            </div>
            <div className="lab-chart-card">
              <h4>Alucinaciones y claims</h4>
              <HallucinationChart results={completedResults} />
            </div>
            <div className="lab-chart-card">
              <h4>Latencia vs Score</h4>
              <ScatterPlot results={completedResults} />
            </div>
            <div className="lab-chart-card">
              <h4>Latencia por modelo</h4>
              <LatencyChart results={completedResults} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default BenchmarkLab;
