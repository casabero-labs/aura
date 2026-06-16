import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Database, Play, FlaskConical, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Trash2, HardDrive, X, AlertTriangle, ShieldAlert, ListChecks, FileJson, FileText, Settings, Activity, CheckCircle, Circle, Clock, AlertCircle, Server, Shield, Eye, EyeOff, Download } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import ProgressDisclosure from './ProgressDisclosure';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics, LocalModelStatus, DiagnosisEvent, ProviderProgressEvent, ProgressDisclosureStatus } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS, LOCAL_MODELS, getLocalModelStatus, markPreloadVerified, clearPreloadVerification, deleteDownloadedModel, getChromeAiDiagnostic } from '../services/aiProvider';
import { recordLlmCall, computePromptHash, computeInputHash } from '../services/llmAuditLog';
import { normalizeAiProviderError, NormalizedProviderError } from '../services/providers/errors';
import { detectChromeAiAvailability, NormalizedAvailability, getStatusDescription } from '../services/chromeAvailability';
import { startNetworkMonitoring, stopNetworkMonitoring, NetworkGuardResult } from '../services/networkGuard';
import { generateQuickReceipt, PrivacyReceipt } from '../services/privacyReceipt';

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
  
  // Chrome AI guided UX states
  const [chromeAvailability, setChromeAvailability] = useState<NormalizedAvailability | null>(null);
  const [isCheckingChrome, setIsCheckingChrome] = useState(false);
  const [isPreparingChrome, setIsPreparingChrome] = useState(false);
  const [chromeDownloadProgress, setChromeDownloadProgress] = useState<number | undefined>(undefined);
  const [chromeDownloadMessage, setChromeDownloadMessage] = useState<string>('');
  const [privacyReceipt, setPrivacyReceipt] = useState<PrivacyReceipt | null>(null);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [networkResult, setNetworkResult] = useState<NetworkGuardResult | null>(null);

  const pushEvent = useCallback((level: DiagnosisEvent['level'], message: string) => {
    const event: DiagnosisEvent = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    setDiagnosisEvents(prev => [...prev, event]);
  }, []);

  const checkCurrentModelStatus = useCallback(async (modelId: string) => {
    if (aiConfig.providerType !== 'webllm_experimental') {
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

  const checkChromeAiAvailability = useCallback(async () => {
    setIsCheckingChrome(true);
    try {
      const availability = await detectChromeAiAvailability();
      setChromeAvailability(availability);
      pushEvent('info', `Chrome AI: ${availability.message}`);
    } catch (error) {
      pushEvent('error', `Error verificando Chrome AI: ${(error as Error).message}`);
    } finally {
      setIsCheckingChrome(false);
    }
  }, [pushEvent]);

  const prepareChromeAi = useCallback(async () => {
    if (!chromeAvailability || chromeAvailability.status !== 'downloadable') return;
    
    setIsPreparingChrome(true);
    setChromeDownloadProgress(0);
    setChromeDownloadMessage('Iniciando descarga de Gemini Nano...');
    
    try {
      // Start network monitoring
      startNetworkMonitoring();
      
      // Create session with download monitor
      const session = await (aiProvider as any).createSession((progress: number, message: string) => {
        setChromeDownloadProgress(progress);
        setChromeDownloadMessage(message);
      });
      
      // Stop network monitoring
      const networkGuardResult = stopNetworkMonitoring();
      setNetworkResult(networkGuardResult);
      
      // Generate privacy receipt (placeholder data - in real usage would be actual dataset)
      const placeholderData = [['placeholder']];
      const placeholderColumns = ['column'];
      const receipt = await generateQuickReceipt(placeholderData, placeholderColumns, networkGuardResult!, chromeAvailability);
      setPrivacyReceipt(receipt);
      
      // Re-check availability
      const newAvailability = await detectChromeAiAvailability();
      setChromeAvailability(newAvailability);
      
      pushEvent('success', 'Gemini Nano preparado correctamente');
    } catch (error) {
      pushEvent('error', `Error preparando Gemini Nano: ${(error as Error).message}`);
      setChromeDownloadMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsPreparingChrome(false);
    }
  }, [chromeAvailability, aiProvider, pushEvent]);

  const handleProviderTypeChange = (type: 'chrome' | 'ollama' | 'cloud') => {
    const defaults: Record<string, string> = {
      chrome: 'gemini-nano',
      ollama: 'qwen2.5:3b',
      cloud: aiConfig.cloudProvider === 'google'
        ? 'gemini-2.5-flash'
        : (AVAILABLE_MODELS.cloud[0]?.id || 'gemini-2.5-flash'),
    };
    onAiConfigChange({
      ...aiConfig,
      providerType: type,
      model: defaults[type] || aiConfig.model,
      cloudProvider: type === 'cloud' ? (aiConfig.cloudProvider || 'google') : undefined,
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

  const availableModels = aiConfig.providerType === 'chrome'
    ? [{ id: 'gemini-nano', name: 'Gemini Nano (Chrome Built-in)', provider: 'Chrome AI' }]
    : aiConfig.providerType === 'ollama'
    ? [{ id: aiConfig.model, name: aiConfig.model, family: 'Ollama' }]
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
      if (aiConfig.providerType === 'webllm_experimental') {
        pushEvent('info', 'Verificando proveedor local (WebGPU)...');
        setProgressStep('Descargando o cargando modelo local');
      } else if (aiConfig.providerType === 'ollama') {
        pushEvent('info', 'Verificando conexión con Ollama...');
        setProgressStep('Conectando con Ollama local');
      } else if (aiConfig.providerType === 'chrome') {
        pushEvent('info', 'Verificando disponibilidad de Chrome AI...');
        setProgressStep('Preparando Chrome AI / Gemini Nano');
        
        // Start network monitoring for privacy receipt
        startNetworkMonitoring();
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

      // Generate privacy receipt for Chrome AI
      if (aiConfig.providerType === 'chrome') {
        const networkGuardResult = stopNetworkMonitoring();
        setNetworkResult(networkGuardResult);
        
        const availability = await detectChromeAiAvailability();
        const placeholderData = [['placeholder']];
        const placeholderColumns = ['column'];
        const receipt = await generateQuickReceipt(placeholderData, placeholderColumns, networkGuardResult!, availability);
        setPrivacyReceipt(receipt);
      }

      setProgressValue(100);
      setProgressIndeterminate(false);
      pushEvent('success', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${(metrics.latencyMs / 1000).toFixed(1)}s`);
      setProgressStep(`Diagnóstico completado · ${(metrics.latencyMs / 1000).toFixed(1)}s`);
      setProgressStatus('success');
      onLog?.('diagnosis', `Diagnóstico completado · ${metrics.tokensGenerated} tokens · ${metrics.latencyMs}ms`);

      if (aiConfig.providerType === 'webllm_experimental') {
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
        providerType: aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama',
        provider: aiConfig.providerType === 'webllm_experimental' ? 'WebLLM' : aiConfig.providerType === 'ollama' ? 'Ollama' : aiConfig.providerType === 'chrome' ? 'Chrome AI' : (aiConfig.cloudProvider || 'Cloud'),
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
        providerType: aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama',
        provider: aiConfig.providerType === 'webllm_experimental' ? 'WebLLM' : aiConfig.providerType === 'ollama' ? 'Ollama' : aiConfig.providerType === 'chrome' ? 'Chrome AI' : (aiConfig.cloudProvider || 'Cloud'),
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
  const isOllama = aiConfig.providerType === 'ollama';
  const isChrome = aiConfig.providerType === 'chrome';
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
          ) : isOllama ? (
            <>
              <Server size={14} />
              <div>
                <strong>Ollama local</strong>
                <p>Inferencia en tu máquina. Sin envío externo de datos.</p>
              </div>
            </>
          ) : (
            <>
              <Lock size={14} />
              <div>
                <strong>{isChrome ? 'Chrome AI' : 'Local'}</strong>
                <p>Diagnóstico en el navegador. Sin envío de datos.</p>
              </div>
            </>
          )}
        </div>

        <div className="diagnosis-model-bar">
          <div className="model-type-toggle" style={{ flex: 'none' }}>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'chrome' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('chrome')}
              title="Chrome AI / Gemini Nano"
            >
              Chrome AI
            </button>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'ollama' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('ollama')}
              title="Ollama local"
            >
              Ollama
            </button>
            <button
              className={`model-type-btn ${aiConfig.providerType === 'cloud' ? 'active' : ''}`}
              onClick={() => handleProviderTypeChange('cloud')}
            >
              Cloud
            </button>
          </div>
          {aiConfig.providerType === 'ollama' ? (
            <input
              type="text"
              className="settings-input"
              value={aiConfig.model}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder="qwen2.5:3b"
              style={{ flex: 1, minWidth: 120 }}
            />
          ) : (
            <select
              className="model-select"
              value={aiConfig.model}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {availableModels.length === 0 && (
                <option disabled>Sin modelos disponibles</option>
              )}
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          )}
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

        {aiConfig.providerType === 'webllm_experimental' && currentModelStatus && (
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

        {aiConfig.providerType === 'webllm_experimental' && !currentModelStatus && !isCheckingModel && (
          <p className="local-model-status-placeholder">Verifica el estado del modelo local antes de diagnosticar.</p>
        )}

        {progressStatus !== 'idle' && (
          <ProgressDisclosure
            title={progressStatus === 'running' ? 'AURA está trabajando' : progressStatus === 'success' ? 'Diagnóstico completado' : 'Diagnóstico fallido'}
            description={aiConfig.providerType === 'chrome' ? 'Chrome puede descargar Gemini Nano la primera vez. No cierres esta pestaña.' : undefined}
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
              {aiConfig.providerType === 'chrome' && (
                <>
                  <li><strong>Chrome AI (Gemini Nano)</strong> no está disponible en este navegador.</li>
                  <li style={{ marginTop: 'var(--space-sm)' }}>
                    <strong>Para activarlo:</strong>
                    <ol style={{ margin: '4px 0 0 16px', fontSize: '13px', lineHeight: 1.7 }}>
                      <li>Verifica que uses Chrome 138 o superior.</li>
                      <li>Abre <code>chrome://flags</code> en una pestaña nueva.</li>
                      <li>Busca "Prompt API", "Gemini Nano" o "Built-in AI".</li>
                      <li>Activa las opciones y reinicia Chrome.</li>
                    </ol>
                  </li>
                  <li style={{ marginTop: 'var(--space-sm)', fontSize: '12px', color: 'var(--ink3)' }}>
                    También puedes revisar <code>chrome://on-device-internals</code> para ver modelos disponibles.
                  </li>
                </>
              )}
              {aiConfig.providerType === 'ollama' && (
                <li>Ollama no responde en {aiConfig.ollamaBaseUrl || 'http://localhost:11434'}. Verifica que Ollama esté abierto y que CORS esté configurado.</li>
              )}
              {aiConfig.providerType === 'webllm_experimental' && (
                <li>WebGPU o modelo local no disponible. Requiere Chrome/Edge con soporte WebGPU.</li>
              )}
            </ul>
            <div className="provider-unavailable-actions">
              {aiConfig.providerType === 'chrome' && (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                  <button className="btn-s btn-sm" onClick={async () => {
                    await getChromeAiDiagnostic();
                    aiProvider.isAvailable().then((avail) => setProviderAvailable(avail)).catch(() => setProviderAvailable(false));
                  }}>
                    <Activity size={12} /> Verificar Chrome AI
                  </button>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('ollama')}>
                    <Server size={12} /> Usar Ollama
                  </button>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('cloud')}>
                    <Globe size={12} /> Usar Cloud
                  </button>
                </div>
              )}
              <p><strong>Puedes continuar con script determinista.</strong> El motor de reglas no depende del LLM.</p>
              <button className="btn-s btn-sm" onClick={onContinue} style={{ marginTop: 'var(--space-sm)' }}>
                <Play size={12} /> Continuar sin diagnóstico
              </button>
            </div>
          </div>
        )}

        {/* Chrome AI Guided UX Section */}
        {aiConfig.providerType === 'chrome' && (
          <div className="chrome-ai-guided-section" data-testid="chrome-ai-guided-section">
            <div className="chrome-ai-header">
              <Brain size={16} />
              <h3>Chrome AI / Gemini Nano</h3>
            </div>
            
            <p className="chrome-ai-description">
              Chrome AI ejecuta Gemini Nano en el navegador. AURA no envía tu dataset a servidores externos mientras este modo esté activo.
            </p>

            {/* Verification Section */}
            <div className="chrome-ai-verification">
              <div className="chrome-ai-status-row">
                <span className="chrome-ai-status-label">Estado:</span>
                {chromeAvailability ? (
                  <span className={`chrome-ai-status-badge chrome-ai-status-badge--${getStatusDescription(chromeAvailability.status).color}`}>
                    {getStatusDescription(chromeAvailability.status).icon} {getStatusDescription(chromeAvailability.status).label}
                  </span>
                ) : (
                  <span className="chrome-ai-status-badge chrome-ai-status-badge--info">?</span>
                )}
              </div>

              <div className="chrome-ai-actions">
                <button 
                  className="btn-s btn-sm" 
                  onClick={checkChromeAiAvailability}
                  disabled={isCheckingChrome}
                >
                  {isCheckingChrome ? (
                    <>
                      <Activity size={12} className="spinning" /> Verificando...
                    </>
                  ) : (
                    <>
                      <Eye size={12} /> Verificar navegador
                    </>
                  )}
                </button>

                {chromeAvailability?.status === 'downloadable' && (
                  <button 
                    className="btn-p btn-sm" 
                    onClick={prepareChromeAi}
                    disabled={isPreparingChrome}
                  >
                    {isPreparingChrome ? (
                      <>
                        <Activity size={12} className="spinning" /> Descargando...
                      </>
                    ) : (
                      <>
                        <Download size={12} /> Preparar Gemini Nano
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Download Progress */}
            {isPreparingChrome && (
              <div className="chrome-ai-download-progress">
                <div className="chrome-ai-download-bar">
                  <div 
                    className="chrome-ai-download-fill" 
                    style={{ width: `${chromeDownloadProgress || 0}%` }}
                  />
                </div>
                <span className="chrome-ai-download-message">{chromeDownloadMessage}</span>
                <p className="chrome-ai-download-note">
                  La primera preparación puede requerir descarga del modelo por Chrome. No cierres esta pestaña.
                </p>
              </div>
            )}

            {/* Technical Details Accordion */}
            {chromeAvailability && (
              <details className="chrome-ai-details">
                <summary className="chrome-ai-details-summary">
                  <ChevronDown size={14} />
                  <span>Detalles técnicos</span>
                </summary>
                <div className="chrome-ai-details-content">
                  <div className="chrome-ai-detail-row">
                    <span>API Surface:</span>
                    <span>{chromeAvailability.apiSurface}</span>
                  </div>
                  <div className="chrome-ai-detail-row">
                    <span>Estado normalizado:</span>
                    <span>{chromeAvailability.status}</span>
                  </div>
                  {chromeAvailability.browserInfo && (
                    <>
                      <div className="chrome-ai-detail-row">
                        <span>Plataforma:</span>
                        <span>{chromeAvailability.browserInfo.platform}</span>
                      </div>
                      {chromeAvailability.browserInfo.chromeVersion && (
                        <div className="chrome-ai-detail-row">
                          <span>Versión Chrome:</span>
                          <span>{chromeAvailability.browserInfo.chromeVersion}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="chrome-ai-technical-details">
                    <h4>Detalles técnicos:</h4>
                    <ul>
                      {chromeAvailability.technicalDetails.map((detail, i) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            )}

            {/* Privacy Receipt Section */}
            {privacyReceipt && (
              <div className="chrome-ai-privacy-receipt">
                <div className="chrome-ai-privacy-header">
                  <Shield size={14} />
                  <span>Recibo de Privacidad</span>
                  <button 
                    className="btn-s btn-xs"
                    onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                  >
                    {showPrivacyDetails ? <EyeOff size={10} /> : <Eye size={10} />}
                    {showPrivacyDetails ? 'Ocultar' : 'Ver detalles'}
                  </button>
                </div>
                
                <p className="chrome-ai-privacy-statement">
                  {privacyReceipt.dataset_sent_to_cloud === false && privacyReceipt.raw_dataset_sent === false ? (
                    <>
                      <CheckCircle size={12} style={{ color: 'var(--green)' }} />
                      AURA no realizó conexiones externas durante el diagnóstico. Todos los datos permanecen en tu dispositivo.
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} style={{ color: 'var(--orange)' }} />
                      Se detectaron conexiones externas. Estas conexiones no son controladas por AURA.
                    </>
                  )}
                </p>

                {showPrivacyDetails && (
                  <div className="chrome-ai-privacy-details">
                    <div className="chrome-ai-privacy-row">
                      <span>Proveedor:</span>
                      <span>{privacyReceipt.provider}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Modo:</span>
                      <span>{privacyReceipt.mode}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Dataset enviado a la nube:</span>
                      <span>{privacyReceipt.dataset_sent_to_cloud ? 'Sí' : 'No'}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Dataset crudo enviado:</span>
                      <span>{privacyReceipt.raw_dataset_sent ? 'Sí' : 'No'}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Alcance del prompt:</span>
                      <span>{privacyReceipt.prompt_scope}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Hash SHA-256:</span>
                      <span className="chrome-ai-hash">{privacyReceipt.dataset_sha256.substring(0, 16)}...</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Filas:</span>
                      <span>{privacyReceipt.rows}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Columnas:</span>
                      <span>{privacyReceipt.columns}</span>
                    </div>
                    <div className="chrome-ai-privacy-row">
                      <span>Solicitudes externas de AURA:</span>
                      <span>{privacyReceipt.outbound_requests_from_aura}</span>
                    </div>
                    {privacyReceipt.external_requests_detected.length > 0 && (
                      <div className="chrome-ai-external-requests">
                        <h4>Solicitudes externas detectadas:</h4>
                        <ul>
                          {privacyReceipt.external_requests_detected.map((req, i) => (
                            <li key={i}>{req.type} a {req.url}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fallback Options */}
            <div className="chrome-ai-fallback-options">
              <p className="chrome-ai-fallback-text">
                <strong>Puedes continuar con script determinista.</strong> El motor de reglas no depende del LLM.
              </p>
              <div className="chrome-ai-fallback-buttons">
                <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('ollama')}>
                  <Server size={12} /> Usar Ollama
                </button>
                <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('cloud')}>
                  <Globe size={12} /> Usar Cloud
                </button>
                <button className="btn-s btn-sm" onClick={onContinue}>
                  <Play size={12} /> Continuar sin diagnóstico
                </button>
              </div>
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
              {aiConfig.providerType === 'webllm_experimental' && (
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
              providerType={aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama'}
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

          {aiConfig.providerType === 'webllm_experimental' && Object.keys(modelStatuses).length > 0 && (
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
