import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Cloud, Cpu, Fingerprint, Gauge, Layers3, Play, ShieldCheck } from 'lucide-react';
import { AIConfig, AuditExecutionEvidence, AuditReport, BenchmarkResult } from '../types';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { runBenchmarkForConfig } from '../services/benchmarkService';
import { createImprovementRun } from '../services/improvementService';

interface BenchmarkPanelProps {
  report: AuditReport;
  config: AIConfig;
  originalData?: Record<string, any>[];
  fields?: string[];
  delimiter?: string;
  fileName?: string;
  auditEvidence?: AuditExecutionEvidence;
  cleaningScript?: string;
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

const elapsedFrom = (startedAt?: string) => {
  if (!startedAt) return '-';
  return `${Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))}s`;
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
  onImprovementRun,
  onLog
}) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [, setClockTick] = useState(0);
  const [selectedLocalModel, setSelectedLocalModel] = useState(
    config.providerType === 'local' ? config.model : AVAILABLE_MODELS.local[0].id
  );
  const [selectedCloudModel, setSelectedCloudModel] = useState(
    config.providerType === 'cloud' ? config.model : AVAILABLE_MODELS.cloud[0].id
  );

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

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

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

        const result = await runBenchmarkForConfig(report, runConfig, inputMode);
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

  const runSuite = async (suite: 'local' | 'cloud' | 'both' | 'all') => {
    if (suite === 'all') {
      const localConfigs = AVAILABLE_MODELS.local.map(model => ({ ...config, providerType: 'local' as const, model: model.id }));
      const cloudConfigs = AVAILABLE_MODELS.cloud.map(model => ({ ...config, providerType: 'cloud' as const, model: model.id }));
      await runConfigs([...localConfigs, ...cloudConfigs]);
      return;
    }

    const configs = suite === 'both' ? [localConfig, cloudConfig] : suite === 'local' ? [localConfig] : [cloudConfig];
    await runConfigs(configs);
  };

  const latestLocal = results.find(result => result.providerType === 'local' && result.status === 'completed');
  const latestCloud = results.find(result => result.providerType === 'cloud' && result.status === 'completed');

  return (
    <section aria-labelledby="benchmark-title" className="mt-12">
      <div className="section-title">
        <div>
          <p className="eyebrow">Benchmark Experimental</p>
          <h2 id="benchmark-title">Local vs Cloud</h2>
        </div>
        <p>Ejecuta el mismo reporte determinista contra WebLLM local y Gemini cloud, comparando smart sample contra prompt libre para medir señales de alucinación.</p>
      </div>

      <div className="benchmark-grid mt-8">
        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Cpu size={18} /></span>
            <div>
              <h3>Capa 0 Local</h3>
              <p>WebLLM/WebGPU como proveedor principal.</p>
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

        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Cloud size={18} /></span>
            <div>
              <h3>Contraste Cloud</h3>
              <p>Gemini se usa como referencia secundaria.</p>
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
              {AVAILABLE_MODELS.cloud.map(model => (
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

        <div className="benchmark-card benchmark-card-strong">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Gauge size={18} /></span>
            <div>
              <h3>Suite Comparativa</h3>
              <p>Dos infraestructuras y dos modos de entrada.</p>
            </div>
          </div>
          <div className="benchmark-metric">
            <span>Banco de modelos</span>
            <strong>{AVAILABLE_MODELS.local.length} locales · {AVAILABLE_MODELS.cloud.length} cloud</strong>
          </div>
          <div className="benchmark-metric">
            <span>Base factual</span>
            <strong>{report.issues.length} hallazgos · {report.score}/100</strong>
          </div>
          <button className="primary w-full" disabled={isRunning} onClick={() => runSuite('both')}>
            <Activity size={14} /> Ejecutar Comparativo
          </button>
          <button className="secondary w-full" disabled={isRunning} onClick={() => runSuite('all')}>
            <Layers3 size={14} /> Probar todos los LLM
          </button>
          <button className="secondary w-full" disabled={isRunning || results.length === 0 || !originalData.length} onClick={buildImprovementRun}>
            <ShieldCheck size={14} /> Simular mejora
          </button>
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
      {results.length > 0 && (
        <div className="benchmark-trace-list">
          {results.map((result) => (
            <details key={`trace-${result.id}`} className="execution-trace">
              <summary>
                <Fingerprint size={13} /> {result.provider} · {result.inputMode} · {result.datasetFingerprint || auditEvidence?.datasetFingerprint || 'sin-fingerprint'}
              </summary>
              <ol>
                {(result.executionTrace || []).map((event) => (
                  <li key={`${result.id}-${event.stage}-${event.elapsedMs}`}>
                    <span>{event.elapsedMs}ms</span>
                    <strong>{event.stage}</strong>
                    {event.details && <code>{JSON.stringify(event.details)}</code>}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}
    </section>
  );
};

export default BenchmarkPanel;
