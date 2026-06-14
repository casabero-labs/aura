import React, { useEffect, useMemo, useState } from 'react';
import { Activity, FlaskConical, ArrowLeft, Play, BarChart3, Database, FileJson, Gauge, ShieldAlert } from 'lucide-react';
import { AuditReport, AIConfig, BenchmarkResult, AuditExecutionEvidence, DeterministicValidationReport, ExecutionTraceEvent } from '../types';
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

const inputModeLabel: Record<BenchmarkResult['inputMode'], string> = {
  smart_sample: 'Contrato AURA',
  prompt_libre: 'Prompt libre'
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

const explainMetric = {
  latency: 'Tiempo total de la llamada medida por el proveedor: diagnóstico + script en contrato AURA, o respuesta única en prompt libre.',
  tokens: 'tokens/s = tokens generados / segundos de latencia. Es una aproximación de rendimiento reportada por el proveedor.',
  json: 'JSON/Contrato indica si la salida cumplió la estructura esperada del contrato AURA.',
  script: 'Script indica si la salida incluyó código Python/Pandas verificable para limpieza asistida.',
  hallucination: 'Alucinación cuenta columnas mencionadas por el modelo que no existen en el perfil determinista del dataset.',
  score: 'Score compuesto ponderado: formato 25%, cero alucinaciones 25%, latencia 15%, tokens/s 10%, script 10%, claims soportados 15%.',
};

const BenchmarkLab: React.FC<BenchmarkLabProps> = ({
  report,
  rawData,
  csvFields,
  csvDelimiter,
  fileName,
  aiConfig,
  auditEvidence,
  deterministicValidation,
  onResultsChange,
  onBack
}) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'local' | 'cloud'>(aiConfig.providerType === 'cloud' && aiConfig.apiKey ? 'cloud' : 'local');
  const [selectedModel, setSelectedModel] = useState(aiConfig.model || AVAILABLE_MODELS.local[0]?.id || '');
  const [selectedInputMode, setSelectedInputMode] = useState<BenchmarkResult['inputMode']>('smart_sample');
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  const cloudModels = aiConfig.cloudProvider
    ? AVAILABLE_MODELS.cloud.filter(m => m.provider.toLowerCase() === aiConfig.cloudProvider)
    : AVAILABLE_MODELS.cloud;

  const providerModels = selectedProvider === 'local' ? AVAILABLE_MODELS.local : cloudModels;
  const completedResults = results.filter(r => r.status === 'completed');
  const stats = completedResults.length > 0 ? experimentStats(completedResults) : { mean: 0, stdDev: 0, cv: 0 };
  const activeRun = results.find((result) => result.id === runningId);

  useEffect(() => {
    const models = selectedProvider === 'local' ? AVAILABLE_MODELS.local : cloudModels;
    if (!models.some((model) => model.id === selectedModel)) {
      setSelectedModel(models[0]?.id || '');
    }
  }, [cloudModels, selectedModel, selectedProvider]);

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
    inputMode: 'smart_sample' | 'prompt_libre'
  ) => {
    const runConfig: AIConfig = {
      ...aiConfig,
      providerType,
      model: modelId,
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
      temperature: aiConfig.temperature || 0.7,
      status: 'running',
      latencyMs: 0,
      firstTokenMs: 0,
      tokensGenerated: 0,
      tokensPerSecond: 0,
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
    addLog(`inicia ${providerType} · ${modelId} · ${inputModeLabel[inputMode]}`);

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
    await runSingleBenchmark(selectedProvider, selectedModel, selectedInputMode);
    setIsRunning(false);
    setShowCharts(true);
  };

  const runControlledPair = async () => {
    if (!selectedModel) return;
    setIsRunning(true);
    for (const inputMode of ['smart_sample', 'prompt_libre'] as const) {
      await runSingleBenchmark(selectedProvider, selectedModel, inputMode);
    }
    setIsRunning(false);
    setShowCharts(true);
  };

  const runComparison = async () => {
    setIsRunning(true);
    const localFirst = selectedProvider === 'local'
      ? AVAILABLE_MODELS.local.find(model => model.id === selectedModel) || AVAILABLE_MODELS.local[0]
      : AVAILABLE_MODELS.local[0];
    const cloudFirst = selectedProvider === 'cloud'
      ? cloudModels.find(model => model.id === selectedModel) || cloudModels[0]
      : cloudModels[0];

    if (localFirst) {
      await runSingleBenchmark('local', localFirst.id, 'smart_sample');
    }

    if (cloudFirst && aiConfig.apiKey) {
      await runSingleBenchmark('cloud', cloudFirst.id, 'smart_sample');
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
            <h1>Laboratorio experimental</h1>
            <p>
              Compara modelos LLM usando el mismo dataset ya perfilado en el flujo principal. No carga otro archivo:
              usa el AuditReport determinista, el contrato AURA y el fingerprint de esta sesión.
            </p>
          </div>
        </div>
      </header>

      <section className="lab-section">
        <div className="lab-protocol-card">
          <div>
            <p className="sec-eye">protocolo experimental</p>
            <h2>Qué se ejecuta en este laboratorio.</h2>
            <p>
              Cada corrida envía al modelo el paquete estructurado del perfil determinista. En `Contrato AURA`
              se genera diagnóstico y luego script; en `Prompt libre` se mide una respuesta menos controlada para contrastar.
            </p>
          </div>
          <div className="lab-protocol-grid">
            <div><span>dataset</span><strong>{fileName || 'dataset actual'}</strong></div>
            <div><span>fingerprint</span><strong>{auditEvidence?.datasetFingerprint || 'sin fingerprint'}</strong></div>
            <div><span>filas / columnas</span><strong>{report.rowCount.toLocaleString('es-CO')} / {report.colCount}</strong></div>
            <div><span>reglas activadas</span><strong>{report.issues.length} · score {report.score}/100</strong></div>
          </div>
        </div>
      </section>

      <section className="lab-section">
        <div className="lab-runner">
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
              <select value={selectedInputMode} disabled={isRunning} onChange={(event) => setSelectedInputMode(event.target.value as BenchmarkResult['inputMode'])}>
                <option value="smart_sample">Contrato AURA</option>
                <option value="prompt_libre">Prompt libre</option>
              </select>
            </label>
          </div>
          <div className="lab-runner-actions">
            <button className="btn-p" onClick={runSelected} disabled={isRunning || !selectedModel}>
              <Play size={14} /> {isRunning ? 'Ejecutando' : 'Ejecutar corrida'}
            </button>
            <button className="btn-s" onClick={runControlledPair} disabled={isRunning || !selectedModel}>
              <Activity size={14} /> Comparar contrato vs libre
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
                <span className="terminal-log-elapsed">0ms</span>
                <code className="terminal-log-meta">Selecciona proveedor, modelo y entrada para iniciar una corrida.</code>
              </div>
            ) : logs.map((log, index) => (
              <div className="terminal-log-row" key={`${log.time}-${index}`}>
                <span className="terminal-log-time">{log.time}</span>
                <strong className="terminal-log-stage">benchmark</strong>
                <span className="terminal-log-elapsed">live</span>
                <code className="terminal-log-meta">{log.msg}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Table */}
      <section className="lab-section">
        <div className="section-header">
          <h3>Resultados de Benchmark</h3>
          <span className="lab-count">{completedResults.length} corridas completadas</span>
        </div>

        {results.length > 0 && (
          <div className="benchmark-summary-strip">
            <div className="bss-item bss-item--experiments">
              <span className="bss-value">{results.length}</span>
              <span className="bss-label">corridas totales</span>
            </div>
            <div className="bss-item bss-item--formal">
              <span className="bss-value">{results.filter(r => r.evidenceStatus === 'formal_valid').length}</span>
              <span className="bss-label">evidencia formal</span>
            </div>
            <div className="bss-item bss-item--failed">
              <span className="bss-value">{results.filter(r => r.evidenceStatus === 'attempted_failed' || r.status === 'error').length}</span>
              <span className="bss-label">fallidas/error</span>
            </div>
            <div className="bss-item bss-item--best">
              <span className="bss-value">
                {completedResults.length > 0
                  ? Math.max(...completedResults.map(r => r.compositeScore ?? 0)).toFixed(2)
                  : '—'
                }
              </span>
              <span className="bss-label">mejor score</span>
            </div>
            <div className="bss-item bss-item--ground-truth">
              <span className="bss-value">{deterministicValidation?.groundTruthMatched ? 'Sí' : 'No'}</span>
              <span className="bss-label">ground truth</span>
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
                <th>Estado</th>
                <th>Latencia</th>
                <th>Tokens/s</th>
                <th>JSON</th>
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
                    Sin ejecuciones. Inicia una corrida para producir evidencia experimental.
                  </td>
                </tr>
              )}
              {results.map(result => (
                <tr key={result.id} className={result.status === 'running' ? 'lab-running' : ''}>
                  <td>
                    <strong>{result.provider}</strong>
                  </td>
                  <td>{result.model}</td>
                  <td>{inputModeLabel[result.inputMode]}</td>
                  <td>
                    <span className={`lab-status lab-status-${result.status}`}>
                      {result.status === 'running' && <Activity size={12} />}
                      {result.status === 'completed' && <BarChart3 size={12} />}
                      {statusLabel[result.status]}
                    </span>
                    {result.error && <small className="lab-error">{result.error}</small>}
                  </td>
                  <td>{result.latencyMs ? `${result.latencyMs}ms` : '-'}</td>
                  <td>{result.tokensPerSecond || '-'}</td>
                  <td>{result.formatCompliance ? 'OK' : '-'}</td>
                  <td>{result.pythonScriptIncluded ? 'OK' : '-'}</td>
                  <td>
                    {result.hallucinatedColumns.length === 0 ? (
                      <span className="lab-clean">0</span>
                    ) : (
                      <span className="lab-halluc">{result.hallucinatedColumns.length}</span>
                    )}
                  </td>
                  <td>{typeof result.compositeScore === 'number' ? result.compositeScore.toFixed(2) : '-'}</td>
                  <td>
                    <span className={`lab-evidence lab-evidence-${result.evidenceStatus}`}>
                      {evidenceLabel[result.evidenceStatus]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lab-section">
        <div className="lab-glossary">
          <div><Database size={14} /><strong>Entrada</strong><p>Contrato AURA usa perfil determinista; Prompt libre usa solo esquema mínimo para comparar control vs libertad.</p></div>
          <div><Activity size={14} /><strong>Latencia / tokens/s</strong><p>{explainMetric.latency} {explainMetric.tokens}</p></div>
          <div><FileJson size={14} /><strong>JSON y Script</strong><p>{explainMetric.json} {explainMetric.script}</p></div>
          <div><ShieldAlert size={14} /><strong>Alucinación</strong><p>{explainMetric.hallucination}</p></div>
          <div><Gauge size={14} /><strong>Score</strong><p>{explainMetric.score}</p></div>
          <div><BarChart3 size={14} /><strong>Media / DE / CV</strong><p>Calculadas sobre el score compuesto de corridas completadas: media, desviación estándar y coeficiente de variación.</p></div>
        </div>
      </section>

      {completedResults.length > 0 && (
        <section className="lab-section">
          <div className="lab-stats-grid">
            <div><span>media score</span><strong>{stats.mean.toFixed(4)}</strong></div>
            <div><span>desviación estándar</span><strong>{stats.stdDev.toFixed(4)}</strong></div>
            <div><span>CV</span><strong>{(stats.cv * 100).toFixed(2)}%</strong></div>
          </div>
        </section>
      )}

      {/* D3 Charts */}
      {showCharts && completedResults.length > 0 && (
        <section className="lab-section">
          <div className="section-header">
            <div>
              <h3>Visualización de Métricas</h3>
              <p className="section-note">Estas gráficas son exploratorias: sirven para comparar corridas, no para reemplazar la matriz trazable.</p>
            </div>
          </div>
          <div className="lab-charts-grid">
            <div className="lab-chart-card">
              <h4>Score Compuesto por Modelo</h4>
              <ScoreBarChart results={completedResults} />
            </div>
            <div className="lab-chart-card">
              <h4>Alucinaciones y claims sin soporte</h4>
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
