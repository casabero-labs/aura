import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Cloud, Cpu, Gauge, Layers3, Play, ShieldCheck } from 'lucide-react';
import { AIConfig, AuditExecutionEvidence, AuditReport, BenchmarkResult, ExecutionTraceEvent } from '../types';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { runBenchmarkForConfig } from '../services/benchmarkService';
import { createImprovementRun } from '../services/improvementService';
import { ScoreBarChart, RadarChart, ScatterPlot, HallucinationChart, LatencyChart } from './BenchmarkCharts';

interface BenchmarkPanelProps {
  report: AuditReport;
  config: AIConfig;
  originalData?: Record<string, any>[];
  fields?: string[];
  delimiter?: string;
  fileName?: string;
  auditEvidence?: AuditExecutionEvidence;
  cleaningScript?: string;
  onBenchmarkResultsChange?: (results: BenchmarkResult[]) => void;
  onImprovementRun?: (run: ReturnType<typeof createImprovementRun>) => void;
  onLog?: (bold: string, msg: string) => void;
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

const resultSummary = (results: BenchmarkResult[]) => {
  if (results.length === 0) {
    return 'Aun no hay corridas: el benchmark no ha producido evidencia para decidir.';
  }
  const valid = results.filter((result) => result.evidenceStatus !== 'attempted_failed').length;
  const failed = results.filter((result) => result.evidenceStatus === 'attempted_failed').length;
  return `${valid} corridas utiles · ${failed} intentos invalidos · ${results.length} registros trazables`;
};

const elapsedFrom = (startedAt?: string) => {
  if (!startedAt) return '-';
  return `${Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))}s`;
};

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString('es-CO', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const eventDetails = (event: ExecutionTraceEvent) => {
  if (!event.details) return '';
  return Object.entries(event.details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' · ');
};

const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({
  report,
  config,
  originalData = [],
  fields = [],
  delimiter = ',',
  fileName,
  auditEvidence,
  cleaningScript,
  onBenchmarkResultsChange,
  onImprovementRun,
  onLog
}) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [, setClockTick] = useState(0);
  const isCloudConfigured = !!config.apiKey;
  const isChromeConfigured = config.providerType === 'chrome';
  const configuredCount = 1 + (isCloudConfigured ? 1 : 0) + (isChromeConfigured ? 1 : 0);

  const cloudModels = useMemo(() => {
    if (!config.cloudProvider) return AVAILABLE_MODELS.cloud;
    return AVAILABLE_MODELS.cloud.filter(m => m.provider.toLowerCase() === config.cloudProvider);
  }, [config.cloudProvider]);

  const [selectedLocalModel, setSelectedLocalModel] = useState(
    config.providerType === 'local' ? config.model : AVAILABLE_MODELS.local[0].id
  );
  const [selectedCloudModel, setSelectedCloudModel] = useState(
    config.providerType === 'cloud' ? config.model : (cloudModels[0]?.id || '')
  );
  const [selectedChromeModel, setSelectedChromeModel] = useState('gemini-nano');

  const cloudConfig = useMemo<AIConfig>(() => ({
    ...config,
    providerType: 'cloud',
    model: selectedCloudModel
  }), [config, selectedCloudModel]);

  const localConfig = useMemo<AIConfig>(() => ({
    ...config,
    providerType: 'local',
    model: selectedLocalModel
  }), [config, selectedLocalModel]);

  const chromeConfig = useMemo<AIConfig>(() => ({
    ...config,
    providerType: 'chrome',
    model: 'gemini-nano'
  }), [config]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    onBenchmarkResultsChange?.(results);
  }, [onBenchmarkResultsChange, results]);

  const runConfigs = async (configs: AIConfig[]) => {
    setIsRunning(true);

    for (const runConfig of configs) {
      const modes: BenchmarkResult['inputMode'][] = ['smart_sample', 'prompt_libre'];
      for (const inputMode of modes) {
        onLog?.('benchmark.run', `${runConfig.providerType} :: ${inputMode}`);
        const pending: BenchmarkResult = {
          id: `${runConfig.providerType}-${inputMode}-${runConfig.model}-${Date.now()}`,
          provider: runConfig.providerType === 'local' ? 'WebLLM' : 'Gemini',
          providerType: runConfig.providerType,
          inputMode,
          model: runConfig.model,
          temperature: runConfig.temperature || 0.7,
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
          executionTrace: [{
            stage: 'ui.benchmark.pending',
            timestamp: new Date().toISOString(),
            elapsedMs: 0,
            details: { providerType: runConfig.providerType, model: runConfig.model, inputMode }
          }],
          timestamp: new Date().toISOString()
        };
        setResults(prev => [pending, ...prev]);

        const result = await runBenchmarkForConfig(report, runConfig, inputMode, (event) => {
          setResults(prev => prev.map(item => item.id === pending.id
            ? { ...item, executionTrace: [...(item.executionTrace || []), event] }
            : item
          ));
          onLog?.(event.stage, eventDetails(event) || `${runConfig.providerType} :: ${inputMode}`);
        });
        setResults(prev => prev.map(item => item.id === pending.id ? result : item));
        onLog?.(
          result.status === 'completed' ? 'benchmark.done' : 'benchmark.warn',
          `${result.providerType} ${result.inputMode} · ${result.latencyMs || 0}ms`
        );
      }
    }

    setIsRunning(false);
  };

  const buildImprovementRun = () => {
    if (!originalData.length || !fields.length) return;
    const run = createImprovementRun({
      fileName,
      originalData,
      fields,
      delimiter,
      initialReport: report,
      auditEvidence,
      benchmarkResults: results,
      generatedScript: cleaningScript,
    });
    onImprovementRun?.(run);
    onLog?.('improvement.run', `${run.healthDelta?.scoreDelta ?? 0} puntos de mejora simulada`);
  };

  const runSuite = async (suite: 'local' | 'cloud' | 'chrome' | 'both' | 'all') => {
    if (suite === 'all') {
      const localConfigs = AVAILABLE_MODELS.local.map(model => ({ ...config, providerType: 'local' as const, model: model.id }));
      const cloudConfigs = isCloudConfigured ? cloudModels.map(model => ({ ...config, providerType: 'cloud' as const, model: model.id })) : [];
      const chromeConfigs = isChromeConfigured ? AVAILABLE_MODELS.chrome.map(model => ({ ...config, providerType: 'chrome' as const, model: model.id })) : [];
      await runConfigs([...localConfigs, ...cloudConfigs, ...chromeConfigs]);
      return;
    }

    if (suite === 'cloud' && !isCloudConfigured) return;
    if (suite === 'chrome' && !isChromeConfigured) return;

    const configs = suite === 'both' ? [localConfig, ...(isCloudConfigured ? [cloudConfig] : [])] : suite === 'local' ? [localConfig] : suite === 'chrome' ? [chromeConfig] : [cloudConfig];
    await runConfigs(configs);
  };

  const latestLocal = results.find(result => result.providerType === 'local' && result.status === 'completed');
  const latestCloud = results.find(result => result.providerType === 'cloud' && result.status === 'completed');
  const latestChrome = results.find(result => result.providerType === 'chrome' && result.status === 'completed');
  const activeRuns = results.filter(result => result.status === 'running');
  const traceRows = results.flatMap((result) =>
    (result.executionTrace || []).map((event) => ({ result, event }))
  );

  return (
    <section aria-labelledby="benchmark-title" className="mt-12">
      <div className="section-title">
        <div>
          <p className="eyebrow">Decision de estrategia</p>
          <h2 id="benchmark-title">Comparar antes de remediar</h2>
        </div>
        <p>
          Todas las corridas usan el mismo reporte determinista. AURA separa intentos fallidos, salidas validas,
          alucinaciones y scripts revisables antes de recomendar una ruta de limpieza.
        </p>
      </div>

      <div className="benchmark-protocol mt-6">
        <div>
          <span>base factual</span>
          <strong>{report.issues.length} hallazgos · score {report.score}/100</strong>
        </div>
        <div>
          <span>criterio</span>
          <strong>JSON valido · script HITL · cero columnas fantasma</strong>
        </div>
        <div>
          <span>estado</span>
          <strong>{resultSummary(results)}</strong>
        </div>
      </div>

      <div className="benchmark-grid mt-8">
        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Cpu size={18} /></span>
            <div>
              <h3>Ruta local</h3>
              <p>Privacidad primero. Si WebGPU o el modelo no arrancan, queda como intento inválido.</p>
            </div>
          </div>
          <div className="benchmark-metric">
            <span>Modelo</span>
            <select
              value={selectedLocalModel}
              onChange={(event) => setSelectedLocalModel(event.target.value)}
              className="benchmark-select"
              disabled={isRunning}
            >
              {AVAILABLE_MODELS.local.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          <div className="benchmark-metric">
            <span>Ultima latencia</span>
            <strong>{latestLocal ? `${latestLocal.latencyMs}ms` : '-'}</strong>
          </div>
          <button className="secondary w-full" disabled={isRunning} onClick={() => runSuite('local')}>
            <Play size={14} /> Ejecutar Local
          </button>
        </div>

        {isCloudConfigured && (
        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Cloud size={18} /></span>
            <div>
              <h3>Ruta cloud</h3>
              <p>{config.cloudProvider || 'Cloud'} sirve como contraste de disponibilidad, latencia y calidad de salida.</p>
            </div>
          </div>
          <div className="benchmark-metric">
            <span>Modelo</span>
            <select
              value={selectedCloudModel}
              onChange={(event) => setSelectedCloudModel(event.target.value)}
              className="benchmark-select"
              disabled={isRunning}
            >
              {cloudModels.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          <div className="benchmark-metric">
            <span>Ultima latencia</span>
            <strong>{latestCloud ? `${latestCloud.latencyMs}ms` : '-'}</strong>
          </div>
          <button className="secondary w-full" disabled={isRunning} onClick={() => runSuite('cloud')}>
            <Play size={14} /> Ejecutar Cloud
          </button>
        </div>
        )}

        {isChromeConfigured && (
        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Cpu size={18} /></span>
            <div>
              <h3>Chrome AI</h3>
              <p>Gemini Nano integrado en el navegador.</p>
            </div>
          </div>
          <div className="benchmark-metric">
            <span>Modelo</span>
            <strong>Gemini Nano</strong>
          </div>
          <div className="benchmark-metric">
            <span>Ultima latencia</span>
            <strong>{latestChrome ? `${latestChrome.latencyMs}ms` : '-'}</strong>
          </div>
          <button className="secondary w-full" disabled={isRunning} onClick={() => runSuite('chrome')}>
            <Play size={14} /> Ejecutar Chrome AI
          </button>
        </div>
        )}

        {configuredCount >= 2 && (
        <div className="benchmark-card benchmark-card-strong">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Gauge size={18} /></span>
            <div>
              <h3>Comparativa controlada</h3>
              <p>{configuredCount} infraestructuras con smart sample y prompt libre sobre la misma evidencia.</p>
            </div>
          </div>
          <div className="benchmark-metric">
            <span>Banco de modelos</span>
            <strong>{AVAILABLE_MODELS.local.length} locales · {cloudModels.length} cloud · {isChromeConfigured ? 1 : 0} Chrome</strong>
          </div>
          <div className="benchmark-metric">
            <span>Base factual</span>
            <strong>{report.issues.length} hallazgos · {report.score}/100</strong>
          </div>
          <button className="primary w-full" disabled={isRunning} onClick={() => runSuite('both')}>
            <Activity size={14} /> Ejecutar Comparativo
          </button>
          {configuredCount >= 3 && (
          <button className="secondary w-full" disabled={isRunning} onClick={() => runSuite('all')}>
            <Layers3 size={14} /> Probar todos los LLM
          </button>
          )}
        </div>
        )}
      </div>

      <div className="benchmark-close mt-6">
        <div>
          <p className="eyebrow">Cierre del ciclo</p>
          <h3>Simulacion segura y re-auditoria</h3>
          <p>
            Usa el diagnostico determinista, las corridas disponibles y el script aprobado si existe.
            Si un proveedor falla, queda como intento invalido y aun puedes medir una mejora simulada con acciones deterministas seguras.
          </p>
        </div>
        <button className="primary" disabled={isRunning || !originalData.length} onClick={buildImprovementRun}>
          <ShieldCheck size={14} /> Simular mejora
        </button>
      </div>

      <div className="live-trace-panel mt-6" aria-label="Log visible del benchmark">
        <div className="live-trace-head">
          <span>tail -f aura.benchmark.log</span>
          <code>{auditEvidence?.datasetFingerprint || 'sin-fingerprint'}</code>
        </div>
        <div className="terminal-log" role="log" aria-live="polite">
          {activeRuns.map((result) => (
            <div className="terminal-log-row terminal-log-row-active" key={`active-${result.id}`}>
              <span className="terminal-log-time">{elapsedFrom(result.startedAt)}</span>
              <strong className="terminal-log-stage">benchmark.running</strong>
              <span className="terminal-log-elapsed">live</span>
              <code className="terminal-log-meta">
                provider={result.providerType} · model={result.model} · input={result.inputMode}
              </code>
            </div>
          ))}
          {traceRows.length === 0 && activeRuns.length === 0 && (
            <div className="terminal-log-row">
              <span className="terminal-log-time">--:--:--</span>
              <strong className="terminal-log-stage">benchmark.idle</strong>
              <span className="terminal-log-elapsed">0ms</span>
              <code className="terminal-log-meta">Esperando ejecucion local, cloud o comparativa.</code>
            </div>
          )}
          {traceRows.map(({ result, event }) => (
            <div className="terminal-log-row" key={`${result.id}-${event.stage}-${event.elapsedMs}`}>
              <span className="terminal-log-time">{timeLabel(event.timestamp)}</span>
              <strong className="terminal-log-stage">{event.stage}</strong>
              <span className="terminal-log-elapsed">{event.elapsedMs}ms</span>
              <code className="terminal-log-meta">
                {result.providerType}/{result.inputMode} · {eventDetails(event) || result.evidenceStatus}
              </code>
            </div>
          ))}
        </div>
      </div>

      <div className="benchmark-table-wrap mt-6">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Entrada</th>
              <th>Estado</th>
              <th>Latencia</th>
              <th>Activo</th>
              <th>Tokens/s</th>
              <th>JSON</th>
              <th>Script HITL</th>
              <th>Evidencia</th>
              <th>Alucinación columnas</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={10} className="benchmark-empty">Sin ejecuciones. Corre primero el benchmark local, cloud o comparativo.</td>
              </tr>
            )}
            {results.map(result => (
              <tr key={result.id}>
                <td>
                  <strong>{result.provider}</strong>
                  <span>{result.model}</span>
                </td>
                <td>{result.inputMode === 'smart_sample' ? 'Smart sample' : 'Prompt libre'}</td>
                <td>
                  <span className={`benchmark-status benchmark-status-${result.status}`}>
                    {result.status === 'completed' ? <CheckCircle2 size={13} /> : result.status === 'running' ? <Activity size={13} /> : <AlertTriangle size={13} />}
                    {statusLabel[result.status]}
                  </span>
                  {result.error && <small>{result.error}</small>}
                </td>
                <td>{result.latencyMs ? `${result.latencyMs}ms` : '-'}</td>
                <td>{result.status === 'running' ? elapsedFrom(result.startedAt) : result.completedAt ? 'cerrado' : '-'}</td>
                <td>{result.tokensPerSecond || '-'}</td>
                <td>{result.formatCompliance ? 'OK' : '-'}</td>
                <td>{result.pythonScriptIncluded ? 'OK' : '-'}</td>
                <td>{evidenceLabel[result.evidenceStatus]}</td>
                <td>
                  {result.hallucinatedColumns.length === 0 ? (
                    <span className="benchmark-clean"><ShieldCheck size={13} /> 0</span>
                  ) : (
                    result.hallucinatedColumns.join(', ')
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.filter(r => r.status === 'completed').length > 0 && (
        <div className="benchmark-charts mt-8">
          <div className="benchmark-charts-head">
            <p className="eyebrow">Análisis Visual de Métricas</p>
            <h3>Resultados del Benchmark</h3>
          </div>
          <div className="benchmark-charts-grid">
            <div className="benchmark-chart-card">
              <h4 className="benchmark-chart-title">Score Compuesto por Modelo</h4>
              <ScoreBarChart results={results.filter(r => r.status === 'completed')} />
            </div>
            <div className="benchmark-chart-card">
              <h4 className="benchmark-chart-title">Perfil Multi-Dimensional</h4>
              <RadarChart results={results.filter(r => r.status === 'completed')} />
            </div>
            <div className="benchmark-chart-card">
              <h4 className="benchmark-chart-title">Latencia vs Score</h4>
              <ScatterPlot results={results.filter(r => r.status === 'completed')} />
            </div>
            <div className="benchmark-chart-card">
              <h4 className="benchmark-chart-title">Alucinaciones y Claims sin Soporte</h4>
              <HallucinationChart results={results.filter(r => r.status === 'completed')} />
            </div>
            <div className="benchmark-chart-card benchmark-chart-card-full">
              <h4 className="benchmark-chart-title">Latencia por Modelo (↓ mejor)</h4>
              <LatencyChart results={results.filter(r => r.status === 'completed')} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BenchmarkPanel;
