/**
 * AnalysisStep — Phase 2 Step 3: AI Analysis Streaming + Cleaning Script Generation
 * 
 * Consolidates the cognitive layer: streaming AI analysis and script generation buttons
 * that were previously scattered in App.tsx.
 * 
 * References:
 * - AI Provider interface: types.ts AIProvider
 * - GeminiAdvisor component: GeminiAdvisor.tsx
 * - aiProvider factory: services/aiProvider.ts createAIProvider
 */

import React, { useState, useCallback } from 'react';
import { Brain, Database, FileCode2, Play, ShieldCheck } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import { AIConfig, AIProvider, AuditReport, ProviderMetrics } from '../types';

interface AnalysisStepProps {
  /** Audit report with issues to send to LLM */
  report: AuditReport;
  /** AI configuration from settings */
  aiConfig: AIConfig;
  /** Pre-created AI provider instance */
  aiProvider: AIProvider;
  /** Called when script is generated (extracted from executive report) */
  onScriptGenerated?: (script: string) => void;
  /** Called when streaming analysis completes */
  onAnalysisComplete?: (analysis: string) => void;
  /** Called with provider metrics after each operation */
  onMetrics?: (metrics: ProviderMetrics) => void;
  /** Log a message to the pipeline log */
  onLog?: (stage: string, msg: string) => void;
}

const AnalysisStep: React.FC<AnalysisStepProps> = ({
  report,
  aiConfig,
  aiProvider,
  onScriptGenerated,
  onAnalysisComplete,
  onMetrics,
  onLog,
}) => {
  // ── Local state ──
  const [analysisText, setAnalysisText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null);

  // ── Derived ──
  const issuesCount = report.issues.length;
  const modelName = aiConfig.model;
  const providerType = aiConfig.providerType;
  const lastLatency = lastMetrics ? `${(lastMetrics.latencyMs / 1000).toFixed(1)}s` : '—';

  // ── Check provider availability on mount / config change ──
  React.useEffect(() => {
    aiProvider.isAvailable().then(setProviderAvailable).catch(() => setProviderAvailable(false));
  }, [aiProvider]);

  // ── Streaming AI analysis handler ──
  const handleRunAiAnalysis = useCallback(async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    setError(null);
    setAnalysisText('');

    onLog?.('analysis', `Iniciando análisis IA con ${modelName}…`);

    try {
      const metrics = await aiProvider.analyzeStream(report, (chunk) => {
        setAnalysisText((prev) => prev + chunk);
      });

      setLastMetrics(metrics);
      onMetrics?.(metrics);
      onAnalysisComplete?.(analysisText + '');
      onLog?.('analysis', `Análisis completado — ${metrics.tokensGenerated} tokens en ${metrics.latencyMs}ms`);
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido en análisis IA';
      setError(msg);
      onLog?.('analysis', `Error: ${msg}`);
    } finally {
      setIsAiLoading(false);
    }
  }, [aiProvider, report, isAiLoading, modelName, onLog, onMetrics, onAnalysisComplete, analysisText]);

  // ── Script generation handler ──
  const handleGenerateScript = useCallback(async () => {
    if (isScriptLoading) return;
    setIsScriptLoading(true);
    setError(null);

    onLog?.('script', 'Generando script de limpieza con IA…');

    try {
      const { content, metrics } = await aiProvider.generateExecutiveReport(report);

      setLastMetrics(metrics);
      onMetrics?.(metrics);

      const script = content.python_script;
      if (script) {
        onScriptGenerated?.(script);
        onLog?.('script', `Script generado — ${script.split('\n').length} líneas`);
      } else {
        setError('El modelo no generó contenido de script. Intenta con otro prompt o modelo.');
        onLog?.('script', 'Advertencia: el reporte no contenía python_script');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido en generación de script';
      setError(msg);
      onLog?.('script', `Error: ${msg}`);
    } finally {
      setIsScriptLoading(false);
    }
  }, [aiProvider, report, isScriptLoading, onLog, onScriptGenerated, onMetrics]);

  return (
    <section className="section">
      {/* ── Header ── */}
      <header className="section-header">
        <div className="sec-eye">
          <Brain size={14} />
          <span>capa cognitiva · paso 3</span>
        </div>
        <h2 className="sec-title">Análisis IA + Script de limpieza</h2>
        <p className="section-note">
          Envía los hallazgos deterministas al LLM para interpretación contextual y generación
          de un script Python de limpieza auditado y reproducible.
        </p>
      </header>

      {/* ── Main grid: advisor + info panel ── */}
      <div className="cognitive-grid">
        {/* GeminiAdvisor streaming output */}
        <div className="advisor-shell">
          <GeminiAdvisor
            analysis={analysisText}
            isLoading={isAiLoading}
            providerType={providerType as 'local' | 'cloud'}
            model={modelName}
          />
        </div>

        {/* Mini info panel */}
        <aside className="mini-panel">
          <div className="layer">
            <div className="layer-n">
              <Database size={12} />
            </div>
            <div className="layer-name">Problemas enviados</div>
            <div className="layer-tag">{issuesCount}</div>
          </div>

          <div className="layer">
            <div className="layer-n">
              <Brain size={12} />
            </div>
            <div className="layer-name">Modelo</div>
            <div className="layer-tag" style={{ fontSize: '10px', wordBreak: 'break-all' }}>{modelName}</div>
          </div>

          <div className="layer">
            <div className="layer-n">
              <ShieldCheck size={12} />
            </div>
            <div className="layer-name">Tipo proveedor</div>
            <div className="layer-tag">{providerType}</div>
          </div>

          <div className="layer">
            <div className="layer-n">
              <Play size={12} />
            </div>
            <div className="layer-name">Última latencia</div>
            <div className="layer-tag">{lastLatency}</div>
          </div>

          {/* Error display */}
          {error && (
            <div className="layer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <span className="layer-name" style={{ color: 'var(--accent)' }}>Error</span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', wordBreak: 'break-word' }}>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <button
              className="btn-p"
              onClick={handleRunAiAnalysis}
              disabled={isAiLoading || isScriptLoading || providerAvailable === false}
              title={providerAvailable === false ? 'Proveedor IA no disponible' : 'Ejecutar análisis IA con streaming'}
            >
              <Brain size={14} />
              {isAiLoading ? 'Analizando…' : 'Analizar con IA'}
            </button>

            <button
              className="btn-s"
              onClick={handleGenerateScript}
              disabled={isAiLoading || isScriptLoading || providerAvailable === false}
              title={providerAvailable === false ? 'Proveedor IA no disponible' : 'Generar script Python de limpieza'}
            >
              <FileCode2 size={14} />
              {isScriptLoading ? 'Generando…' : 'Generar script de limpieza'}
            </button>

            {providerAvailable === false && (
              <p style={{ fontSize: '11px', color: 'var(--ink-muted)', textAlign: 'center', marginTop: '4px' }}>
                Proveedor IA no disponible. Revisa la configuración en ajustes.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default AnalysisStep;