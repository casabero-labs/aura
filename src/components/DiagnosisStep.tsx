import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Database, Play, Lock, Globe, ChevronDown, ChevronRight, FileCode2, Trash2, HardDrive, X, AlertTriangle, ShieldAlert, ListChecks, FileJson, FileText, Settings, Activity, CheckCircle, Circle, Clock, AlertCircle, Server, Shield, Eye, EyeOff, Download, RefreshCw, Hash } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';
import ProgressDisclosure from './ProgressDisclosure';
import ChromeAiStatusPanel from './ChromeAiStatusPanel';
import OllamaSetupWizard from './OllamaSetupWizard';
import CopyableHash from './CopyableHash';
import SyntaxDisplay from './SyntaxDisplay';

export const diagnosisPromptTraceCopy = {
  title: 'Una sola solicitud, tres piezas auditables',
  summary: 'AURA realiza una única llamada al modelo. Las tres vistas siguientes separan sus componentes para que puedas comprobar exactamente qué se envió.',
  system: 'Instrucción del sistema: contrato estable de seguridad y formato. Se conserva en inglés técnico para mantener el mismo protocolo entre modelos; no es un segundo diagnóstico.',
  payload: 'Carga de evidencia: JSON con el contexto permitido. Sus nombres y descripciones pueden estar en español porque provienen del motor y del dataset.',
  exact: 'Solicitud exacta: composición de instrucción, evidencia y esquema. Esta única composición se envía a Ollama y es la que certifica el promptHash.',
  legacy: 'Compatibilidad histórica: algunas sesiones antiguas conservan un único prompt V1 redactado en español. No se mezcla con el contrato V2 ni se utiliza en diagnósticos nuevos.',
} as const;
import { DiagnosisHeroPanel } from './diagnosis';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, ProviderMetrics, LocalModelStatus, DiagnosisEvent, ProgressDisclosureStatus, InputMode } from '../types';
import { buildSmartSample, buildAnalysisPrompt } from '../services/providers/prompts';
import { AVAILABLE_MODELS, LOCAL_MODELS, getLocalModelStatus, clearPreloadVerification, deleteDownloadedModel, getChromeAiDiagnostic } from '../services/aiProvider';
import { recordLlmCall, computePromptHash, computeInputHash } from '../services/llmAuditLog';
import { normalizeAiProviderError, NormalizedProviderError } from '../services/providers/errors';
import { detectChromeAiAvailability, NormalizedAvailability } from '../services/chromeAvailability';
import { startNetworkMonitoring, stopNetworkMonitoring, NetworkGuardResult } from '../services/networkGuard';
import { generateQuickReceipt, PrivacyReceipt } from '../services/privacyReceipt';
import {
  exactDiagnosisPromptV2,
  runStructuredDiagnosis,
  type DiagnosisExecutionResult,
  type DiagnosisFailureEvidenceV2,
  type DiagnosisInputPackageV2,
} from '../contracts/llm';
import { resolveOllamaInferenceConfig } from '../services/ollamaInferenceConfig';
import { diagnoseOllamaLocal, type OllamaLocalDiagnostic, type OllamaLocalStatus } from '../services/ollamaLocalBridge';
import { DEFAULT_OLLAMA_MODEL_ID, FINAL_EVALUATION_OLLAMA_MODELS } from '../services/modelRegistry';

interface DiagnosisStepProps {
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  analysisText: string;
  onAiConfigChange: (config: AIConfig) => void;
  onAnalysisComplete: (analysis: string) => void;
  onDiagnosisStarted?: () => void;
  onStructuredDiagnosisComplete?: (result: DiagnosisExecutionResult) => void;
  onDiagnosisFailure?: (evidence: DiagnosisFailureEvidenceV2) => void;
  onMetrics?: (metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
  onOpenSettings?: () => void;
  initialDiagnosis?: DiagnosisExecutionResult | null;
  initialFailureEvidence?: DiagnosisFailureEvidenceV2 | null;
}

export const buildDiagnosisInputSummary = (report: AuditReport | null | undefined) => {
  const issues = report?.issues ?? [];
  const critical = issues.filter((issue) => issue.severity === 'critical').length;
  const warning = issues.filter((issue) => issue.severity === 'warning').length;
  const affectedColumns = new Set(issues.map((issue) => issue.column).filter(Boolean)).size;

  return {
    findings: issues.length,
    critical,
    warning,
    affectedColumns,
  };
};

const RESPONSE_CONTRACT_FAILURE_CODES = new Set([
  'DIAGNOSIS_JSON_INVALID',
  'DIAGNOSIS_RESPONSE_TRUNCATED',
  'DIAGNOSIS_SCHEMA_INVALID',
  'DIAGNOSIS_REFERENCE_INVALID',
  'DIAGNOSIS_ENVELOPE_MISMATCH',
  'DIAGNOSIS_REVIEW_DOWNGRADE',
  'DIAGNOSIS_EXECUTABLE_CONTENT',
]);

export const isDiagnosisResponseContractFailure = (code: string | null | undefined): boolean =>
  typeof code === 'string' && RESPONSE_CONTRACT_FAILURE_CODES.has(code);

const DiagnosisStep: React.FC<DiagnosisStepProps> = ({
  report,
  auditEvidence,
  aiConfig,
  aiProvider,
  analysisText,
  onAiConfigChange,
  onAnalysisComplete,
  onDiagnosisStarted,
  onStructuredDiagnosisComplete,
  onDiagnosisFailure,
  onMetrics,
  onLog,
  onContinue,
  onOpenSettings,
  initialDiagnosis,
  initialFailureEvidence,
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
  const [progressStatus, setProgressStatus] = useState<ProgressDisclosureStatus>('idle');
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressIndeterminate, setProgressIndeterminate] = useState(false);
  const [structuredDiagnosis, setStructuredDiagnosis] = useState<DiagnosisExecutionResult | null>(initialDiagnosis ?? null);
  const [diagnosisFailureEvidence, setDiagnosisFailureEvidence] = useState<DiagnosisFailureEvidenceV2 | null>(initialFailureEvidence ?? null);
  const [preparedInputSnapshot, setPreparedInputSnapshot] = useState<DiagnosisInputPackageV2 | null>(
    initialDiagnosis?.inputSnapshot ?? initialFailureEvidence?.inputSnapshot ?? null,
  );
  const [liveModelOutput, setLiveModelOutput] = useState('');

  useEffect(() => {
    setStructuredDiagnosis(initialDiagnosis ?? null);
    if (initialDiagnosis?.inputSnapshot) setPreparedInputSnapshot(initialDiagnosis.inputSnapshot);
  }, [initialDiagnosis]);

  useEffect(() => {
    setDiagnosisFailureEvidence(initialFailureEvidence ?? null);
    if (initialFailureEvidence?.inputSnapshot) setPreparedInputSnapshot(initialFailureEvidence.inputSnapshot);
  }, [initialFailureEvidence]);

  // Chrome AI guided UX states
  const [chromeAvailability, setChromeAvailability] = useState<NormalizedAvailability | null>(null);
  const [isCheckingChrome, setIsCheckingChrome] = useState(false);
  const [isPreparingChrome, setIsPreparingChrome] = useState(false);
  const [chromeDownloadProgress, setChromeDownloadProgress] = useState<number | undefined>(undefined);
  const [chromeDownloadMessage, setChromeDownloadMessage] = useState<string>('');
  const [privacyReceipt, setPrivacyReceipt] = useState<PrivacyReceipt | null>(null);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [networkResult, setNetworkResult] = useState<NetworkGuardResult | null>(null);
  const [ollamaDiagnostic, setOllamaDiagnostic] = useState<OllamaLocalDiagnostic | null>(null);
  const [showOllamaWizard, setShowOllamaWizard] = useState(false);

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
    if (aiConfig.providerType === 'ollama') {
      diagnoseOllamaLocal(aiConfig.ollamaBaseUrl, aiConfig.model).then(diag => {
        setOllamaDiagnostic(diag);
        setProviderAvailable(diag.status === 'ready');
      }).catch(() => {
        setProviderAvailable(false);
      });
    } else {
      setOllamaDiagnostic(null);
      if (aiConfig.providerType !== 'chrome') {
        aiProvider.isAvailable().then(setProviderAvailable).catch(() => setProviderAvailable(false));
      }
    }
  }, [aiConfig.providerType, aiConfig.ollamaBaseUrl, aiConfig.model, aiProvider]);

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
      draw(`Diagnóstico · responseId: ${structuredDiagnosis.diagnosis.responseId}`, 8, 5);
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
      ollama: DEFAULT_OLLAMA_MODEL_ID,
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

  const runDiagnosis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setStructuredDiagnosis(null);
    setDiagnosisFailureEvidence(null);
    setPreparedInputSnapshot(null);
    setLiveModelOutput('');
    onDiagnosisStarted?.();
    setDraftAnalysis('');
    setDiagnosisEvents([]);
    setProgressValue(undefined);
    setProgressIndeterminate(true);
    setProgressStep('Preparando contexto del dataset...');
    setProgressStatus('running');
    let finalText = '';

    const prompt = diagnosisPrompt;
    const promptHash = computePromptHash(prompt);
    const inputHash = computeInputHash(report);

    pushEvent('info', 'Preparando contexto del dataset...');
    onLog?.('diagnosis', `Iniciando diagnóstico con ${aiConfig?.model} (${aiConfig?.providerType})`);

    // Simulated human-friendly progress steps during execution
    let progressTimer: any;
    let stepCount = 0;
    const stepsList = [
      'Analizando hallazgos críticos...',
      'Construyendo diagnóstico asistido...',
      'Organizando resumen ejecutivo...',
      'Finalizando salida diagnóstica...'
    ];

    progressTimer = setInterval(() => {
      if (stepCount < stepsList.length) {
        const nextStep = stepsList[stepCount];
        pushEvent('info', nextStep);
        setProgressStep(nextStep);
        stepCount++;
      } else {
        clearInterval(progressTimer);
      }
    }, 2500);

    try {
      let chromeMonitoringStarted = false;

      try {
          if (aiConfig?.providerType === 'chrome') {
            startNetworkMonitoring();
            chromeMonitoringStarted = true;
          }

          const v2Result = await runStructuredDiagnosis(report as any, {
            provider: aiProvider,
            auditEvidence: auditEvidence?.datasetSha256
              ? { datasetSha256: auditEvidence.datasetSha256, datasetFingerprint: auditEvidence.datasetFingerprint }
              : null,
            inputMode: aiConfig.inputMode === 'prompt_libre' || aiConfig.inputMode === 'recommended'
              ? aiConfig.inputMode
              : 'smart_sample',
            requestedModel: aiConfig.model,
            inference: resolveOllamaInferenceConfig(aiConfig),
            onInputPrepared: setPreparedInputSnapshot,
            onProgress: (event) => {
              if (event.type === 'chunk') {
                finalText += event.text;
                setLiveModelOutput((current) => current + event.text);
              } else {
                pushEvent('info', event.text);
                setProgressStep(event.text);
              }
            },
          });

          if ('contractId' in v2Result && v2Result.contractId === 'aura.diagnosis-failure-evidence.v2') {
            const failureEvidence = v2Result as DiagnosisFailureEvidenceV2;
            const normalized = normalizeAiProviderError(new Error(failureEvidence.message), aiConfig);
            setError(failureEvidence.message);
            setNormalizedError(normalized);
            pushEvent('error', `Diagnóstico fallido: ${failureEvidence.code}`);
            setProgressStatus('error');
            setProgressStep(`Error: ${failureEvidence.code}`);
            setStructuredDiagnosis(null);
            setDiagnosisFailureEvidence(failureEvidence);
            setPreparedInputSnapshot(failureEvidence.inputSnapshot);
            onDiagnosisFailure?.(failureEvidence);
            recordLlmCall({
              callType: 'diagnosis',
              providerType: aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama',
              provider: aiConfig.providerType === 'webllm_experimental' ? 'WebLLM' : aiConfig.providerType === 'ollama' ? 'Ollama' : aiConfig.providerType === 'chrome' ? 'Chrome AI' : (aiConfig.cloudProvider || 'Cloud'),
              model: aiConfig.model,
              temperature: aiConfig.temperature,
              promptHash: failureEvidence.executionReceipt.promptHash,
              promptText: '',
              inputJsonHash: failureEvidence.executionReceipt.inputHash ?? computeInputHash(report),
              promptLength: 0,
              inputColumnCount: report.colCount,
              inputIssueCount: report.issues.length,
              rowCount: report.rowCount,
              colCount: report.colCount,
              datasetFingerprint: auditEvidence?.datasetFingerprint || '',
              responseLength: 0,
              latencyMs: 0,
              tokensGenerated: 0,
              status: 'error',
              error: failureEvidence.message,
            });
          } else if ('success' in v2Result && !v2Result.success) {
            const v2Failure = v2Result as {
              success: false; code: string; message: string; path: string;
              details: Record<string, unknown>;
            };
            const normalized = normalizeAiProviderError(new Error(v2Failure.message), aiConfig);
            setError(v2Failure.message);
            setNormalizedError(normalized);
            setStructuredDiagnosis(null);
            setDiagnosisFailureEvidence(null);
            pushEvent('error', `Diagnóstico fallido: ${v2Failure.code}`);
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
              latencyMs: 0,
              tokensGenerated: 0,
              status: 'error',
              error: v2Failure.message,
            });
          } else {
            const v2Success = v2Result as import('../contracts/llm').StructuredDiagnosisResult;
            setDiagnosisFailureEvidence(null);
            setStructuredDiagnosis(v2Success.result);
            if (v2Success.result.inputSnapshot) setPreparedInputSnapshot(v2Success.result.inputSnapshot);
            setLiveModelOutput((current) => current || JSON.stringify(v2Success.result.diagnosis, null, 2));
            setLastMetrics(v2Success.result.metrics as ProviderMetrics);
            onMetrics?.(v2Success.result.metrics as ProviderMetrics);
            onStructuredDiagnosisComplete?.(v2Success.result);
            pushEvent('success', `Diagnóstico completado · ${v2Success.result.metrics.tokensGenerated} tokens · ${(v2Success.result.metrics.latencyMs / 1000).toFixed(1)}s`);
            setProgressStatus('success');
            setProgressStep(`Diagnóstico completado · ${(v2Success.result.metrics.latencyMs / 1000).toFixed(1)}s`);
            recordLlmCall({
              callType: 'diagnosis',
              providerType: aiConfig.providerType as 'local' | 'cloud' | 'chrome' | 'ollama',
              provider: aiConfig.providerType === 'webllm_experimental' ? 'WebLLM' : aiConfig.providerType === 'ollama' ? 'Ollama' : aiConfig.providerType === 'chrome' ? 'Chrome AI' : (aiConfig.cloudProvider || 'Cloud'),
              model: v2Success.result.metrics.model,
              temperature: aiConfig.temperature,
              promptHash: v2Success.result.promptHash,
              promptText: '',
              inputJsonHash: computeInputHash(report),
              promptLength: 0,
              inputColumnCount: report.colCount,
              inputIssueCount: report.issues.length,
              rowCount: report.rowCount,
              colCount: report.colCount,
              datasetFingerprint: auditEvidence?.datasetFingerprint || '',
              responseLength: 0,
              latencyMs: v2Success.result.metrics.latencyMs,
              tokensGenerated: v2Success.result.metrics.tokensGenerated,
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
      // Asegura que el timer visual de progreso no siga empujando eventos
      // después de éxito, error o cancelación del flujo.
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = undefined;
      }
      setIsLoading(false);
    }
  }, [aiConfig?.model, aiConfig?.providerType, aiConfig?.cloudProvider, aiConfig?.temperature, aiProvider, isLoading, onAnalysisComplete, onDiagnosisFailure, onDiagnosisStarted, onStructuredDiagnosisComplete, onLog, onMetrics, report, auditEvidence, diagnosisPrompt, pushEvent]);

  const isCloud = aiConfig.providerType === 'cloud';
  const isOllama = aiConfig.providerType === 'ollama';
  const isChrome = aiConfig.providerType === 'chrome';
  const isV2 = structuredDiagnosis !== null;
  const hasDiagnosis = draftAnalysis.trim().length > 0 || isV2;
  const activeInputSnapshot = structuredDiagnosis?.inputSnapshot
    ?? diagnosisFailureEvidence?.inputSnapshot
    ?? preparedInputSnapshot;
  const activeExecutionReceipt = structuredDiagnosis?.executionReceipt
    ?? diagnosisFailureEvidence?.executionReceipt
    ?? null;
  const exactPrompt = activeInputSnapshot ? exactDiagnosisPromptV2(activeInputSnapshot) : '';
  const isResponseContractFailure = isDiagnosisResponseContractFailure(diagnosisFailureEvidence?.code);
  const displayedErrorTitle = isResponseContractFailure
    ? 'La respuesta del modelo no cumple el contrato'
    : normalizedError?.title;
  const displayedErrorCause = isResponseContractFailure
    ? diagnosisFailureEvidence.message
    : normalizedError?.cause;

  const providerName = aiConfig.providerType === 'chrome' ? 'Chrome AI / Gemini Nano'
    : aiConfig.providerType === 'ollama' ? 'Ollama Local'
    : aiConfig.providerType === 'webllm_experimental' ? 'WebLLM'
    : aiConfig.cloudProvider ? `${aiConfig.cloudProvider} Cloud` : 'Cloud';
  const activeModelDefinition = FINAL_EVALUATION_OLLAMA_MODELS.find((model) => model.id === aiConfig.model);
  const quickConfigModels = activeModelDefinition
    ? FINAL_EVALUATION_OLLAMA_MODELS
    : [{ id: aiConfig.model, name: aiConfig.model }, ...FINAL_EVALUATION_OLLAMA_MODELS];

  return (
    <>
      <section className="diagnosis-stage-shell" data-testid="diagnosis-stage">
        {/* 1. Header + active provider + single primary CTA */}
        <DiagnosisHeroPanel
          fileName={auditEvidence?.fileName || 'Archivo sin nombre'}
          rowCount={report?.rowCount ?? 0}
          colCount={report?.colCount ?? 0}
          findings={inputSummary.findings}
          hasDiagnosis={hasDiagnosis}
          isLoading={isLoading}
          onGenerateDiagnosis={runDiagnosis}
          providerName={providerName}
          providerAvailable={providerAvailable}
          model={aiConfig.model}
          modelName={activeModelDefinition?.name ?? aiConfig.model}
          inputMode={aiConfig.inputMode ?? 'smart_sample'}
          models={quickConfigModels}
          onQuickConfigSave={({ model, inputMode }) => onAiConfigChange({ ...aiConfig, model, inputMode })}
        />

        {/* 3. Progress disclosure during execution */}
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

        {/* 4. Exact provider stream — the text the LLM is producing right now. */}
        {(isLoading || liveModelOutput) && (
          <SyntaxDisplay
            filename="diagnosis.response.stream.json"
            content={liveModelOutput || 'Esperando la primera parte de la respuesta del modelo…'}
            className="diagnosis-response-stream"
            maxHeight={320}
            wrap
            autoScroll
            testId="diagnosis-response-stream"
            contentTestId="diagnosis-response-stream-content"
            role="log"
            ariaLive="polite"
          />
        )}

        {/* 5. Technical activity while loading (visible alongside the progress bar) */}
        {isLoading && diagnosisEvents.length > 0 && (
          <SyntaxDisplay
            filename="diagnosis.activity.log"
            copyText={diagnosisEvents.map((event) => `${new Date(event.timestamp).toLocaleTimeString()}  ${event.message}`).join('\n')}
            className="diagnosis-terminal"
            maxHeight={180}
            testId="diagnosis-terminal"
            role="log"
            ariaLive="polite"
          >
              {diagnosisEvents.map((event, i) => (
                <div key={i} className={`diagnosis-terminal-row diagnosis-terminal-row--${event.level}`}>
                  <span className="diagnosis-terminal-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className="diagnosis-terminal-message">{event.message}</span>
                </div>
              ))}
          </SyntaxDisplay>
        )}

        {/* 5. Provider / error notices */}
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
                <li>{ollamaDiagnostic
                  ? ollamaDiagnostic.message
                  : 'Ollama todavía no está conectado a AURA. Usa el asistente de configuración guiada.'}</li>
              )}
              {aiConfig.providerType === 'webllm_experimental' && (
                <li>WebGPU o modelo local no disponible. Requiere Chrome/Edge con soporte WebGPU.</li>
              )}
            </ul>
            <div className="provider-unavailable-actions">
              {aiConfig.providerType === 'ollama' && (
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                  <button className="btn-s btn-sm" onClick={() => setShowOllamaWizard(true)} data-testid="ollama-open-wizard-unavail">
                    <Server size={12} /> Conectar Ollama de este equipo
                  </button>
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

        {/* Chrome AI Status Panel is now rendered compact inside the technical disclosure. */}

        {error && normalizedError && (
          <div className="provider-error-notice">
            <div className="provider-error-header">
              <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
              <strong style={{ color: 'var(--error)' }}>{displayedErrorTitle}</strong>
            </div>
            <p className="provider-error-cause">Detalle verificable: {displayedErrorCause}</p>
            <div className="provider-error-actions">
              {isResponseContractFailure ? (
                <button className="btn-s btn-sm" onClick={runDiagnosis}>
                  <RefreshCw size={12} /> Reintentar diagnóstico
                </button>
              ) : (
                <button className="btn-s btn-sm" onClick={() => onOpenSettings?.()}>
                  <Settings size={12} /> Abrir Configuración
                </button>
              )}
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

        {/* 6. Result — protagonist when diagnosis is done */}
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
            {lastMetrics && hasDiagnosis && !isLoading && (
              <div className="stage-result-metrics">
                <span>{(lastMetrics.latencyMs / 1000).toFixed(1)}s</span>
                <span>{lastMetrics.tokensGenerated} tokens</span>
              </div>
            )}
          </div>
        )}

        {/* 7. Single primary forward CTA — no inline PDF/JSON exports */}
        {hasDiagnosis && !isLoading && (
          <div className="evidence-options" data-testid="primary-stage-action">
            <button className="btn-p" onClick={onContinue} type="button">
              Continuar al reporte diagnóstico → <Play size={14} />
            </button>
          </div>
        )}

        {/* 8. Progressive disclosure — technical details and audit trail (closed by default) */}
        <details className="diagnosis-tech-disclosure" data-testid="diagnosis-tech-disclosure">
          <summary className="diagnosis-tech-disclosure-summary">
            <FileCode2 size={12} />
            <span>Trazabilidad técnica</span>
            <span className="diagnosis-tech-disclosure-hint">evidencia necesaria para verificar el método, la entrada y la respuesta del diagnóstico</span>
          </summary>
          <div className="diagnosis-tech-disclosure-body">
            {activeExecutionReceipt && activeInputSnapshot ? (
              <>
                <div className="diagnosis-tech-section">
                  <h4 className="diagnosis-tech-section-title" data-testid="diagnosis-llm-receipt">Recibo del diagnóstico LLM V2</h4>
                  <p style={{fontSize:'11px', color:'var(--ink3)', marginBottom:'8px'}}>
                    Este recibo documenta la invocación del modelo de lenguaje. No acredita ejecución Python ni que un script haya producido un CSV.
                  </p>
                  <div className="diagnosis-tech-row">
                    <CopyableHash value={activeExecutionReceipt.receiptHash} label="Receipt" testId="diagnosis-llm-receipt-hash" />
                    <span>
                      <Hash size={11} /> Estado: {activeExecutionReceipt.validationStatus}
                    </span>
                  </div>
                  <div className="diagnosis-tech-row">
                    <span>
                      <Hash size={11} /> Método solicitado: {activeExecutionReceipt.requestedInputMode}
                    </span>
                    <span>
                      <Hash size={11} /> Método efectivo: {activeExecutionReceipt.effectiveInputMode}
                    </span>
                  </div>
                  <div className="diagnosis-tech-row">
                    <span>
                      <Hash size={11} /> Proveedor: {activeExecutionReceipt.provider}
                    </span>
                    <span>
                      <Hash size={11} /> Modelo solicitado: {activeExecutionReceipt.requestedModel}
                    </span>
                  </div>
                  <div className="diagnosis-tech-row">
                    <span>
                      <Hash size={11} /> Modelo observado: {activeExecutionReceipt.observedModel ?? 'no observado'}
                    </span>
                    <span>
                      {activeExecutionReceipt.modelDigest
                        ? <CopyableHash value={activeExecutionReceipt.modelDigest} label="Digest" />
                        : <span><Hash size={11} /> Digest: n/d</span>}
                    </span>
                  </div>
                  {activeExecutionReceipt.startedAt && (
                    <div className="diagnosis-tech-row">
                      <span><Clock size={11} /> Inicio: {new Date(activeExecutionReceipt.startedAt).toLocaleString('es-CO')}</span>
                      <span><Clock size={11} /> Fin: {new Date(activeExecutionReceipt.completedAt).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  {activeExecutionReceipt.startedAt && activeExecutionReceipt.completedAt && (
                    <div className="diagnosis-tech-row">
                      <span>
                        <Clock size={11} /> Duración: {(() => {
                          const start = new Date(activeExecutionReceipt.startedAt).getTime();
                          const end = new Date(activeExecutionReceipt.completedAt).getTime();
                          const ms = end - start;
                          return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
                        })()}
                      </span>
                      <span>
                        <Activity size={11} /> Validación de respuesta: {(activeExecutionReceipt.validationErrorCodes?.length ?? 0) > 0 ? `errores (${activeExecutionReceipt.validationErrorCodes?.join(', ') ?? ''})` : 'válida'}
                      </span>
                    </div>
                  )}
                  {(activeExecutionReceipt.validationErrorCodes?.length ?? 0) > 0 && (
                    <div className="diagnosis-tech-row">
                      <span style={{ color: 'var(--error)', fontSize: '11px' }}>
                        <AlertTriangle size={11} /> Errores de validación: {activeExecutionReceipt.validationErrorCodes?.join(', ') ?? ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="diagnosis-tech-section">
                  <h4 className="diagnosis-tech-section-title">Hashes de auditoría</h4>
                  <div className="diagnosis-tech-row">
                    <CopyableHash value={activeExecutionReceipt.promptHash} label="Prompt" testId="diagnosis-llm-prompt-hash" />
                    <CopyableHash value={activeExecutionReceipt.inputHash} label="Input" testId="diagnosis-llm-input-hash" />
                    <CopyableHash value={activeExecutionReceipt.responseSchemaHash} label="Schema" testId="diagnosis-llm-schema-hash" />
                    <CopyableHash value={activeExecutionReceipt.inferenceHash} label="Inferencia" testId="diagnosis-llm-inference-hash" />
                    <CopyableHash value={activeExecutionReceipt.rawResponseHash} label="Respuesta cruda" testId="diagnosis-llm-raw-response-hash" />
                  </div>
                </div>

                {/* Sections included */}
                <div className="diagnosis-tech-section">
                  <h4 className="diagnosis-tech-section-title">Secciones del snapshot</h4>
                  <div className="diagnosis-tech-row">
                    {(activeExecutionReceipt.includedSections ?? []).map((section) => (
                      <span key={section} className="diagnosis-tech-chip">{section}</span>
                    ))}
                  </div>
                </div>

                {/* Dataset SHA and envelope reference */}
                {auditEvidence?.datasetSha256 && (
                  <div className="diagnosis-tech-section">
                    <h4 className="diagnosis-tech-section-title">Dataset</h4>
                    <div className="diagnosis-tech-row">
                      <span>
                        <Hash size={11} /> SHA-256 del dataset: {auditEvidence.datasetSha256.substring(0, 16)}…
                      </span>
                    </div>
                  </div>
                )}
                {activeInputSnapshot && (
                  <div className="diagnosis-tech-section">
                    <div className="diagnosis-tech-row">
                      <span>
                        <Hash size={11} /> Referencia del envelope: {activeInputSnapshot.evidenceEnvelopeRef}
                      </span>
                    </div>
                  </div>
                )}

                {/* Metrics */}
                {lastMetrics && (
                  <div className="diagnosis-tech-section">
                    <h4 className="diagnosis-tech-section-title">Métricas del modelo</h4>
                    <div className="diagnosis-tech-row">
                      <span><Clock size={11} /> Latencia: {(lastMetrics.latencyMs / 1000).toFixed(1)}s</span>
                      <span><Activity size={11} /> Tokens generados: {lastMetrics.tokensGenerated}</span>
                    </div>
                  </div>
                )}

                {/* System instruction + user payload */}
                {activeInputSnapshot && (
                  <>
                    <div className="diagnosis-prompt-trace" data-testid="diagnosis-prompt-trace-explanation">
                      <p className="diagnosis-prompt-trace__eyebrow">Arquitectura del prompt</p>
                      <h4>{diagnosisPromptTraceCopy.title}</h4>
                      <p>{diagnosisPromptTraceCopy.summary}</p>
                      <ol>
                        <li>{diagnosisPromptTraceCopy.system}</li>
                        <li>{diagnosisPromptTraceCopy.payload}</li>
                        <li>{diagnosisPromptTraceCopy.exact}</li>
                      </ol>
                    </div>
                    <div className="diagnosis-tech-section">
                      <SyntaxDisplay filename="01-system-instruction.en.txt" content={activeInputSnapshot.systemInstruction} maxHeight={320} />
                    </div>
                    <div className="diagnosis-tech-section">
                      <SyntaxDisplay filename="02-evidence-payload.json" content={activeInputSnapshot.userPayload} maxHeight={320} />
                    </div>
                    <div className="diagnosis-tech-section">
                      <SyntaxDisplay filename="03-request-sent-once.txt" content={exactPrompt} maxHeight={320} />
                    </div>
                  </>
                )}

                {/* Raw response */}
                <div className="diagnosis-tech-section">
                  <SyntaxDisplay
                    filename="provider-response.raw.json"
                    content={liveModelOutput || (structuredDiagnosis
                      ? JSON.stringify(structuredDiagnosis.diagnosis, null, 2)
                      : 'La respuesta cruda no está disponible en esta sesión; su hash permanece en el recibo.')}
                    maxHeight={320}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Legacy v1 fallback for runs without V2 receipt */}
                {lastMetrics && (
                  <div className="diagnosis-tech-section">
                    <h4 className="diagnosis-tech-section-title">Métricas del modelo</h4>
                    <div className="diagnosis-tech-row">
                      <span><Clock size={11} /> Latencia: {(lastMetrics.latencyMs / 1000).toFixed(1)}s</span>
                      <span><Activity size={11} /> Tokens generados: {lastMetrics.tokensGenerated}</span>
                    </div>
                  </div>
                )}
                <div className="diagnosis-tech-section">
                  <h4 className="diagnosis-tech-section-title">Hashes de auditoría</h4>
                  <div className="diagnosis-tech-row">
                    <span><Hash size={11} /> Prompt: {computePromptHash(diagnosisPrompt).substring(0, 16)}…</span>
                    <span><Hash size={11} /> Input: {computeInputHash(report).substring(0, 16)}…</span>
                  </div>
                </div>
                <div className="diagnosis-tech-section">
                  <SyntaxDisplay
                    filename="smart-sample.preview.json"
                    content={`${JSON.stringify(smartSample, null, 2).substring(0, 1200)}${JSON.stringify(smartSample, null, 2).length > 1200 ? '\n…' : ''}`}
                  />
                </div>
                <div className="diagnosis-tech-section">
                  <div className="diagnosis-prompt-trace">
                    <p className="diagnosis-prompt-trace__eyebrow">Sesión histórica</p>
                    <h4>Prompt V1 en español</h4>
                    <p>{diagnosisPromptTraceCopy.legacy}</p>
                  </div>
                  <SyntaxDisplay filename="legacy-v1-prompt.es.txt" content={diagnosisPrompt} maxHeight={320} />
                </div>
                <div className="diagnosis-tech-section">
                  <SyntaxDisplay filename="provider-response.txt" content={draftAnalysis} maxHeight={320} />
                </div>
              </>
            )}

            {/* Activity log (post-completion) */}
            {diagnosisEvents.length > 0 && !isLoading && (
              <div className="diagnosis-tech-section">
                <h4 className="diagnosis-tech-section-title">Registro de actividad</h4>
                <div className="diagnosis-tech-events">
                  {diagnosisEvents.map((event, i) => (
                    <div key={i} className={`diagnosis-tech-event diagnosis-tech-event--${event.level}`}>
                      <span className="diagnosis-tech-event-time">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="diagnosis-tech-event-message">{event.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WebLLM local model status (moved here, kept untouched) */}
            {aiConfig.providerType === 'webllm_experimental' && currentModelStatus && (
              <div className="diagnosis-tech-section">
                <h4 className="diagnosis-tech-section-title">Modelo local WebLLM</h4>
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
              </div>
            )}

            {/* Chrome AI status panel (compact, for state mgmt/download tracking) */}
            {aiConfig.providerType === 'chrome' && (
              <div className="diagnosis-tech-section">
                <h4 className="diagnosis-tech-section-title">Estado de Chrome AI</h4>
                <ChromeAiStatusPanel
                  compact
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
                  onReady={() => setProviderAvailable(true)}
                  onDownloadProgress={(progress, message) => {
                    setChromeDownloadProgress(progress);
                    setChromeDownloadMessage(message);
                  }}
                  onPrepare={prepareChromeAi}
                />
              </div>
            )}

            <div className="diagnosis-tech-section">
              <p className="diagnosis-tech-integrity-note">
                Esta evidencia de integridad fue generada por un ejecutor local confiable. No constituye firma digital ni certificación externa.
              </p>
            </div>
          </div>
        </details>

        {showOllamaWizard && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowOllamaWizard(false); }} data-testid="ollama-wizard-modal">
            <div className="modal-container modal-container--lg">
              <button className="modal-close" onClick={() => setShowOllamaWizard(false)}>
                <X size={20} />
              </button>
              <OllamaSetupWizard
                endpoint={aiConfig.ollamaBaseUrl}
                onReady={(diag) => {
                  setOllamaDiagnostic(diag);
                  if (diag.details.selectedModel) {
                    onAiConfigChange({ ...aiConfig, model: diag.details.selectedModel });
                  }
                  setProviderAvailable(true);
                  setShowOllamaWizard(false);
                }}
                onCancel={() => setShowOllamaWizard(false)}
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
};

export default DiagnosisStep;
