import { useEffect, useState } from 'react';
import { AuditReport, AIConfig, BenchmarkResult } from '../types';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { runBenchmarkForConfig } from '../services/benchmarkService';
import { exportBenchmarkJson, experimentStats, compositeScore } from '../services/benchmark/evaluationService';
import { ScoreBarChart, RadarChart, ScatterPlot, HallucinationChart, LatencyChart } from './BenchmarkCharts';

interface ExperimentConfig {
  model: string;
  providerType: 'local' | 'cloud';
  temperature: number;
  inputMode: 'smart_sample' | 'prompt_libre';
}

interface ExperimentDesignerProps {
  report: AuditReport;
  config: AIConfig;
  onLog?: (bold: string, msg: string) => void;
  onResultsChange?: (results: BenchmarkResult[]) => void;
}

export const ExperimentDesigner = ({ report, config, onLog, onResultsChange }: ExperimentDesignerProps) => {
  const isCloudConfigured = !!config.apiKey;
  const availableProviders: ('local' | 'cloud')[] = isCloudConfigured ? ['local', 'cloud'] : ['local'];

  const cloudModels = config.cloudProvider
    ? AVAILABLE_MODELS.cloud.filter(m => m.provider.toLowerCase() === config.cloudProvider)
    : AVAILABLE_MODELS.cloud;

  const getModelsForProvider = (providerType: 'local' | 'cloud') =>
    providerType === 'local' ? AVAILABLE_MODELS.local : cloudModels;

  const defaultModel = availableProviders[0] === 'local'
    ? AVAILABLE_MODELS.local[0]?.id
    : (cloudModels[0]?.id || '');
  const defaultProvider = availableProviders[0];

  const [experiments, setExperiments] = useState<ExperimentConfig[]>([
    {
      model: config.model || defaultModel,
      providerType: config.providerType === 'cloud' && isCloudConfigured ? 'cloud' : defaultProvider,
      temperature: config.temperature || 0.7,
      inputMode: 'smart_sample'
    }
  ]);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  const addExperiment = () => {
    setExperiments(prev => [
      ...prev,
      {
        model: defaultModel,
        providerType: defaultProvider,
        temperature: 0.7,
        inputMode: 'smart_sample'
      }
    ]);
  };

  const removeExperiment = (index: number) => {
    if (index === 0) return;
    setExperiments(prev => prev.filter((_, i) => i !== index));
  };

  const updateExperiment = (index: number, field: keyof ExperimentConfig, value: any) => {
    setExperiments(prev => prev.map((exp, i) => {
      if (i !== index) return exp;
      const updated = { ...exp, [field]: value };
      if (field === 'providerType') {
        const models = getModelsForProvider(value as 'local' | 'cloud');
        updated.model = models[0]?.id || '';
      }
      return updated;
    }));
  };

  const runAllExperiments = async () => {
    const newResults: BenchmarkResult[] = [];
    setResults([]);
    
    for (let i = 0; i < experiments.length; i++) {
      setRunningIndex(i);
      onLog?.(`Ejecutando experimento ${i + 1}/${experiments.length}`, `Modelo: ${experiments[i].model}, Temp: ${experiments[i].temperature}`);
      
      const exp = experiments[i];
      const expConfig: AIConfig = {
        apiKey: config.apiKey,
        model: exp.model,
        temperature: exp.temperature,
        autoAnalyze: true,
        providerType: exp.providerType,
        cloudProvider: exp.providerType === 'cloud'
          ? (cloudModels.find(m => m.id === exp.model)?.provider?.toLowerCase() as any)
          : undefined
      };
      
      const result = await runBenchmarkForConfig(report, expConfig, exp.inputMode);
      const maxLatency = Math.max(...newResults.map(r => r.latencyMs), result.latencyMs, 1000);
      result.compositeScore = compositeScore(result, undefined, maxLatency);
      
      newResults.push(result);
      setResults([...newResults]);
    }
    
    setRunningIndex(null);
    onLog?.('Completado', `Se ejecutaron ${experiments.length} experimentos`);
  };

  const handleExportJson = () => {
    const json = exportBenchmarkJson(results);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onLog?.('Exportado', 'JSON de resultados descargado');
  };

  const completedResults = results.filter(r => r.status === 'completed');
  const stats = completedResults.length > 0 ? experimentStats(completedResults) : { mean: 0, stdDev: 0, cv: 0 };

  const currentModels = (providerType: 'local' | 'cloud') => 
    AVAILABLE_MODELS[providerType].map(m => ({ id: m.id, name: m.name }));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Diseñador de Experimentos</h2>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Configuraciones</h3>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Proveedor</th>
              <th style={styles.th}>Modelo</th>
              <th style={styles.th}>Temperatura</th>
              <th style={styles.th}>Input Mode</th>
              <th style={styles.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((exp, index) => (
              <tr key={index} style={runningIndex === index ? styles.runningRow : styles.tableRow}>
                <td style={styles.td}>
                  <select
                    value={exp.providerType}
                    onChange={(e) => updateExperiment(index, 'providerType', e.target.value)}
                    style={styles.select}
                    disabled={runningIndex !== null}
                  >
                    {availableProviders.map(p => (
                      <option key={p} value={p}>{p === 'local' ? 'Local' : 'Cloud'}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <select
                    value={exp.model}
                    onChange={(e) => updateExperiment(index, 'model', e.target.value)}
                    style={styles.select}
                    disabled={runningIndex !== null}
                  >
                    {getModelsForProvider(exp.providerType).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </td>
                <td style={styles.td}>
                  <div style={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={exp.temperature}
                      onChange={(e) => updateExperiment(index, 'temperature', parseFloat(e.target.value))}
                      style={styles.slider}
                      disabled={runningIndex !== null}
                    />
                    <span style={styles.sliderValue}>{exp.temperature.toFixed(1)}</span>
                  </div>
                </td>
                <td style={styles.td}>
                  <select
                    value={exp.inputMode}
                    onChange={(e) => updateExperiment(index, 'inputMode', e.target.value as 'smart_sample' | 'prompt_libre')}
                    style={styles.select}
                    disabled={runningIndex !== null}
                  >
                    <option value="smart_sample">smart_sample</option>
                    <option value="prompt_libre">prompt_libre</option>
                  </select>
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => removeExperiment(index)}
                    disabled={index === 0 || runningIndex !== null}
                    style={index === 0 ? styles.buttonDisabled : styles.buttonDanger}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addExperiment} style={styles.buttonSecondary} disabled={runningIndex !== null}>
          + Agregar fila
        </button>
      </div>

      <div style={styles.section}>
        <button
          onClick={runAllExperiments}
          style={runningIndex !== null ? styles.buttonRunning : styles.buttonPrimary}
          disabled={runningIndex !== null}
        >
          {runningIndex !== null ? `Ejecutando experimento ${runningIndex + 1}...` : '▶ RUN ALL'}
        </button>
      </div>

      {results.length > 0 && (
        <>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Matriz de Resultados</h3>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Proveedor</th>
                  <th style={styles.th}>Modelo</th>
                  <th style={styles.th}>Temp</th>
                  <th style={styles.th}>Modo</th>
                  <th style={styles.th}>Latencia</th>
                  <th style={styles.th}>Tokens/s</th>
                  <th style={styles.th}>Contrato</th>
                  <th style={styles.th}>Script</th>
                  <th style={styles.th}>Alucin.</th>
                  <th style={styles.th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={styles.tableRow}>
                    <td style={styles.td}>{r.provider}</td>
                    <td style={styles.td}>{r.model}</td>
                    <td style={styles.td}>{r.temperature}</td>
                    <td style={styles.td}>{r.inputMode}</td>
                    <td style={styles.td}>{r.latencyMs}ms</td>
                    <td style={styles.td}>{r.tokensPerSecond}</td>
                    <td style={styles.td}>{(r.contractCompliance ?? r.formatCompliance) ? '✓' : '✗'}</td>
                    <td style={styles.td}>{r.pythonScriptIncluded ? '✓' : '✗'}</td>
                    <td style={styles.td}>{r.hallucinatedColumns.length}</td>
                    <td style={styles.tdScore}>{r.compositeScore?.toFixed(2) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.section}>
            <button onClick={handleExportJson} style={styles.buttonSecondary}>
              ⬇ Exportar JSON
            </button>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Estadísticas</h3>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Media</div>
                <div style={styles.statValue}>{stats.mean.toFixed(4)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Desviación Estándar</div>
                <div style={styles.statValue}>{stats.stdDev.toFixed(4)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>CV%</div>
                <div style={styles.statValue}>{(stats.cv * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Visualización de Métricas</h3>
            <div style={styles.chartsGrid}>
              <div style={styles.chartCard}>
                <h4 style={styles.chartTitle}>Score compuesto por modelo</h4>
                <ScoreBarChart results={completedResults} />
              </div>
              <div style={styles.chartCard}>
                <h4 style={styles.chartTitle}>Perfil Multi-Dimensional</h4>
                <RadarChart results={completedResults} />
              </div>
              <div style={styles.chartCard}>
                <h4 style={styles.chartTitle}>Latencia vs Score</h4>
                <ScatterPlot results={completedResults} />
              </div>
              <div style={styles.chartCard}>
                <h4 style={styles.chartTitle}>Alucinaciones y Claims</h4>
                <HallucinationChart results={completedResults} />
              </div>
              <div style={styles.chartCardFull}>
                <h4 style={styles.chartTitle}>Latencia por Modelo (↓ mejor)</h4>
                <LatencyChart results={completedResults} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    padding: '16px',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    color: 'var(--ink)',
    fontSize: '13px',
  },
  header: {
    marginBottom: '16px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--ink)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--ink)',
    borderBottom: '1px dashed var(--border)',
    paddingBottom: '6px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '12px',
  },
  tableHeader: {
    backgroundColor: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
  },
  th: {
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--ink)',
    borderBottom: '1px solid var(--border)',
  },
  tableRow: {
    borderBottom: '1px solid var(--border)',
  },
  runningRow: {
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'color-mix(in srgb, var(--ink) 10%, transparent)',
  },
  td: {
    padding: '8px',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border)',
  },
  tdScore: {
    padding: '8px',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border)',
    fontWeight: 700,
    color: '#7FFF7F',
  },
  select: {
    backgroundColor: 'var(--bg)',
    color: 'var(--ink)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    padding: '6px 8px',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", monospace',
    width: '100%',
    cursor: 'pointer',
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  slider: {
    width: '80px',
    accentColor: 'var(--ink)',
    cursor: 'pointer',
  },
  sliderValue: {
    fontSize: '12px',
    minWidth: '30px',
  },
  buttonPrimary: {
    backgroundColor: 'var(--ink)',
    color: 'var(--bg)',
    border: '1px solid var(--ink)',
    borderRadius: 0,
    padding: '12px 24px',
    fontSize: '14px',
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: 600,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  buttonRunning: {
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    padding: '12px 24px',
    fontSize: '14px',
    fontFamily: '"JetBrains Mono", monospace',
    cursor: 'wait',
    textTransform: 'uppercase',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    color: 'var(--ink)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    padding: '8px 16px',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", monospace',
    cursor: 'pointer',
    marginTop: '8px',
  },
  buttonDanger: {
    backgroundColor: 'transparent',
    color: '#FF6B6B',
    border: '1px solid #FF6B6B',
    borderRadius: 0,
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    backgroundColor: 'transparent',
    color: 'var(--border)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'not-allowed',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  statCard: {
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    padding: '12px',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
    color: 'var(--ink)',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#7FFF7F',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  chartCard: {
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    padding: '12px',
  },
  chartCardFull: {
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    padding: '12px',
    gridColumn: '1 / -1',
  },
  chartTitle: {
    margin: '0 0 8px 0',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--ink3)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: '"JetBrains Mono", monospace',
  },
};
