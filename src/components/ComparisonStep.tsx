import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Cloud, Cpu, Play, ShieldCheck } from 'lucide-react';
import { AIConfig, AuditExecutionEvidence, AuditReport, BenchmarkResult } from '../types';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { runBenchmarkForConfig } from '../services/benchmarkService';
import { createImprovementRun } from '../services/improvementService';

interface ComparisonStepProps {
  report: AuditReport;
  config: AIConfig;
  originalData: Record<string, any>[];
  fields: string[];
  delimiter: string;
  fileName?: string;
  auditEvidence?: AuditExecutionEvidence;
  cleaningScript?: string;
  onBenchmarkResultsChange?: (results: BenchmarkResult[]) => void;
  onImprovementRun?: (run: ReturnType<typeof createImprovementRun>) => void;
  onLog?: (stage: string, msg: string) => void;
}

const evidenceLabel: Record<BenchmarkResult['evidenceStatus'], string> = {
  planned: 'Plan',
  attempted_failed: 'Inválida',
  preliminary_valid: 'Preliminar',
  formal_valid: 'Formal',
};

const statusLabel: Record<BenchmarkResult['status'], string> = {
  pending: 'Pendiente',
  running: 'Ejecutando',
  completed: 'Completado',
  error: 'Error',
  unavailable: 'No disponible',
};

const currentProviderName = (config: AIConfig) => {
  if (config.providerType === 'local') return 'WebLLM local';
  if (config.providerType === 'chrome') return 'Chrome AI';
  return config.cloudProvider || 'Cloud';
};

const ComparisonStep: React.FC<ComparisonStepProps> = ({
  report,
  config,
  originalData,
  fields,
  delimiter,
  fileName,
  auditEvidence,
  cleaningScript,
  onBenchmarkResultsChange,
  onImprovementRun,
  onLog,
}) => {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const cloudModel = useMemo(() => {
    if (config.providerType === 'cloud') return config.model;
    return AVAILABLE_MODELS.cloud.find((model) => model.provider.toLowerCase() === config.cloudProvider)?.id
      || AVAILABLE_MODELS.cloud[0]?.id
      || config.model;
  }, [config]);

  const localModel = config.providerType === 'local' ? config.model : AVAILABLE_MODELS.local[0]?.id || config.model;

  const publishResults = (nextResults: BenchmarkResult[]) => {
    setResults(nextResults);
    onBenchmarkResultsChange?.(nextResults);
  };

  const appendResult = (result: BenchmarkResult) => {
    setResults((prev) => {
      const next = [result, ...prev];
      onBenchmarkResultsChange?.(next);
      return next;
    });
  };

  const runOne = async (runConfig: AIConfig, inputMode: BenchmarkResult['inputMode'] = 'smart_sample') => {
    onLog?.('comparison.run', `${runConfig.providerType} · ${runConfig.model} · ${inputMode}`);
    const result = await runBenchmarkForConfig(report, runConfig, inputMode, (event) => {
      onLog?.(event.stage, `${runConfig.providerType} · ${event.elapsedMs}ms`);
    });
    appendResult(result);
    onLog?.(
      result.status === 'completed' ? 'comparison.done' : 'comparison.warn',
      `${result.providerType} · ${result.evidenceStatus}`
    );
    return result;
  };

  const runCurrent = async () => {
    setIsRunning(true);
    try {
      await runOne(config);
    } finally {
      setIsRunning(false);
    }
  };

  const runLocalCloud = async () => {
    setIsRunning(true);
    try {
      const nextResults: BenchmarkResult[] = [];
      const localConfig: AIConfig = { ...config, providerType: 'webllm_experimental', model: localModel, cloudProvider: undefined };
      nextResults.push(await runBenchmarkForConfig(report, localConfig, 'smart_sample'));

      if (config.apiKey) {
        const cloudConfig: AIConfig = {
          ...config,
          providerType: 'cloud',
          model: cloudModel,
          cloudProvider: (config.cloudProvider || AVAILABLE_MODELS.cloud[0]?.provider.toLowerCase()) as AIConfig['cloudProvider'],
        };
        nextResults.push(await runBenchmarkForConfig(report, cloudConfig, 'smart_sample'));
      }

      const merged = [...nextResults.reverse(), ...results];
      publishResults(merged);
      onLog?.('comparison.done', `${nextResults.length} corridas registradas`);
    } finally {
      setIsRunning(false);
    }
  };

  const simulateImprovement = () => {
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
    onLog?.('comparison.improvement', `${run.healthDelta?.scoreDelta ?? 0} puntos de delta simulado`);
  };

  const validResults = results.filter((result) => result.evidenceStatus !== 'attempted_failed');
  const failedResults = results.filter((result) => result.evidenceStatus === 'attempted_failed');

  return (
    <section className="section" aria-labelledby="comparison-title">
      <header className="section-header">
        <div>
          <p className="sec-eye">comparación de modelos</p>
          <h2 id="comparison-title" className="sec-title">Comparar antes de aprobar.</h2>
        </div>
      </header>

      <p className="section-note">
        Todas las corridas usan el mismo AuditReport generado por el motor determinista. AURA registra intentos
        fallidos, alucinaciones, cumplimiento de formato y validez del script antes de pasar a revisión humana.
      </p>

      <div className="benchmark-protocol mt-6">
        <div>
          <span>base factual</span>
          <strong>{report.issues.length} hallazgos · score {report.score}/100</strong>
        </div>
        <div>
          <span>proveedor actual</span>
          <strong>{currentProviderName(config)} · {config.model}</strong>
        </div>
        <div>
          <span>estado</span>
          <strong>{validResults.length} útiles · {failedResults.length} inválidas · {results.length} total</strong>
        </div>
      </div>

      <div className="benchmark-grid mt-8">
        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Activity size={18} /></span>
            <div>
              <h3>Corrida actual</h3>
              <p>Evalúa el modelo seleccionado con smart sample, script y controles anti-alucinación.</p>
            </div>
          </div>
          <button className="primary w-full" disabled={isRunning} onClick={runCurrent}>
            <Play size={14} /> {isRunning ? 'Ejecutando' : 'Ejecutar modelo actual'}
          </button>
        </div>

        <div className="benchmark-card">
          <div className="benchmark-head">
            <span className="benchmark-icon"><Cpu size={18} /></span>
            <div>
              <h3>Local vs cloud</h3>
              <p>Contrasta privacidad y rendimiento cuando hay credencial cloud disponible.</p>
            </div>
          </div>
          <button className="secondary w-full" disabled={isRunning} onClick={runLocalCloud}>
            <Cloud size={14} /> Comparar rutas
          </button>
        </div>

        <div className="benchmark-card benchmark-card-strong">
          <div className="benchmark-head">
            <span className="benchmark-icon"><ShieldCheck size={18} /></span>
            <div>
              <h3>Delta de mejora</h3>
              <p>Simula remediación segura con el script disponible y conserva trazabilidad.</p>
            </div>
          </div>
          <button
            className="primary w-full"
            disabled={!originalData.length || !cleaningScript || isRunning}
            onClick={simulateImprovement}
            title={!cleaningScript ? 'Genera un script de limpieza antes de simular mejora' : 'Simular mejora con el script generado'}
          >
            <ShieldCheck size={14} /> Simular mejora
          </button>
        </div>
      </div>

      <div className="benchmark-table-wrap mt-6">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Modelo</th>
              <th>Estado</th>
              <th>Latencia</th>
              <th>Contrato</th>
              <th>Script</th>
              <th>Evidencia</th>
              <th>Alucinación columnas</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={8} className="benchmark-empty">
                  Sin corridas. Puedes continuar a revisión, pero OE4 queda sin evidencia comparativa.
                </td>
              </tr>
            )}
            {results.map((result) => (
              <tr key={result.id}>
                <td>
                  <strong>{result.provider}</strong>
                  <span>{result.providerType}</span>
                </td>
                <td>{result.model}</td>
                <td>
                  <span className={`benchmark-status benchmark-status-${result.status}`}>
                    {result.status === 'completed' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {statusLabel[result.status]}
                  </span>
                  {result.error && <small>{result.error}</small>}
                </td>
                <td>{result.latencyMs ? `${result.latencyMs}ms` : '-'}</td>
                <td>{(result.contractCompliance ?? result.formatCompliance) ? 'OK' : '-'}</td>
                <td>{result.pythonScriptIncluded ? 'OK' : '-'}</td>
                <td>{evidenceLabel[result.evidenceStatus]}</td>
                <td>{result.hallucinatedColumns.length ? result.hallucinatedColumns.join(', ') : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ComparisonStep;
