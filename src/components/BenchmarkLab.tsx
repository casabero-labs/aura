import React, { useState } from 'react';
import { Activity, FlaskConical, X, Play, BarChart3 } from 'lucide-react';
import { AuditReport, AIConfig, BenchmarkResult, AuditExecutionEvidence } from '../types';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { runBenchmarkForConfig } from '../services/benchmarkService';
import { compositeScore } from '../services/benchmark/evaluationService';
import { ExperimentDesigner } from './ExperimentDesigner';
import { ScoreBarChart, RadarChart, ScatterPlot } from './BenchmarkCharts';

interface BenchmarkLabProps {
  report: AuditReport;
  rawData: Record<string, any>[];
  csvFields: string[];
  csvDelimiter: string;
  fileName?: string;
  aiConfig: AIConfig;
  auditEvidence?: AuditExecutionEvidence;
  onClose: () => void;
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

const BenchmarkLab: React.FC<BenchmarkLabProps> = ({
  report,
  rawData,
  csvFields,
  csvDelimiter,
  fileName,
  aiConfig,
  auditEvidence,
  onClose
}) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);

  const cloudModels = aiConfig.cloudProvider
    ? AVAILABLE_MODELS.cloud.filter(m => m.provider.toLowerCase() === aiConfig.cloudProvider)
    : AVAILABLE_MODELS.cloud;

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

    try {
      const result = await runBenchmarkForConfig(report, runConfig, inputMode);
      const maxLat = Math.max(...results.map(r => r.latencyMs), result.latencyMs, 1000);
      result.compositeScore = compositeScore(result, undefined, maxLat);
      setResults(prev => prev.map(r => r.id === pendingId ? result : r));
      return result;
    } catch (err) {
      const errorResult: BenchmarkResult = {
        ...pending,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        completedAt: new Date().toISOString()
      };
      setResults(prev => prev.map(r => r.id === pendingId ? errorResult : r));
      return errorResult;
    } finally {
      setRunningId(null);
    }
  };

  const runAllLocalModels = async () => {
    setIsRunning(true);
    for (const model of AVAILABLE_MODELS.local) {
      for (const inputMode of ['smart_sample', 'prompt_libre'] as const) {
        await runSingleBenchmark('local', model.id, inputMode);
      }
    }
    setIsRunning(false);
    setShowCharts(true);
  };

  const runAllCloudModels = async () => {
    if (!aiConfig.apiKey) return;
    setIsRunning(true);
    for (const model of cloudModels) {
      for (const inputMode of ['smart_sample', 'prompt_libre'] as const) {
        await runSingleBenchmark('cloud', model.id, inputMode);
      }
    }
    setIsRunning(false);
    setShowCharts(true);
  };

  const runComparison = async () => {
    setIsRunning(true);
    const localFirst = AVAILABLE_MODELS.local[0];
    const cloudFirst = cloudModels[0];

    if (localFirst) {
      for (const inputMode of ['smart_sample', 'prompt_libre'] as const) {
        await runSingleBenchmark('local', localFirst.id, inputMode);
      }
    }

    if (cloudFirst && aiConfig.apiKey) {
      for (const inputMode of ['smart_sample', 'prompt_libre'] as const) {
        await runSingleBenchmark('cloud', cloudFirst.id, inputMode);
      }
    }
    setIsRunning(false);
    setShowCharts(true);
  };

  const completedResults = results.filter(r => r.status === 'completed');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="lab-panel">
        {/* Header */}
        <div className="section section-header">
          <div className="sec-eye">
            <FlaskConical size={20} />
          </div>
          <div className="sec-title">
            <h2>Laboratorio de Benchmark</h2>
            <p>
              Modo científico experimental. Ejecuta comparativas multi-modelo sobre la misma evidencia
              determinista del pipeline principal. Los resultados son de solo lectura.
            </p>
          </div>
          <button className="btn-s" onClick={onClose} aria-label="Cerrar laboratorio">
            <X size={18} />
          </button>
        </div>

        {/* Experiment Designer */}
        <div className="section">
          <ExperimentDesigner report={report} config={aiConfig} />
        </div>

        {/* Quick Run Buttons */}
        <div className="section">
          <div className="lab-controls">
            <button
              className="btn-p"
              onClick={runAllLocalModels}
              disabled={isRunning}
            >
              <Activity size={14} />
              {isRunning && runningId ? 'Ejecutando...' : 'Benchmark Local'}
            </button>

            {aiConfig.apiKey && (
              <button
                className="btn-p"
                onClick={runAllCloudModels}
                disabled={isRunning}
              >
                <Activity size={14} />
                {isRunning ? 'Ejecutando...' : 'Benchmark Cloud'}
              </button>
            )}

            {aiConfig.apiKey && (
              <button
                className="btn-s"
                onClick={runComparison}
                disabled={isRunning}
              >
                <Play size={14} />
                Comparativa Local vs Cloud
              </button>
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="section">
          <div className="section-header">
            <h3>Resultados de Benchmark</h3>
            <span className="lab-count">{completedResults.length} corridas completadas</span>
          </div>
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
                  <th>Hallucinaciones</th>
                  <th>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && (
                  <tr>
                    <td colSpan={8} className="lab-empty">
                      Sin ejecuciones. Usa los botones de arriba para iniciar un benchmark.
                    </td>
                  </tr>
                )}
                {results.map(result => (
                  <tr key={result.id} className={result.status === 'running' ? 'lab-running' : ''}>
                    <td>
                      <strong>{result.provider}</strong>
                    </td>
                    <td>{result.model}</td>
                    <td>{result.inputMode === 'smart_sample' ? 'Smart' : 'Libre'}</td>
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
                    <td>
                      {result.hallucinatedColumns.length === 0 ? (
                        <span className="lab-clean">0</span>
                      ) : (
                        <span className="lab-halluc">{result.hallucinatedColumns.length}</span>
                      )}
                    </td>
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
        </div>

        {/* D3 Charts */}
        {showCharts && completedResults.length > 0 && (
          <div className="section">
            <div className="section-header">
              <h3>Visualización de Métricas</h3>
            </div>
            <div className="lab-charts-grid">
              <div className="lab-chart-card">
                <h4>Score Compuesto por Modelo</h4>
                <ScoreBarChart results={completedResults} />
              </div>
              <div className="lab-chart-card">
                <h4>Perfil Multi-Dimensional</h4>
                <RadarChart results={completedResults} />
              </div>
              <div className="lab-chart-card">
                <h4>Latencia vs Score</h4>
                <ScatterPlot results={completedResults} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BenchmarkLab;