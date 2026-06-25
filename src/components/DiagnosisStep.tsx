import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Database, Play, FlaskConical, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Trash2, HardDrive, X, AlertTriangle, ShieldAlert, ListChecks, FileJson, FileText, Settings, Activity, CheckCircle, Circle, Clock, AlertCircle, Server, Shield, Eye, EyeOff, Download, RefreshCw } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import ProgressDisclosure from './ProgressDisclosure';
import ChromeAiStatusPanel from './ChromeAiStatusPanel';
import { DiagnosisHeroPanel, DiagnosisProviderPanel, DiagnosisContractPanel, TechnicalEvidencePanel } from './diagnosis';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics, LocalModelStatus, DiagnosisEvent, ProviderProgressEvent, ProgressDisclosureStatus, InputMode } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS, LOCAL_MODELS, getLocalModelStatus, markPreloadVerified, clearPreloadVerification, deleteDownloadedModel, getChromeAiDiagnostic } from '../services/aiProvider';
import { recordLlmCall, computePromptHash, computeInputHash } from '../services/llmAuditLog';
import { normalizeAiProviderError, NormalizedProviderError } from '../services/providers/errors';
import { detectChromeAiAvailability, NormalizedAvailability } from '../services/chromeAvailability';
import { startNetworkMonitoring, stopNetworkMonitoring, NetworkGuardResult } from '../services/networkGuard';
import { generateQuickReceipt, PrivacyReceipt } from '../services/privacyReceipt';
import { runStructuredDiagnosis, isContractsV2Enabled, type DiagnosisExecutionResult } from '../contracts/llm';

interface DiagnosisStepProps {
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  analysisText: string;
  onAiConfigChange: (config: AIConfig) => void;
  onAnalysisComplete: (analysis: string) => void;
  onStructuredDiagnosisComplete?: (result: DiagnosisExecutionResult) => void;
  onMetrics?: (metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
  onOpenLab?: () => void;
  onOpenSettings?: () => void;
}

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

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
  report,
  auditEvidence,
  aiConfig,
  aiProvider,
  analysisText,
  onAiConfigChange,
  onAnalysisComplete,
  onStructuredDiagnosisComplete,
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
  const [structuredDiagnosis, setStructuredDiagnosis] = useState<DiagnosisExecutionResult | null>(null);
  
  // Chrome AI guided UX states
  const [chromeAvailability, setChromeAvailability] = useState<NormalizedAvailability | null>(null);
  const [isCheckingChrome, setIsCheckingChrome] = useState(false);
  const [isPreparingChrome, setIsPreparingChrome] = useState(false);
  const [chromeDownloadProgress, setChromeDownloadProgress] = useState<number | undefined>(undefined);
  const [chromeDownloadMessage, setChromeDownloadMessage] = useState<string>('');
  const [privacyReceipt, setPrivacyReceipt] = useState<PrivacyReceipt | null>(null);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [networkResult, setNetworkResult] = useState<NetworkGuardResult | null>(null);
  const [isTechnicalEvidenceOpen, setIsTechnicalEvidenceOpen] = useState(false);

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
    if (!draftAnalysis.trim() && !structuredDiagnosis) return;
    if (structuredDiagnosis) {
      downloadTextFile(
        `aura_diagnostico_estructurado_v2_${Date.now()}.json`,
        JSON.stringify(structuredDiagnosis, null, 2),
        'application/json;charset=utf-8',
      );
      return;
    }
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
    if (!draftAnalysis.trim() && !structuredDiagnosis) return;
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
    if (structuredDiagnosis) {
      draw(`Diagnosis v2 · responseId: ${structuredDiagnosis.diagnosis.responseId}`, 8, 5);
    } else {
      draw(`Prompt hash: ${computePromptHash(diagnosisPrompt)}`, 8, 5);
    }
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

    if (structuredDiagnosis) {
      doc.setFont('helvetica', 'bold');
      draw('3. Diagnostico Estructurado v2', 11, 6);
      doc.setFont('helvetica', 'normal');
      structuredDiagnosis.diagnosis.diagnosisBlocks.slice(0, 8).forEach((block, index) => {
        draw(`${index + 1}. [${block.ruleId}] ${block.observation}`, 8, 4);
        draw(`   Recomendacion: ${block.recommendation}`, 8, 4);
      });
      if (structuredDiagnosis.diagnosis.limitations.length > 0) {
        y += 2;
        doc.setFont('helvetica', 'bold');
        draw('Limitaciones:', 9, 4);
        doc.setFont('helvetica', 'normal');
        structuredDiagnosis.diagnosis.limitations.forEach((lim) => {
          draw(`- ${lim}`, 8, 4);
        });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      draw('3. Diagnostico LLM generado', 11, 6);
      doc.setFont('helvetica', 'normal');
      draw(draftAnalysis.replace(/[#*_`]/g, ''), 9, 5);
    }
    doc.save(`aura_reporte_perfil_diagnostico_${Date.now()}.pdf`);
  };

  const checkChromeAiAvailability = useCallback(async () => {
    setIsCheckingChrome(true);
    setError(null);
    setNormalizedError(null);
    setProviderAvailable(null);
    
    // Clear any cached Chrome AI status from storage
    try {
      localStorage.removeItem('chrome-ai-status');
      localStorage.removeItem('chrome-ai-availability');
      sessionStorage.removeItem('chrome-ai-status');
      sessionStorage.removeItem('chrome-ai-availability');
    } catch {
      // Ignore storage errors
    }
    
    try {
      const availability = await detectChromeAiAvailability();
      setChromeAvailability(availability);
      setProviderAvailable(availability.status === 'ready');
      pushEvent('info', `Chrome AI: ${availability.message}`);
      
      // Log technical details for debugging
      availability.technicalDetails.forEach(detail => {
        pushEvent('info', detail);
      });
    } catch (error) {
      pushEvent('error', `Error verificando Chrome AI: ${(error as Error).message}`);
      setProviderAvailable(false);
    } finally {
      setIsCheckingChrome(false);
    }
  }, [pushEvent]);

  const prepareChromeAi = useCallback(async () => {
    setIsPreparingChrome(true);
    setChromeDownloadProgress(0);
    setChromeDownloadMessage('Iniciando descarga de Gemini Nano...');
    
    try {
      startNetworkMonitoring();
      
      if (aiProvider.preloadModel) {
        await aiProvider.preloadModel((progress, message) => {
          setChromeDownloadProgress(progress);
          setChromeDownloadMessage(message);
        });
      }
      
      const networkGuardResult = stopNetworkMonitoring();
      setNetworkResult(networkGuardResult);
      
      const availability = await detectChromeAiAvailability();
      const placeholderData = [['placeholder']];
      const placeholderColumns = ['column'];
      const receipt = await generateQuickReceipt(placeholderData, placeholderColumns, networkGuardResult!, availability);
      setPrivacyReceipt(receipt);
      
      pushEvent('success', 'Gemini Nano preparado correctamente');
    } catch (error) {
      pushEvent('error', `Error preparando Gemini Nano: ${(error as Error).message}`);
      setChromeDownloadMessage(`Error: ${(error as Error).message}`);
    } finally {
      setIsPreparingChrome(false);
    }
  }, [aiProvider, pushEvent]);

  const handleProviderTypeChange = (type: 'chrome' | 'ollama' | 'cloud' | 'webllm_experimental') => {
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

  const handleInputModeChange = (inputMode: InputMode) => {
    onAiConfigChange({
      ...aiConfig,
      inputMode,
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
      if (isContractsV2Enabled()) {
        pushEvent('info', 'Iniciando Diagnosis v2 (contrato estructurado)...');
        setProgressStep('Preparando Diagnosis v2');

        let chromeMonitoringStarted = false;

        try {
          if (aiConfig.providerType === 'chrome') {
            startNetworkMonitoring();
            chromeMonitoringStarted = true;
          }

          const v2Result = await runStructuredDiagnosis(report as any, {
            provider: aiProvider,
            auditEvidence: auditEvidence ? { datasetFingerprint: auditEvidence.datasetFingerprint } : null,
            onProgress: (event) => {
              pushEvent(event.type === 'chunk' ? 'info' : 'info', event.text);
            },
          });

          if (!v2Result.success) {
            const v2Failure = v2Result as { success: false; code: string; message: string; path: string; details: Record<string, unknown> };
            const normalized = normalizeAiProviderError(new Error(v2Failure.message), aiConfig);
            setError(v2Failure.message);
            setNormalizedError(normalized);
            pushEvent('error', `Diagnosis v2 fallido: ${v2Failure.code}`);
            setProgressStatus('error');
            setProgressStep(`Error: ${v2Failure.code}`);
            recordLlmCall({
              callType: 'diagnosis',
              providerType: aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama',
              provider: aiConfig.providerType === 'webllm_experimental' ? 'WebLLM' : aiConfig.providerType === 'ollama' ? 'Ollama' : aiConfig.providerType === 'chrome' ? 'Chrome AI' : (aiConfig.cloudProvider || 'Cloud'),
              model: aiConfig.model,
              temperature: aiConfig.temperature,
              promptHash: '',
              promptText: '',
              inputJsonHash: computeInputHash(report),
              promptLength: 0,
              inputColumnCount: report.colCount,
              inputIssueCount: report.issues.length,
              rowCount: report.rowCount,
              colCount: report.colCount,
              datasetFingerprint: auditEvidence?.datasetFingerprint || '',
              responseLength: 0,
              latencyMs: (v2Failure.details?.latencyMs as number) ?? 0,
              tokensGenerated: 0,
              status: 'error',
              error: v2Failure.message,
            });
          } else {
            setStructuredDiagnosis(v2Result.result);
            setLastMetrics(v2Result.result.metrics as ProviderMetrics);
            onMetrics?.(v2Result.result.metrics as ProviderMetrics);
            onStructuredDiagnosisComplete?.(v2Result.result);
            pushEvent('success', `Diagnosis v2 completado · ${v2Result.result.metrics.tokensGenerated} tokens · ${(v2Result.result.metrics.latencyMs / 1000).toFixed(1)}s`);
            setProgressStatus('success');
            setProgressStep(`Diagnosis v2 completado · ${(v2Result.result.metrics.latencyMs / 1000).toFixed(1)}s`);
            recordLlmCall({
              callType: 'diagnosis',
              providerType: aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama',
              provider: aiConfig.providerType === 'webllm_experimental' ? 'WebLLM' : aiConfig.providerType === 'ollama' ? 'Ollama' : aiConfig.providerType === 'chrome' ? 'Chrome AI' : (aiConfig.cloudProvider || 'Cloud'),
              model: v2Result.result.metrics.model,
              temperature: aiConfig.temperature,
              promptHash: v2Result.result.promptHash,
              promptText: '',
              inputJsonHash: computeInputHash(report),
              promptLength: 0,
              inputColumnCount: report.colCount,
              inputIssueCount: report.issues.length,
              rowCount: report.rowCount,
              colCount: report.colCount,
              datasetFingerprint: auditEvidence?.datasetFingerprint || '',
              responseLength: 0,
              latencyMs: v2Result.result.metrics.latencyMs,
              tokensGenerated: v2Result.result.metrics.tokensGenerated,
              status: 'completed',
            });

            if (aiConfig.providerType === 'chrome') {
              const networkGuardResult = stopNetworkMonitoring();
              chromeMonitoringStarted = false;
              setNetworkResult(networkGuardResult);
              const availability = await detectChromeAiAvailability();
              const placeholderData = [['placeholder']];
              const placeholderColumns = ['column'];
              const receipt = await generateQuickReceipt(placeholderData, placeholderColumns, networkGuardResult!, availability);
              setPrivacyReceipt(receipt);
            }
          }
        } finally {
          if (chromeMonitoringStarted) {
            const networkGuardResult = stopNetworkMonitoring();
            chromeMonitoringStarted = false;
            setNetworkResult(networkGuardResult);
          }
        }
      } else {
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
      }
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
  }, [aiConfig.model, aiConfig.providerType, aiConfig.cloudProvider, aiConfig.temperature, aiProvider, isLoading, onAnalysisComplete, onStructuredDiagnosisComplete, onLog, onMetrics, report, auditEvidence, diagnosisPrompt, pushEvent]);

  const isCloud = aiConfig.providerType === 'cloud';
  const isOllama = aiConfig.providerType === 'ollama';
  const isChrome = aiConfig.providerType === 'chrome';
  const isV2 = structuredDiagnosis !== null;
  const hasDiagnosis = draftAnalysis.trim().length > 0 || isV2;

  return (
    <>
      <section className="diagnosis-stage-shell" data-testid="diagnosis-stage">
        <DiagnosisHeroPanel
          findings={inputSummary.findings}
          critical={inputSummary.critical}
          warning={inputSummary.warning}
          affectedColumns={inputSummary.affectedColumns}
          hasDiagnosis={hasDiagnosis}
          isLoading={isLoading}
          onGenerateDiagnosis={runDiagnosis}
          onContinue={onContinue}
        />

        <DiagnosisProviderPanel
          aiConfig={aiConfig}
          providerAvailable={providerAvailable}
          chromeAvailability={chromeAvailability}
          isCheckingChrome={isCheckingChrome}
          isPreparingChrome={isPreparingChrome}
          chromeDownloadProgress={chromeDownloadProgress}
          chromeDownloadMessage={chromeDownloadMessage}
          onProviderTypeChange={handleProviderTypeChange}
          onModelChange={handleModelChange}
          onChromeStatusChange={(uiStatus) => {
            setProviderAvailable(uiStatus === 'ready');
            if (uiStatus === 'downloading') {
              pushEvent('info', 'Chrome está descargando Gemini Nano.');
              pushEvent('info', 'AURA verificará el estado automáticamente.');
            }
            if (uiStatus === 'ready') {
              pushEvent('success', 'Gemini Nano listo para diagnóstico.');
            }
          }}
          onChromeReady={() => setProviderAvailable(true)}
          onChromeDownloadProgress={(progress, message) => {
            setChromeDownloadProgress(progress);
            setChromeDownloadMessage(message);
          }}
          onPrepareChrome={prepareChromeAi}
          availableModels={availableModels}
        />

        <DiagnosisContractPanel
          report={report}
          aiConfig={aiConfig}
          onInputModeChange={handleInputModeChange}
          onOpenTechnicalEvidence={() => setIsTechnicalEvidenceOpen(true)}
        />

        <TechnicalEvidencePanel
          report={report}
          aiConfig={aiConfig}
          isOpen={isTechnicalEvidenceOpen}
          onToggle={setIsTechnicalEvidenceOpen}
        />

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

        {providerAvailable === false && aiConfig.providerType !== 'chrome' && (
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
              {aiConfig.providerType === 'ollama' && (
                <li>Ollama todavía no está conectado a AURA. Completa la configuración guiada para este equipo.</li>
              )}
              {aiConfig.providerType === 'webllm_experimental' && (
                <li>WebGPU o modelo local no disponible. Requiere Chrome/Edge con soporte WebGPU.</li>
              )}
            </ul>
            <div className="provider-unavailable-actions">
              {aiConfig.providerType === 'ollama' && (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('cloud')}>
                    <Globe size={12} /> Usar Cloud
                  </button>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('webllm_experimental')}>
                    <HardDrive size={12} /> Usar WebGPU
                  </button>
                </div>
              )}
              {aiConfig.providerType === 'webllm_experimental' && (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('ollama')}>
                    <Server size={12} /> Usar Ollama
                  </button>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('cloud')}>
                    <Globe size={12} /> Usar Cloud
                  </button>
                </div>
              )}
              {aiConfig.providerType === 'cloud' && (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('ollama')}>
                    <Server size={12} /> Usar Ollama
                  </button>
                  <button className="btn-s btn-sm" onClick={() => handleProviderTypeChange('webllm_experimental')}>
                    <HardDrive size={12} /> Usar WebGPU
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {providerAvailable === false && aiConfig.providerType === 'chrome' && (
          <div className="provider-unavailable-notice">
            <div className="provider-unavailable-header">
              <ShieldAlert size={16} style={{ color: 'var(--orange)' }} />
              <strong>Chrome AI no disponible</strong>
            </div>
            <ul className="provider-unavailable-reasons">
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
            </ul>
            <div className="provider-unavailable-actions">
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
            </div>
          </div>
        )}

        {/* Chrome AI Guided UX Section - New Status Panel */}
        {aiConfig.providerType === 'chrome' && (
          <ChromeAiStatusPanel
            onStatusChange={(uiStatus) => {
              setProviderAvailable(uiStatus === 'ready');
              if (uiStatus === 'downloading') {
                pushEvent('info', 'Chrome está descargando Gemini Nano.');
                pushEvent('info', 'AURA verificará el estado automáticamente.');
              }
              if (uiStatus === 'ready') {
                pushEvent('success', 'Gemini Nano listo para diagnóstico.');
              }
            }}
            onReady={() => {
              setProviderAvailable(true);
            }}
            onDownloadProgress={(progress, message) => {
              setChromeDownloadProgress(progress);
              setChromeDownloadMessage(message);
            }}
            onPrepare={prepareChromeAi}
          />
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
            {isV2 ? (
              <div className="diagnosis-result-v2">
                <h3 className="stage-result-title">Diagnóstico Estructurado v2</h3>
                {structuredDiagnosis.diagnosis.diagnosisBlocks.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--ink2)' }}>Observaciones y Recomendaciones</h4>
                    {structuredDiagnosis.diagnosis.diagnosisBlocks.map((block, i) => (
                      <div key={i} className="diagnosis-block" style={{ marginBottom: '12px', padding: '10px', background: 'var(--surface2)', borderRadius: '6px', borderLeft: '3px solid var(--accent)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--ink3)', marginBottom: '4px' }}>
                          {block.ruleId}{block.columnId ? ` · ${block.columnId}` : ''}
                        </div>
                        <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                          <strong>Observación:</strong> {block.observation}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--accent)' }}>
                          <strong>Recomendación:</strong> {block.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {structuredDiagnosis.diagnosis.issues.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--ink2)' }}>Hallazgos</h4>
                    {structuredDiagnosis.diagnosis.issues.map((issue, i) => (
                      <div key={i} className="diagnosis-issue" style={{ marginBottom: '10px', padding: '8px', background: 'var(--surface1)', borderRadius: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                          {issue.hypothesis}
                          {issue.requiresHumanReview && (
                            <span style={{ marginLeft: '8px', padding: '1px 6px', background: 'var(--warning-bg, #fff3cd)', color: 'var(--warning-fg, #856404)', borderRadius: '3px', fontSize: '10px', fontWeight: 600 }}>
                              REVISIÓN HUMANA
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                          Confianza: {(issue.confidence * 100).toFixed(0)}% · Evidencia: {issue.evidenceRefs.length} refs
                        </div>
                        {issue.limits.length > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '4px', fontStyle: 'italic' }}>
                            Límites: {issue.limits.join('; ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {structuredDiagnosis.diagnosis.limitations.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-md)', padding: '10px', background: 'var(--surface1)', borderRadius: '6px', borderLeft: '3px solid var(--warning)' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--ink2)' }}>Limitaciones</h4>
                    {structuredDiagnosis.diagnosis.limitations.map((lim, i) => (
                      <div key={i} style={{ fontSize: '12px', color: 'var(--ink3)', marginBottom: '4px' }}>{lim}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <h3 className="stage-result-title">Resumen de AURA</h3>
                <GeminiAdvisor
                  analysis={draftAnalysis}
                  isLoading={isLoading}
                  providerType={aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama'}
                  model={aiConfig.model}
                />
              </>
            )}
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
    </>
  );
};

export default DiagnosisStep;
