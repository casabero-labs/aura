import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Database, Play, FlaskConical, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Trash2, HardDrive, X, AlertTriangle, ShieldAlert, ListChecks, FileJson, FileText, Settings, Activity, CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import ProgressDisclosure from './ProgressDisclosure';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics, LocalModelStatus, DiagnosisEvent, ProviderProgressEvent, ProgressDisclosureStatus } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS, LOCAL_MODELS, getLocalModelStatus, markPreloadVerified, clearPreloadVerification, deleteDownloadedModel } from '../services/aiProvider';
import { recordLlmCall, computePromptHash, computeInputHash } from '../services/llmAuditLog';
import { normalizeAiProviderError, NormalizedProviderError } from '../services/providers/errors';

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
  onOpenSettings?: () => void;
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

  return {
    findings: report.issues.length,
    critical,
    warning,
    affectedColumns,
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
  onOpenSettings,
}) => {
  const [draftAnalysis, setDraftAnalysis] = useState(analysisText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalizedError, setNormalizedError] = useState<NormalizedProviderError | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [currentModelStatus, setCurrentModelStatus] = useState<LocalModelStatus | null>(null);
  const [isCheckingModel, setIsCheckingModel] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<Record<string, LocalModelStatus>>({});
  const [diagnosisEvents, setDiagnosisEvents] = useState<DiagnosisEvent[]>([]);
  const [showActivityConsole, setShowActivityConsole] = useState(false);
  const [progressStatus, setProgressStatus] = useState<ProgressDisclosureStatus>('idle');
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressIndeterminate, setProgressIndeterminate] = useState(false);

  const pushEvent = useCallback((level: DiagnosisEvent['level'], message: string) => {
    const event: DiagnosisEvent = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    setDiagnosisEvents(prev => [...prev, event]);
  }, []);

  const checkCurrentModelStatus = useCallback(async (modelId: string) => {
    if (aiConfig.providerType !== 'local') {
      setCurrentModelStatus(null);
      return;
    }
    setIsCheckingModel(true);
    const status = await getLocalModelStatus(modelId);
    setCurrentModelStatus(status);
    setModelStatuses(prev => ({ ...prev, [modelId]: status }));
    setIsCheckingModel(false);
  }, [aiConfig.providerType]);

  useEffect(() => {
    checkCurrentModelStatus(aiConfig.model);
  }, [aiConfig.model, aiConfig.providerType, checkCurrentModelStatus]);

  const handleDeleteModel = async (modelId: string) => {
    setDeletingModel(modelId);
    const success = await deleteDownloadedModel(modelId);
    if (success) {
      clearPreloadVerification(modelId);
      setCurrentModelStatus({
        status: 'not_downloaded',
        confidence: 'high',
        source: 'unknown',
        message: 'Modelo eliminado.',
      });
      setModelStatuses(prev => {
        const next = { ...prev };
        delete next[modelId];
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
  const diagnosisPrompt = React.useMemo(() => buildAnalysisPrompt(report, aiConfig.promptContract, aiConfig.inputMode), [report, aiConfig.promptContract, aiConfig.inputMode]);
  const inputSummary = React.useMemo(() => buildDiagnosisInputSummary(report), [report]);

  const downloadTextFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportDiagnosisJson = () => {
    if (!draftAnalysis.trim()) return;
    const profile = {
      dataset: {
        rows: report.rowCount,
        columns: report.colCount,
        delimiter: report.delimiterDetected,
        score: report.score,
        duplicateRows: report.duplicateRows,
        datasetFingerprint: auditEvidence?.datasetFingerprint,
      },
      columnStats: report.columnStats,
      issues: report.issues,
      auditEvidence,
    };
    downloadTextFile(
      `aura_reporte_perfil_diagnostico_${Date.now()}.json`,
      JSON.stringify({
        reportType: 'perfil_determinista_y_diagnostico_llm',
        generatedAt: new Date().toISOString(),
        profile,
        provider: aiConfig.providerType,
        model: aiConfig.model,
        temperature: aiConfig.temperature,
        promptHash: computePromptHash(diagnosisPrompt),
        inputSummary,
        smartSample,
        diagnosis: draftAnalysis,
        metrics: lastMetrics,
      }, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const exportDiagnosisPdf = async () => {
    if (!draftAnalysis.trim()) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const margin = 16;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    let y = 18;
    const draw = (text: string, size = 10, gap = 6) => {
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, width);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += gap;
      });
    };

    doc.setFont('helvetica', 'bold');
    draw('AURA - Reporte consolidado: perfil del dataset y diagnostico LLM', 15, 8);
    doc.setFont('helvetica', 'normal');
    draw(`Dataset: ${report.rowCount.toLocaleString('es-CO')} filas · ${report.colCount} columnas · delimitador "${report.delimiterDetected}" · score ${report.score}/100`, 9, 5);
    draw(`Modelo: ${aiConfig.model} · Proveedor: ${aiConfig.providerType} · Temperatura: ${aiConfig.temperature}`, 9, 5);
    draw(`Prompt hash: ${computePromptHash(diagnosisPrompt)}`, 8, 5);
    y += 4;
    doc.setFont('helvetica', 'bold');
    draw('1. Perfil determinista del dataset', 11, 6);
    doc.setFont('helvetica', 'normal');
    draw(`Duplicados exactos: ${report.duplicateRows}. Reglas activadas: ${report.issues.length}. Evidencia: ${auditEvidence?.datasetFingerprint || 'sin fingerprint'}.`, 9, 5);
    draw(`Columnas observadas: ${Object.keys(report.columnStats).join(', ')}`, 8, 4);
    y += 3;
    doc.setFont('helvetica', 'bold');
    draw('2. Hallazgos deterministas principales', 11, 6);
    doc.setFont('helvetica', 'normal');
    report.issues.slice(0, 10).forEach((issue, index) => {
      draw(`${index + 1}. ${issue.severity.toUpperCase()} · ${issue.ruleName}${issue.column ? ` · ${issue.column}` : ''}: ${issue.description}`, 8, 4);
    });
    y += 3;
    doc.setFont('helvetica', 'bold');
    draw('3. Diagnostico LLM generado', 11, 6);
    doc.setFont('helvetica', 'normal');
    draw(draftAnalysis.replace(/[#*_`]/g, ''), 9, 5);
    doc.save(`aura_reporte_perfil_diagnostico_${Date.now()}.pdf`);
  };

  const handleProviderTypeChange = (type: 'local' | 'cloud') => {
    const models = type === 'local'
      ? AVAILABLE_MODELS.local
      : AVAILABLE_MODELS.cloud.filter(m => {
          if (!aiConfig.apiKey) return false;
          if (m.provider === 'Google') return aiConfig.cloudProvider === 'google';
          return true;
        });
    const firstModel = type === 'local'
      ? models.find((model) => model.id === aiConfig.model) || models[0]
      : models[0];
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
    setDiagnosisEvents([]);
    setShowActivityConsole(true);
    setProgressValue(undefined);
    setProgressIndeterminate(true);
    setProgressStep('Preparando evidencia estructurada');
    setProgressStatus('running');
    let finalText = '';

    const prompt = diagnosisPrompt;
    const promptHash = computePromptHash(prompt);
    const inputHash = computeInputHash(report);

    pushEvent('info', 'AURA está preparando la evidencia estructurada.');
    onLog?.('diagnosis', `Iniciando diagnóstico con ${aiConfig.model} (${aiConfig.providerType})`);

    try {
      if (aiConfig.providerType === 'local') {
        pushEvent('info', 'Verificando proveedor local (WebGPU)...');
        setProgressStep('Descargando o cargando modelo local');
      } else {
        pushEvent('info', `Verificando conexión con proveedor cloud (${aiConfig.cloudProvider || 'API'})...`);
        setProgressStep('Verificando proveedor cloud');
      }

      let text: string;
      let metrics: ProviderMetrics;

      if (aiProvider.generateTextWithProgress) {
        const result = await aiProvider.generateTextWithProgress(prompt, (event: ProviderProgressEvent) => {
          if (event.progress !== undefined) {
            setProgressIndeterminate(false);
            setProgressValue(event.progress);
          }
          setProgressStep(event.message);
          pushEvent(
            event.stage === 'error' ? 'error' :
            event.stage === 'completed' ? 'success' : 'info',
            event.message
          );
        });
        text = result.text;
        metrics = result.metrics;
      } else {
        pushEvent('info', 'Enviando paquete estructurado al modelo.');
        pushEvent('info', 'Esperando respuesta...');
        setProgressStep('Generando diagnóstico');
        const result = await aiProvider.generateText(prompt);
        text = result.text;
        metrics = result.metrics;
      }

      finalText = text;
      setDraftAnalysis(text);
      setLastMetrics(metrics);
      onMetrics?.(metrics);
      onAnalysisComplete(finalText);

      setProgressValue(100);
      setProgressIndeterminate(false);
      pushEvent('success', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${(metrics.latencyMs / 1000).toFixed(1)}s`);
      setProgressStep(`Diagnóstico completado · ${(metrics.latencyMs / 1000).toFixed(1)}s`);
      setProgressStatus('success');
      onLog?.('diagnosis', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${metrics.latencyMs}ms`);

      if (aiConfig.providerType === 'local') {
        markPreloadVerified(aiConfig.model);
        setCurrentModelStatus({
          status: 'ready',
          confidence: 'high',
          source: 'preload_verified',
          message: 'Modelo local verificado tras ejecución exitosa.',
        });
      }

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
      const normalized = normalizeAiProviderError(err, aiConfig);
      setError(normalized.message);
      setNormalizedError(normalized);
      pushEvent('error', `Diagnóstico fallido: ${normalized.title}`);
      pushEvent('warning', 'Puedes continuar con respaldo determinista si el flujo falla.');
      setProgressStatus('error');
      setProgressStep(`Error: ${normalized.title}`);
      setProgressIndeterminate(false);
      onLog?.('diagnosis', `Error: ${normalized.title} - ${normalized.message}`);

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
        error: normalized.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [aiConfig.model, aiConfig.providerType, aiConfig.cloudProvider, aiConfig.temperature, aiProvider, isLoading, onAnalysisComplete, onLog, onMetrics, report, auditEvidence, diagnosisPrompt, pushEvent]);

  const isCloud = aiConfig.providerType === 'cloud';
  const hasDiagnosis = draftAnalysis.trim().length > 0;

  return (
    <>
      <section className="diagnosis-compact" data-testid="diagnosis-stage">
        <div className="diagnosis-compact-header">
          <p className="sec-eye">diagnóstico asistido</p>
          <h2 className="sec-title">AURA interpreta los hallazgos</h2>
          <p className="section-note">
            No enviamos el dataset completo. AURA trabaja con la evidencia estructurada del perfil.
          </p>
        </div>

        <div className="companion-note">
          <Brain size={16} />
          <p>AURA mirará los hallazgos del perfil y propondrá causas probables, prioridades y criterios para limpiar. Si el modelo no está disponible, puedes seguir con un script determinista.</p>
        </div>

        <div className="stage-decision-summary" data-testid="stage-decision-summary">
          <div className="stage-summary-item">
            <span className="stage-summary-label">hallazgos</span>
            <strong className="stage-summary-value">{inputSummary.findings}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="stage-summary-label">críticos</span>
            <strong className="stage-summary-value stage-summary-value--critical">{inputSummary.critical}</strong>
          </div>
          <div className="stage-summary-item">
            <span className="stage-summary-label">advertencias</span>
            <strong className="stage-summary-value stage-summary-value--warning">{inputSummary.warning}</strong>
          </div>
        </div>

        <div className={`privacy-notice ${isCloud ? 'privacy-notice--cloud' : 'privacy-notice--local'}`}>
          {isCloud ? (
            <>
              <Globe size={14} />
              <div>
                <strong>Cloud</strong>
                <p>Se envía el paquete estructurado, no el archivo completo.</p>
              </div>
            </>
          ) : (
            <>
              <Lock size={14} />
              <div>
                <strong>Local-first</strong>
                <p>Diagnóstico en el navegador. Sin envío de datos.</p>
              </div>
            </>
          )}
        </div>

        <div className="diagnosis-model-bar">
          <div className="model-type-toggle" style={{ flex: 'none' }}>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'local' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('local')}
            >
              Local
            </button>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'cloud' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('cloud')}
            >
              Cloud
            </button>
          </div>
          <select
            className="model-select"
            value={aiConfig.model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {availableModels.length === 0 && (
              <option disabled>Sin modelos disponibles</option>
            )}
            {availableModels.map(model => {
              return (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              );
            })}
          </select>
          <button
            className="btn-p"
            onClick={runDiagnosis}
            disabled={isLoading || providerAvailable === false}
            title={providerAvailable === false ? 'Proveedor no disponible' : 'Ejecutar diagnóstico asistido'}
          >
            <Brain size={14} />
            {isLoading ? 'Diagnosticando' : hasDiagnosis ? 'Regenerar diagnóstico' : 'Generar diagnóstico'}
          </button>
        </div>

        {aiConfig.providerType === 'local' && currentModelStatus && (
          <div className="local-model-status" data-testid="local-model-status">
            <div className={`local-model-status-badge local-model-status-badge--${currentModelStatus.status}`}>
              {currentModelStatus.status === 'ready' && <CheckCircle size={12} />}
              {currentModelStatus.status === 'partial' && <AlertTriangle size={12} />}
              {currentModelStatus.status === 'not_downloaded' && <Circle size={12} />}
              {currentModelStatus.status === 'error' && <AlertCircle size={12} />}
              {currentModelStatus.status === 'checking' && <Clock size={12} />}
              <span className="local-model-status-label">
                {currentModelStatus.status === 'ready' && 'Verificado y listo'}
                {currentModelStatus.status === 'partial' && 'No verificado'}
                {currentModelStatus.status === 'not_downloaded' && 'No descargado'}
                {currentModelStatus.status === 'error' && 'Error de descarga'}
                {currentModelStatus.status === 'checking' && 'Verificando...'}
              </span>
              <span className="local-model-status-confidence">
                {currentModelStatus.confidence === 'high' ? 'Alta confianza' : currentModelStatus.confidence === 'medium' ? 'Confianza media' : 'Baja confianza'}
              </span>
            </div>
            <p className="local-model-status-message">{currentModelStatus.message}</p>
            <div className="local-model-status-actions">
              <button className="btn-s btn-sm" onClick={() => checkCurrentModelStatus(aiConfig.model)} disabled={isCheckingModel}>
                <Activity size={10} /> {isCheckingModel ? 'Verificando' : 'Verificar estado'}
              </button>
              {currentModelStatus.status !== 'ready' && (
                <button className="btn-p btn-sm" onClick={() => runDiagnosis()} disabled={isLoading}>
                  <Play size={10} /> Descargar y diagnosticar
                </button>
              )}
              {(currentModelStatus.status === 'partial' || currentModelStatus.status === 'error') && (
                <button className="btn-s btn-sm" onClick={() => handleDeleteModel(aiConfig.model)} disabled={deletingModel === aiConfig.model}>
                  <Trash2 size={10} /> {deletingModel === aiConfig.model ? 'Eliminando...' : 'Limpiar y reintentar'}
                </button>
              )}
            </div>
          </div>
        )}

        {aiConfig.providerType === 'local' && !currentModelStatus && !isCheckingModel && (
          <p className="local-model-status-placeholder">Verifica el estado del modelo local antes de diagnosticar.</p>
        )}

        {progressStatus !== 'idle' && (
          <ProgressDisclosure
            title={progressStatus === 'running' ? 'AURA está trabajando' : progressStatus === 'success' ? 'Diagnóstico completado' : 'Diagnóstico fallido'}
            description={aiConfig.providerType === 'local' ? 'El modelo local puede tardar la primera vez. No cierres esta pestaña.' : undefined}
            value={progressValue}
            indeterminate={progressIndeterminate}
            status={progressStatus}
            currentStep={progressStep}
            compact={progressStatus !== 'running'}
          />
        )}

        {isLoading && (
          <div className="diagnosis-loading">
            <span className="pulse-dot" />
            Generando diagnóstico con {aiConfig.model}...
          </div>
        )}

        {diagnosisEvents.length > 0 && (
          <div className={`diagnosis-activity-console ${showActivityConsole ? 'diagnosis-activity-console--expanded' : 'diagnosis-activity-console--collapsed'}`} data-testid="diagnosis-activity-console">
            <button
              className="diagnosis-activity-toggle"
              onClick={() => setShowActivityConsole(!showActivityConsole)}
            >
              <Activity size={12} />
              <span>Actividad de AURA ({diagnosisEvents.length} eventos)</span>
              <ChevronDown size={12} className={`activity-console-chevron ${showActivityConsole ? 'activity-console-chevron--open' : ''}`} />
            </button>
            {showActivityConsole && (
              <div className="diagnosis-activity-events">
                {diagnosisEvents.map((event, i) => (
                  <div key={i} className={`activity-event activity-event--${event.level}`}>
                    <span className="activity-event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span className="activity-event-icon">
                      {event.level === 'info' && <Circle size={8} />}
                      {event.level === 'success' && <CheckCircle size={8} />}
                      {event.level === 'warning' && <AlertTriangle size={8} />}
                      {event.level === 'error' && <AlertCircle size={8} />}
                    </span>
                    <span className="activity-event-message">{event.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {providerAvailable === false && (
          <div className="provider-unavailable-notice">
            <div className="provider-unavailable-header">
              <ShieldAlert size={16} style={{ color: 'var(--orange)' }} />
              <strong>Proveedor no disponible</strong>
            </div>
            <ul className="provider-unavailable-reasons">
              {aiConfig.providerType === 'cloud' && !aiConfig.apiKey && (
                <li>No hay API key configurada. Agrégala en Configuración.</li>
              )}
              {aiConfig.providerType === 'cloud' && aiConfig.apiKey && (
                <li>El proveedor cloud no responde. Verifica la API key.</li>
              )}
              {aiConfig.providerType === 'local' && (
                <li>WebGPU o modelo local no disponible. Requiere Chrome/Edge con soporte WebGPU.</li>
              )}
            </ul>
            <div className="provider-unavailable-actions">
              <p><strong>Puedes continuar con script determinista.</strong> El motor de reglas no depende del LLM.</p>
            </div>
          </div>
        )}

        {error && normalizedError && (
          <div className="provider-error-notice">
            <div className="provider-error-header">
              <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
              <strong style={{ color: 'var(--error)' }}>{normalizedError.title}</strong>
            </div>
            <p className="provider-error-cause">Causa probable: {normalizedError.cause}</p>
            <div className="provider-error-actions">
              <button className="btn-s btn-sm" onClick={() => onOpenSettings?.()}>
                <Settings size={12} /> Abrir Configuración
              </button>
              {aiConfig.providerType === 'local' && (
                <button
                  className="btn-s btn-sm"
                  onClick={async () => {
                    await deleteDownloadedModel(aiConfig.model);
                    clearPreloadVerification(aiConfig.model);
                    setCurrentModelStatus({
                      status: 'not_downloaded',
                      confidence: 'high',
                      source: 'unknown',
                      message: 'Modelo eliminado del caché.',
                    });
                  }}
                >
                  <Trash2 size={12} /> Limpiar modelo cacheado
                </button>
              )}
              <button className="btn-s btn-sm" onClick={onContinue}>
                <Play size={12} /> Continuar sin diagnóstico
              </button>
            </div>
          </div>
        )}

        {hasDiagnosis && !isLoading && (
          <div className="stage-result">
            <h3 className="stage-result-title">Resumen de AURA</h3>
            <GeminiAdvisor
              analysis={draftAnalysis}
              isLoading={isLoading}
              providerType={aiConfig.providerType as 'local' | 'cloud'}
              model={aiConfig.model}
            />
            {lastMetrics && (
              <div className="stage-result-metrics">
                <span>{(lastMetrics.latencyMs / 1000).toFixed(1)}s</span>
                <span>{lastMetrics.tokensGenerated} tokens</span>
              </div>
            )}
          </div>
        )}

        {hasDiagnosis && (
          <div className="evidence-options" data-testid="primary-stage-action">
            <button className="btn-s btn-sm" onClick={exportDiagnosisPdf}>
              <FileText size={12} /> PDF consolidado
            </button>
            <button className="btn-s btn-sm" onClick={exportDiagnosisJson}>
              <FileJson size={12} /> JSON consolidado
            </button>
            <button className="btn-p btn-sm" onClick={onContinue}>
              Continuar a propuesta <Play size={12} />
            </button>
          </div>
        )}
      </section>

      <details className="technical-details" data-testid="technical-details">
        <summary className="technical-details-summary">
          <ChevronDown size={14} className="technical-details-chevron" />
          <span>Detalles técnicos</span>
          <span className="technical-details-hint">modelo, paquete estructurado, contrato y calibración</span>
        </summary>
        <div className="technical-details-body">

          {aiConfig.providerType === 'local' && Object.keys(modelStatuses).length > 0 && (
            <div className="downloaded-models-list">
              <div className="downloaded-models-header">
                <HardDrive size={10} />
                <span>Modelos locales ({Object.keys(modelStatuses).length} evaluados)</span>
              </div>
              {Object.entries(modelStatuses).map(([modelId]) => {
                const modelInfo = LOCAL_MODELS.find(m => m.id === modelId);
                if (!modelInfo) return null;
                const status = modelStatuses[modelId];
                return (
                  <div key={modelId} className="downloaded-model-item">
                    <span className="downloaded-model-name">{modelInfo.name}</span>
                    <span className="downloaded-model-size">{modelInfo.sizeGB} GB</span>
                    <span className={`downloaded-model-badge downloaded-model-badge--${status?.status || 'unknown'}`}>
                      {status?.status === 'ready' ? 'Verificado' : status?.status === 'partial' ? 'Parcial' : status?.status === 'not_downloaded' ? 'Sin descargar' : 'Error'}
                    </span>
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

          {onOpenLab && (
            <div className="lab-cta-strip">
              <FlaskConical size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
              <span>Calibrar diagnóstico en Laboratorio</span>
              <button className="btn-s btn-sm" onClick={onOpenLab}>Abrir</button>
            </div>
          )}

          <div className="smart-sample-section">
            <button
              className="btn-s btn-sm"
              onClick={() => setShowEvidence(!showEvidence)}
            >
              {showEvidence ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {showEvidence ? 'Ocultar paquete estructurado' : 'Ver paquete estructurado'}
            </button>
            {showEvidence && (
              <div className="smart-sample-viewer">
                <div className="smart-sample-header">
                  <div className="smart-sample-title">
                    <FileCode2 size={14} />
                    <span>PAQUETE ESTRUCTURADO</span>
                  </div>
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
          </div>

        </div>
      </details>

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
