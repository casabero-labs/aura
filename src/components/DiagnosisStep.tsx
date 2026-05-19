import React, { useCallback, useState } from 'react';
import { Brain, Database, Play, ShieldCheck } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import { AIConfig, AIProvider, AuditReport, ProviderMetrics } from '../types';

interface DiagnosisStepProps {
  report: AuditReport;
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  analysisText: string;
  onAnalysisComplete: (analysis: string) => void;
  onMetrics?: (metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
}

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
  report,
  aiConfig,
  aiProvider,
  analysisText,
  onAnalysisComplete,
  onMetrics,
  onLog,
  onContinue,
}) => {
  const [draftAnalysis, setDraftAnalysis] = useState(analysisText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null);

  React.useEffect(() => {
    aiProvider.isAvailable().then(setProviderAvailable).catch(() => setProviderAvailable(false));
  }, [aiProvider]);

  React.useEffect(() => {
    setDraftAnalysis(analysisText);
  }, [analysisText]);

  const runDiagnosis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setDraftAnalysis('');
    let finalText = '';

    onLog?.('diagnosis', `Iniciando diagnóstico con ${aiConfig.model}`);

    try {
      const metrics = await aiProvider.analyzeStream(report, (chunk) => {
        finalText += chunk;
        setDraftAnalysis(finalText);
      });
      setLastMetrics(metrics);
      onMetrics?.(metrics);
      onAnalysisComplete(finalText);
      onLog?.('diagnosis', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${metrics.latencyMs}ms`);
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido durante el diagnóstico';
      setError(msg);
      onLog?.('diagnosis', `Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [aiConfig.model, aiProvider, isLoading, onAnalysisComplete, onLog, onMetrics, report]);

  return (
    <>
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">diagnóstico asistido</p>
            <h2 className="sec-title">Explicar los problemas de calidad.</h2>
          </div>
        </header>

        <p className="section-note">
          Esta etapa interpreta los hallazgos estructurados del perfil. El modelo seleccionado recibe reglas activadas,
          columnas observadas y muestras de evidencia; no recibe una explicación inventada ni modifica el dataset.
        </p>

        <div className="cognitive-grid">
          <div className="advisor-shell">
            <GeminiAdvisor
              analysis={draftAnalysis}
              isLoading={isLoading}
              providerType={aiConfig.providerType as 'local' | 'cloud'}
              model={aiConfig.model}
            />
          </div>

          <aside className="mini-panel">
            <div className="layer">
              <div className="layer-n"><Database size={12} /></div>
              <div className="layer-name">Hallazgos recibidos</div>
              <div className="layer-tag">{report.issues.length}</div>
            </div>
            <div className="layer">
              <div className="layer-n"><Brain size={12} /></div>
              <div className="layer-name">Modelo</div>
              <div className="layer-tag" style={{ fontSize: '10px', wordBreak: 'break-all' }}>{aiConfig.model}</div>
            </div>
            <div className="layer">
              <div className="layer-n"><ShieldCheck size={12} /></div>
              <div className="layer-name">Modo</div>
              <div className="layer-tag">{aiConfig.providerType}</div>
            </div>
            <div className="layer">
              <div className="layer-n"><Play size={12} /></div>
              <div className="layer-name">Última latencia</div>
              <div className="layer-tag">{lastMetrics ? `${(lastMetrics.latencyMs / 1000).toFixed(1)}s` : '-'}</div>
            </div>
            {error && (
              <div className="layer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <span className="layer-name" style={{ color: 'var(--accent)' }}>Error</span>
                <span style={{ fontSize: '11px', color: 'var(--accent)', wordBreak: 'break-word' }}>{error}</span>
              </div>
            )}
            <button
              className="btn-p"
              onClick={runDiagnosis}
              disabled={isLoading || providerAvailable === false}
              title={providerAvailable === false ? 'Proveedor no disponible' : 'Ejecutar diagnóstico asistido'}
            >
              <Brain size={14} />
              {isLoading ? 'Diagnosticando' : 'Generar diagnóstico'}
            </button>
            {providerAvailable === false && (
              <p style={{ fontSize: '11px', color: 'var(--ink-muted)', textAlign: 'center', marginTop: '4px' }}>
                Proveedor no disponible. Revisa la configuración.
              </p>
            )}
          </aside>
        </div>
      </section>

      <div className="context-guide">
        <span className="guide-icon"><Play size={14} /></span>
        <div>
          <p className="guide-title">Cuando el diagnóstico esté claro, genera acciones</p>
          <p className="guide-desc">El script se genera en una etapa separada para revisar seguridad, columnas y trazabilidad antes de aprobarlo.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue} disabled={!draftAnalysis.trim()}>
          Generar script <Play size={12} />
        </button>
      </div>
    </>
  );
};

export default DiagnosisStep;

