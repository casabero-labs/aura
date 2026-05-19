import React, { useCallback, useState } from 'react';
import { Brain, Database, Play, ShieldCheck, FlaskConical, AlertTriangle, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Package } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS } from '../services/aiProvider';
import { recordLlmCall, computePromptHash, computeInputHash } from '../services/llmAuditLog';

interface DiagnosisStepProps {
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  analysisText: string;
  onAiConfigChange: (config: AIConfig) => void;
  onAnalysisComplete: (analysis: string) => void;
  onMetrics?: (metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
  onOpenLab?: () => void;
}

type JsonSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

const JsonSection: React.FC<JsonSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="json-section">
      <button className="json-section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`json-caret ${open ? 'open' : ''}`}>›</span>
        <span>{title}</span>
      </button>
      {open && <div className="json-section-content">{children}</div>}
    </div>
  );
};

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
  report,
  auditEvidence,
  aiConfig,
  aiProvider,
  analysisText,
  onAiConfigChange,
  onAnalysisComplete,
  onMetrics,
  onLog,
  onContinue,
  onOpenLab,
}) => {
  const [draftAnalysis, setDraftAnalysis] = useState(analysisText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  React.useEffect(() => {
    aiProvider.isAvailable().then(setProviderAvailable).catch(() => setProviderAvailable(false));
  }, [aiProvider]);

  React.useEffect(() => {
    setDraftAnalysis(analysisText);
  }, [analysisText]);

  const smartSample = React.useMemo(() => buildSmartSample(report), [report]);

  const handleProviderTypeChange = (type: 'local' | 'cloud') => {
    const models = type === 'local' ? AVAILABLE_MODELS.local : AVAILABLE_MODELS.cloud;
    const firstModel = models[0];
    onAiConfigChange({
      ...aiConfig,
      providerType: type,
      model: firstModel?.id || aiConfig.model,
      cloudProvider: type === 'cloud'
        ? (firstModel?.provider?.toLowerCase() as AIConfig['cloudProvider'])
        : undefined,
    });
  };

  const handleModelChange = (modelId: string) => {
    const cloudModel = AVAILABLE_MODELS.cloud.find(m => m.id === modelId);
    onAiConfigChange({
      ...aiConfig,
      model: modelId,
      cloudProvider: cloudModel
        ? (cloudModel.provider.toLowerCase() as AIConfig['cloudProvider'])
        : aiConfig.cloudProvider,
    });
  };

  const availableModels = aiConfig.providerType === 'local'
    ? AVAILABLE_MODELS.local
    : AVAILABLE_MODELS.cloud;

  const runDiagnosis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setDraftAnalysis('');
    let finalText = '';

    const prompt = buildAnalysisPrompt(report);
    const promptHash = computePromptHash(prompt);
    const inputHash = computeInputHash(report);

    onLog?.('diagnosis', `Iniciando diagnóstico con ${aiConfig.model} (${aiConfig.providerType})`);

    try {
      const metrics = await aiProvider.analyzeStream(report, (chunk) => {
        finalText += chunk;
        setDraftAnalysis(finalText);
      });
      setLastMetrics(metrics);
      onMetrics?.(metrics);
      onAnalysisComplete(finalText);
      onLog?.('diagnosis', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${metrics.latencyMs}ms`);

      recordLlmCall({
        callType: 'diagnosis',
        providerType: aiConfig.providerType as 'local' | 'cloud',
        provider: aiConfig.providerType === 'local' ? 'WebLLM' : (aiConfig.cloudProvider || 'Cloud'),
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        promptHash,
        inputJsonHash: inputHash,
        promptLength: prompt.length,
        inputColumnCount: report.colCount,
        inputIssueCount: report.issues.length,
        rowCount: report.rowCount,
        colCount: report.colCount,
        datasetFingerprint: auditEvidence?.datasetFingerprint || '',
        responseLength: finalText.length,
        latencyMs: metrics.latencyMs,
        tokensGenerated: metrics.tokensGenerated,
        status: 'completed',
      });
    } catch (err: any) {
      const msg = err?.message ?? 'Error desconocido durante el diagnóstico';
      setError(msg);
      onLog?.('diagnosis', `Error: ${msg}`);

      recordLlmCall({
        callType: 'diagnosis',
        providerType: aiConfig.providerType as 'local' | 'cloud',
        provider: aiConfig.providerType === 'local' ? 'WebLLM' : (aiConfig.cloudProvider || 'Cloud'),
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        promptHash,
        inputJsonHash: inputHash,
        promptLength: prompt.length,
        inputColumnCount: report.colCount,
        inputIssueCount: report.issues.length,
        rowCount: report.rowCount,
        colCount: report.colCount,
        datasetFingerprint: auditEvidence?.datasetFingerprint || '',
        responseLength: finalText.length,
        latencyMs: 0,
        tokensGenerated: 0,
        status: 'error',
        error: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [aiConfig.model, aiConfig.providerType, aiConfig.cloudProvider, aiConfig.temperature, aiProvider, isLoading, onAnalysisComplete, onLog, onMetrics, report, auditEvidence]);

  const isCloud = aiConfig.providerType === 'cloud';

  return (
    <>
      {/* ── 1. Qué se recibe del perfil ── */}
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">entrada recibida</p>
            <h2 className="sec-title">Paquete de evidencia del perfil.</h2>
          </div>
        </header>

        <p className="section-note">
          Este es el paquete estructurado que generó el motor determinista en la etapa anterior.
          El modelo de IA solo recibe esta información; no tiene acceso al dataset completo.
        </p>

        <div className="benchmark-protocol mt-6">
          <div>
            <span>filas del dataset</span>
            <strong>{report.rowCount.toLocaleString('es-CO')}</strong>
          </div>
          <div>
            <span>columnas observadas</span>
            <strong>{report.colCount}</strong>
          </div>
          <div>
            <span>score de calidad</span>
            <strong>{report.score}/100</strong>
          </div>
          <div>
            <span>reglas activadas</span>
            <strong>{report.issues.length}</strong>
          </div>
        </div>

        <div className="mt-6">
          <button
            className="btn-s"
            onClick={() => setShowEvidence(!showEvidence)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {showEvidence ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {showEvidence ? 'Ocultar paquete' : 'Ver paquete enviado al modelo'}
          </button>
        </div>

        {showEvidence && (
          <div className="smart-sample-viewer mt-6">
            <div className="smart-sample-header">
              <div className="smart-sample-title">
                <Package size={14} />
                <span>PAQUETE ESTRUCTURADO → MODELO</span>
              </div>
              <p className="smart-sample-subtitle">
                JSON que se inyecta en el prompt del LLM. Contiene contexto, columnas observadas
                y hallazgos con muestras de evidencia.
              </p>
            </div>
            <div className="smart-sample-body">
              <JsonSection title={`context — ${Object.keys(smartSample.context).length} campos`} defaultOpen>
                <div className="json-kv">
                  <span className="json-line"><span className="json-key">"total_rows"</span>: <span className="json-number">{smartSample.context.total_rows}</span>,</span>
                  <span className="json-line"><span className="json-key">"total_columns"</span>: <span className="json-number">{smartSample.context.total_columns}</span>,</span>
                  <span className="json-line"><span className="json-key">"detected_delimiter"</span>: <span className="json-string">"{smartSample.context.detected_delimiter}"</span>,</span>
                  <span className="json-line"><span className="json-key">"quality_score"</span>: <span className="json-number">{smartSample.context.quality_score}</span></span>
                </div>
              </JsonSection>
              <JsonSection title={`columns — ${smartSample.columns.length} columnas`}>
                <pre className="json-raw">{JSON.stringify(smartSample.columns, null, 2)}</pre>
              </JsonSection>
              <JsonSection title={`detected_issues — ${smartSample.detected_issues.length} reglas activadas`}>
                <pre className="json-raw">{JSON.stringify(smartSample.detected_issues, null, 2)}</pre>
              </JsonSection>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. Selector de modelo ── */}
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">configuración del modelo</p>
            <h2 className="sec-title">Elegir modelo para diagnóstico.</h2>
          </div>
        </header>

        {/* Privacy warning */}
        <div className={`privacy-notice ${isCloud ? 'privacy-notice--cloud' : 'privacy-notice--local'}`}>
          {isCloud ? (
            <>
              <Globe size={14} />
              <div>
                <strong>Modo cloud</strong>
                <p>Los datos del paquete de evidencia viajan al proveedor {aiConfig.cloudProvider || 'cloud'}. El modelo es más capaz pero los datos salen de tu dispositivo.</p>
              </div>
            </>
          ) : (
            <>
              <Lock size={14} />
              <div>
                <strong>Modo local (WebGPU)</strong>
                <p>El modelo se ejecuta en tu navegador. Ningún dato sale de tu dispositivo. Capacidad limitada según el modelo disponible.</p>
              </div>
            </>
          )}
        </div>

        <div className="model-selector-grid mt-6">
          {/* Provider type toggle */}
          <div className="model-selector-group">
            <label className="model-selector-label">Proveedor</label>
            <div className="model-type-toggle">
              <button
                className={`model-type-btn ${aiConfig.providerType === 'local' ? 'active' : ''}`}
                onClick={() => handleProviderTypeChange('local')}
              >
                <Database size={12} /> Local
              </button>
              <button
                className={`model-type-btn ${aiConfig.providerType === 'cloud' ? 'active' : ''}`}
                onClick={() => handleProviderTypeChange('cloud')}
              >
                <Globe size={12} /> Cloud
              </button>
            </div>
          </div>

          {/* Model dropdown */}
          <div className="model-selector-group">
            <label className="model-selector-label">Modelo</label>
            <select
              className="model-select"
              value={aiConfig.model}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lab CTA */}
        {onOpenLab && (
          <div className="lab-cta mt-6">
            <FlaskConical size={14} />
            <span>¿Querés comparar cómo se comporta otro modelo con la misma evidencia?</span>
            <button className="btn-s btn-sm" onClick={onOpenLab}>
              Abrir laboratorio experimental
            </button>
          </div>
        )}
      </section>

      {/* ── 3. Ejecutar diagnóstico ── */}
      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">diagnóstico asistido</p>
            <h2 className="sec-title">Explicar los problemas de calidad.</h2>
          </div>
        </header>

        <p className="section-note">
          El modelo interpreta los hallazgos estructurados del perfil. No recibe el dataset completo
          ni puede inventar columnas, valores o relaciones que no estén en el paquete de evidencia.
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
