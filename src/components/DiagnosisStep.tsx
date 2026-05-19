import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Database, Play, ShieldCheck, FlaskConical, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Trash2, HardDrive, X, AlertTriangle, ListChecks } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS, LOCAL_MODELS, checkModelDownloaded, deleteDownloadedModel } from '../services/aiProvider';
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

export const buildDiagnosisInputSummary = (report: AuditReport) => {
  const critical = report.issues.filter((issue) => issue.severity === 'critical').length;
  const warning = report.issues.filter((issue) => issue.severity === 'warning').length;
  const affectedColumns = new Set(report.issues.map((issue) => issue.column).filter(Boolean)).size;
  const mainIssue = report.issues
    .slice()
    .sort((a, b) => b.affectedPercentage - a.affectedPercentage)[0];

  return {
    stage: 'Diagnóstico asistido',
    input: `${report.issues.length} hallazgos estructurados del perfil determinista`,
    rawDatasetAccess: false,
    problem: mainIssue
      ? `${mainIssue.ruleName} en ${mainIssue.column || 'dataset'} afecta ${mainIssue.affectedPercentage.toFixed(2)}% de registros.`
      : 'No hay hallazgos críticos; el diagnóstico puede documentar estabilidad y riesgos residuales.',
    risk: `${critical} críticos, ${warning} advertencias, ${affectedColumns} columnas afectadas`,
    output: 'causas probables, prioridades de limpieza y criterios para generar script',
  };
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
  const [showPrompt, setShowPrompt] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  useEffect(() => {
    if (aiConfig.providerType === 'local') {
      const checkDownloads = async () => {
        const downloaded = new Set<string>();
        for (const model of LOCAL_MODELS) {
          if (await checkModelDownloaded(model.id)) {
            downloaded.add(model.id);
          }
        }
        setDownloadedModels(downloaded);
      };
      checkDownloads();
    }
  }, [aiConfig.providerType]);

  const handleDeleteModel = async (modelId: string) => {
    setDeletingModel(modelId);
    const success = await deleteDownloadedModel(modelId);
    if (success) {
      setDownloadedModels(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
    setDeletingModel(null);
  };

  React.useEffect(() => {
    aiProvider.isAvailable().then(setProviderAvailable).catch(() => setProviderAvailable(false));
  }, [aiProvider]);

  React.useEffect(() => {
    setDraftAnalysis(analysisText);
  }, [analysisText]);

  const smartSample = React.useMemo(() => buildSmartSample(report), [report]);
  const diagnosisPrompt = React.useMemo(() => buildAnalysisPrompt(report), [report]);
  const diagnosisSummary = React.useMemo(() => buildDiagnosisInputSummary(report), [report]);

  const handleProviderTypeChange = (type: 'local' | 'cloud') => {
    const models = type === 'local'
      ? AVAILABLE_MODELS.local.filter(m => downloadedModels.has(m.id))
      : AVAILABLE_MODELS.cloud.filter(m => {
          if (!aiConfig.apiKey) return false;
          if (m.provider === 'Google') return aiConfig.cloudProvider === 'google';
          return true;
        });
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
    ? AVAILABLE_MODELS.local.filter(m => downloadedModels.has(m.id))
    : AVAILABLE_MODELS.cloud.filter(m => {
        if (!aiConfig.apiKey) return false;
        if (m.provider === 'Google') return aiConfig.cloudProvider === 'google';
        return true;
      });

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
        promptText: prompt,
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
        promptText: prompt,
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
      <section className="diagnosis-stage">
        <div className="diagnosis-stage-main">
          <p className="sec-eye">diagnóstico asistido</p>
          <h2 className="sec-title">Interpretar los problemas de calidad.</h2>
          <p className="section-note">
            Esta etapa no vuelve a perfilar el dataset. Recibe los hallazgos estructurados de Perfilar
            y produce una lectura operativa: causas probables, prioridad de limpieza y criterios para el script.
          </p>
        </div>
        <div className="diagnosis-contract">
          <div>
            <span>entrada</span>
            <strong>{diagnosisSummary.input}</strong>
          </div>
          <div>
            <span>acceso al archivo crudo</span>
            <strong>No</strong>
          </div>
          <div>
            <span>salida esperada</span>
            <strong>{diagnosisSummary.output}</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">problema observado</p>
            <h2 className="sec-title">Resumen antes de interpretar.</h2>
          </div>
        </header>

        <div className="diagnosis-problem-grid">
          <article className="diagnosis-problem-card diagnosis-problem-card--primary">
            <AlertTriangle size={16} />
            <span>principal señal de calidad</span>
            <strong>{diagnosisSummary.problem}</strong>
          </article>
          <article className="diagnosis-problem-card">
            <ListChecks size={16} />
            <span>riesgo agregado</span>
            <strong>{diagnosisSummary.risk}</strong>
          </article>
          <article className="diagnosis-problem-card">
            <Database size={16} />
            <span>paquete usado</span>
            <strong>{report.colCount} columnas, {report.rowCount.toLocaleString('es-CO')} filas, {report.score}/100 score</strong>
          </article>
        </div>
      </section>

      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">ejecución</p>
            <h2 className="sec-title">Seleccionar modo de diagnóstico.</h2>
          </div>
        </header>

        <div className={`privacy-notice ${isCloud ? 'privacy-notice--cloud' : 'privacy-notice--local'}`}>
          {isCloud ? (
            <>
              <Globe size={14} />
              <div>
                <strong>Cloud</strong>
                <p>Se envía el paquete estructurado, no el archivo completo. Conviene usarlo cuando priorizas capacidad de razonamiento sobre soberanía local.</p>
              </div>
            </>
          ) : (
            <>
              <Lock size={14} />
              <div>
                <strong>Local</strong>
                <p>El diagnóstico se ejecuta en el navegador. Es el modo coherente con privacidad local-first, con límites según el modelo descargado.</p>
              </div>
            </>
          )}
        </div>

        <div className="model-selector-grid mt-6">
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

          <div className="model-selector-group">
            <label className="model-selector-label">Modelo</label>
            <select
              className="model-select"
              value={aiConfig.model}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {availableModels.length === 0 && (
                <option disabled>Sin modelos disponibles</option>
              )}
              {availableModels.map(model => {
                const localModel = LOCAL_MODELS.find(m => m.id === model.id);
                const isDownloaded = downloadedModels.has(model.id);
                return (
                  <option key={model.id} value={model.id}>
                    {model.name}
                    {isDownloaded ? ' ✓' : ''}
                  </option>
                );
              })}
            </select>

            {aiConfig.providerType === 'local' && downloadedModels.size > 0 && (
              <div className="downloaded-models-list">
                <div className="downloaded-models-header">
                  <HardDrive size={10} />
                  <span>Modelos descargados ({downloadedModels.size})</span>
                </div>
                {Array.from(downloadedModels).map(modelId => {
                  const modelInfo = LOCAL_MODELS.find(m => m.id === modelId);
                  if (!modelInfo) return null;
                  return (
                    <div key={modelId} className="downloaded-model-item">
                      <span className="downloaded-model-name">{modelInfo.name}</span>
                      <span className="downloaded-model-size">{modelInfo.sizeGB} GB</span>
                      <button
                        className="delete-model-btn"
                        onClick={() => handleDeleteModel(modelId)}
                        disabled={deletingModel === modelId || modelId === aiConfig.model}
                        title={modelId === aiConfig.model ? 'No se puede eliminar el modelo activo' : 'Eliminar modelo'}
                      >
                        {deletingModel === modelId ? '...' : <Trash2 size={10} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {onOpenLab && (
          <div className="lab-cta mt-6">
            <FlaskConical size={14} />
            <span>La comparación experimental usa este mismo paquete de entrada para medir latencia, formato y utilidad.</span>
            <button className="btn-s btn-sm" onClick={onOpenLab}>
              Comparar modelos
            </button>
          </div>
        )}
      </section>

      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">entrada controlada</p>
            <h2 className="sec-title">Qué se interpreta.</h2>
          </div>
        </header>

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
            {showEvidence ? 'Ocultar estructura técnica' : 'Ver estructura técnica'}
          </button>
        </div>

        {showEvidence && (
          <div className="smart-sample-viewer mt-6">
            <div className="smart-sample-header">
              <div className="smart-sample-title">
                <FileCode2 size={14} />
                <span>PAQUETE ESTRUCTURADO</span>
              </div>
              <p className="smart-sample-subtitle">
                Estructura usada para la interpretación: contexto, columnas observadas y hallazgos con muestras de evidencia.
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

      <section className="section">
        <header className="section-header">
          <div>
            <p className="sec-eye">resultado</p>
            <h2 className="sec-title">Diagnóstico de causas probables.</h2>
          </div>
        </header>

        <p className="section-note">
          El resultado debe explicar problemas de calidad sin inventar columnas, valores o relaciones fuera del paquete estructurado.
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
              className="btn-s"
              onClick={() => setShowPrompt(!showPrompt)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', marginTop: '4px' }}
            >
              <FileCode2 size={12} />
              {showPrompt ? 'Ocultar contrato técnico' : 'Ver contrato técnico'}
            </button>

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

      {/* ── Prompt modal ── */}
      {showPrompt && (
        <div className="prompt-modal" onClick={() => setShowPrompt(false)}>
          <div className="prompt-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prompt-modal-header">
              <h3>Contrato técnico de interpretación</h3>
              <button className="prompt-modal-close" onClick={() => setShowPrompt(false)}><X size={14} /></button>
            </div>
            <pre className="prompt-modal-body">{diagnosisPrompt}</pre>
            <div className="prompt-modal-footer">
              <span>{diagnosisPrompt.length.toLocaleString('es-CO')} chars</span>
              <span>{computePromptHash(diagnosisPrompt)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiagnosisStep;
