import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

declare const __AURA_BUILD_SHA__: string;
declare const __AURA_BUILD_TIME__: string;

if (typeof __AURA_BUILD_SHA__ !== 'undefined') {
  console.log(
    `%c[AURA] Build: ${__AURA_BUILD_SHA__} | ${__AURA_BUILD_TIME__}`,
    'color: #888; font-size: 11px; font-family: monospace;',
  );
}
import { ArrowLeft, Download, FileJson, FileText, Sun, Moon, AlertTriangle, Trash2, X } from 'lucide-react';
import ChangelogModal from './components/ChangelogModal';
import ErrorBoundary from './components/ErrorBoundary';
import AuditLogViewer from './components/AuditLogViewer';
import SettingsPanel from './components/SettingsPanel';
import HelpCenter from './components/HelpCenter';
import ProgressDisclosure from './components/ProgressDisclosure';
import MainPipeline, { PipelineData } from './components/MainPipeline';
import { loadFromApi, syncToApi } from './services/api';
import { createAIProvider } from './services/aiProvider';
import { loadAIConfig, persistAIConfig, sanitizeAIConfig } from './services/aiConfigStorage';
import { generatePdfReport } from './services/pdfGenerator';
import { generateDiagnosticPdfReport } from './services/diagnosticReport';
import { buildEvidenceManifest } from './services/evidenceManifest';
import { buildAuraExportPackage } from './services/exportPackage';
import { buildEvidenceArchive } from './services/evidenceArchive';
import { validateAuraExportPackage } from './services/exportContractValidation';
import { deriveDiagnosisExportStatus } from './services/diagnosisExportState';
import { parsePythonExecutionBundle } from './services/remediationExecution/pythonExecutionContract';
import {
  buildNotRunRemediationExecution,
  type RemediationExecutionExportV1,
} from './services/remediationExecution/remediationExport';
import { buildExportArtifactIdentity } from './services/exportArtifactIdentity';
import { savePipelineSession, loadPipelineSession, clearPipelineSession } from './services/pipelineSession';
import { downloadBlob, downloadTextFile } from './utils/download';
import { AIConfig, AuditReport, DeterministicValidationReport, EvidenceManifest, ExecutiveReportContent, IssueSeverity } from './types';
import { createFormalCampaignBundle, buildFormalEvidenceEnvelope } from './services/benchmark/formalCampaignFactory';
import { buildEnvelopeRef, processDiagnosisResponseV2, type DiagnosisFailureEvidenceV2, type DiagnosisExecutionResult } from './contracts/llm';
import type { InferenceSnapshotV1 } from './contracts/llm/types';
import { resolveOllamaInferenceConfig } from './services/ollamaInferenceConfig';
import type { ExperimentRunV1 } from './services/benchmark/experimentTypes';
import { evaluateFormalDiagnosisRun } from './services/benchmark/formalDiagnosisEvaluator';
import {
  applyCampaignConfigurationToAIConfig,
  type CampaignPipelineConfigurationV1,
} from './services/benchmark/campaignPipelineConfiguration';

const BenchmarkCampaignLab = lazy(() => import('./components/benchmark/BenchmarkCampaignLab'));
const Oe4CampaignE2eHarness = import.meta.env.DEV
  && import.meta.env.VITE_OE4_E2E_HARNESS === 'true'
  ? lazy(() => import('./tests/e2e/harness/Oe4CampaignE2eHarness'))
  : null;
const AvFixture = import.meta.env.DEV
  && import.meta.env.VITE_PHASE3_E2E_HARNESS === 'true'
  ? lazy(() => import('./components/AvFixturePage'))
  : null;

const countBySeverity = (report: AuditReport | null, severity: IssueSeverity) =>
  report?.issues.filter((issue) => issue.severity === severity).length ?? 0;

const csvCell = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const buildDeterministicPdfContent = (auditReport: AuditReport, approvedScript?: string): ExecutiveReportContent => {
  const criticalIssues = auditReport.issues.filter((issue) => issue.severity === IssueSeverity.CRITICAL);
  const topIssues = auditReport.issues.slice(0, 6);
  const healthLabel = auditReport.score >= 80
    ? 'salud alta'
    : auditReport.score >= 50
      ? 'salud intermedia'
      : 'salud critica';

  return {
    title: 'AURA - Informe de Auditoria Determinista',
    domain_inferred: 'Dominio no inferido por defecto',
    dataset_technical_description:
      `Dataset CSV auditado en navegador con ${auditReport.rowCount} filas, ${auditReport.colCount} columnas y delimitador "${auditReport.delimiterDetected}". ` +
      `El motor determinista calculo un score de ${auditReport.score}/100, detecto ${auditReport.issues.length} reglas activadas y ${auditReport.duplicateRows} filas duplicadas.`,
    executive_summary:
      `El dataset presenta ${healthLabel} segun el motor determinista de AURA. ` +
      `${criticalIssues.length} hallazgos fueron clasificados como criticos y requieren revision antes de usar el dataset en analisis o entrenamiento.`,
    business_impact:
      'El riesgo principal es tecnico: valores nulos, duplicados, formatos inconsistentes o reglas logicas activadas pueden sesgar analisis posteriores. ' +
      'Este informe no incorpora inferencias no verificadas del LLM; las conclusiones se limitan a reglas reproducibles.',
    key_findings: topIssues.length > 0
      ? topIssues.map((issue) => `${issue.severity.toUpperCase()} - ${issue.ruleName}${issue.column ? ` [${issue.column}]` : ''}: ${issue.description}`)
      : ['No se activaron reglas de anomalía en el motor determinista.'],
    recommendations: [
      'Priorizar los hallazgos criticos antes de publicar o reutilizar el dataset.',
      'Aplicar solo acciones de limpieza reproducibles y conservar una copia del dataset original.',
      'Validar manualmente cualquier accion destructiva, cambio semantico o eliminacion de columnas.',
      'Reauditar el dataset después de una remediación y comparar los hallazgos antes/después.',
    ],
    python_script: approvedScript || undefined,
  };
};

const INITIAL_PIPELINE_DATA: PipelineData = {
  state: 'upload',
  file: null,
  report: null,
  auditEvidence: null,
  rawData: [],
  csvFields: [],
  csvDelimiter: ',',
  cleaningScript: '',
  approvedScript: '',
  healthDelta: null,
  aiAnalysis: '',
  structuredDiagnosis: null,
  diagnosisFailureEvidence: null,
  diagnosticReport: null,
  remediationPlan: null,
  scriptContractV2: null,
  scriptContractVerificationV2: null,
  benchmarkResults: [],
  improvementRun: null,
  scriptValidation: null,
  deterministicValidation: null,
  logs: [],
};

const App: React.FC = () => {
  const oe4E2eHarnessEnabled = Oe4CampaignE2eHarness !== null;
  // ── Pipeline data (recibido de MainPipeline) ──
  const [pipelineData, setPipelineData] = useState<PipelineData>(() => {
    const snap = loadPipelineSession();
    if (snap) {
      return {
        state: snap.state,
        file: null,
        report: snap.report,
        auditEvidence: snap.auditEvidence,
        rawData: snap.rawData,
        csvFields: snap.csvFields,
        csvDelimiter: snap.csvDelimiter,
        cleaningScript: snap.cleaningScript,
        approvedScript: snap.approvedScript,
        healthDelta: snap.healthDelta,
        aiAnalysis: snap.aiAnalysis,
        structuredDiagnosis: (snap as any).structuredDiagnosis ?? null,
        diagnosisFailureEvidence: (snap as any).diagnosisFailureEvidence ?? null,
        diagnosticReport: (snap as any).diagnosticReport ?? null,
        remediationPlan: (snap as any).remediationPlan ?? null,
        scriptContractV2: (snap as any).scriptContractV2 ?? null,
        scriptContractVerificationV2: (snap as any).scriptContractVerificationV2 ?? null,
        benchmarkResults: snap.benchmarkResults,
        improvementRun: snap.improvementRun,
        scriptValidation: snap.scriptValidation,
        deterministicValidation: snap.deterministicValidation,
        logs: snap.logs,
        executionState: (snap as any).executionState ?? 'not_prepared',
        executionBundleJson: (snap as any).executionBundleJson ?? '',
        executionReceipt: (snap as any).executionReceipt ?? undefined,
        executionValidationError: (snap as any).executionValidationError ?? '',
        reauditState: (snap as any).reauditState ?? 'not_run',
        reauditError: (snap as any).reauditError ?? '',
        verifiedEvidence: (snap as any).verifiedEvidence ?? null,
      };
    }
    return INITIAL_PIPELINE_DATA;
  });

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showExperimentCampaign, setShowExperimentCampaign] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [includeCorrectedInEvidenceArchive, setIncludeCorrectedInEvidenceArchive] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('aura_theme') || localStorage.getItem('casabero-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('aura_theme', theme);
    localStorage.setItem('casabero-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (pipelineData.report) {
      savePipelineSession(pipelineData);
    }
  }, [pipelineData]);

  // ── AI Config (para settings panel) ──
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    return loadAIConfig({
      model: 'gemini-nano',
      temperature: 0.1,
      autoAnalyze: false,
      providerType: 'chrome',
      apiKey: '',
      cloudProvider: undefined,
    });
  });

  useEffect(() => {
    loadFromApi<AIConfig>('ai_config', aiConfig).then((remote) => {
      if (!remote) return;
      const safeRemote = sanitizeAIConfig(remote);
      if (JSON.stringify(safeRemote) !== JSON.stringify(sanitizeAIConfig(aiConfig))) {
        setAiConfig((current) => ({ ...safeRemote, apiKey: current.apiKey }));
      }
    });
  }, []);

  useEffect(() => {
    const safe = persistAIConfig(aiConfig);
    syncToApi('ai_config', safe);
  }, [aiConfig]);

  const aiProvider = useMemo(() => createAIProvider(aiConfig), [aiConfig]);

  const formalEvidenceEnvelope = useMemo(() => {
    if (!pipelineData.report || !pipelineData.auditEvidence) return null;
    try {
      return buildFormalEvidenceEnvelope(pipelineData.report, pipelineData.auditEvidence);
    } catch {
      return null;
    }
  }, [pipelineData.auditEvidence, pipelineData.report]);

  const createFormalBundle = useCallback(async (inference: InferenceSnapshotV1) => {
    if (!pipelineData.report || !pipelineData.auditEvidence || !pipelineData.file) {
      throw new Error('Primero carga y audita el dataset controlado en Auditoría.');
    }
    return createFormalCampaignBundle({
      report: pipelineData.report,
      auditEvidence: pipelineData.auditEvidence,
      datasetFile: pipelineData.file,
      ollamaBaseUrl: aiConfig.ollamaBaseUrl || 'http://127.0.0.1:11434',
      appCommit: typeof __AURA_BUILD_SHA__ === 'string' ? __AURA_BUILD_SHA__ : '',
      inference,
    });
  }, [aiConfig.ollamaBaseUrl, pipelineData.auditEvidence, pipelineData.file, pipelineData.report]);

  const formalProviderForRun = useCallback((run: ExperimentRunV1) => createAIProvider({
    providerType: 'ollama',
    model: run.modelId,
    ollamaModel: run.modelId,
    ollamaBaseUrl: aiConfig.ollamaBaseUrl || 'http://127.0.0.1:11434',
    temperature: run.environment.inference.temperature,
    ollamaTopP: run.environment.inference.topP,
    ollamaNumCtx: run.environment.inference.numCtx,
    ollamaNumPredict: run.environment.inference.numPredict,
    ollamaSeed: run.environment.inference.seed,
    ollamaKeepAlive: run.environment.inference.keepAlive,
    ollamaTimeoutSeconds: run.environment.inference.timeoutSeconds,
    autoAnalyze: false,
  }), [aiConfig.ollamaBaseUrl]);

  const processFormalDiagnosis = useCallback((rawResponse: string, run: ExperimentRunV1) => {
    if (!formalEvidenceEnvelope || run.input.evidenceEnvelopeRef !== buildEnvelopeRef(formalEvidenceEnvelope)) {
      return {
        success: false as const,
        code: 'DIAGNOSIS_ENVELOPE_MISMATCH' as const,
        path: '$',
        message: 'No está disponible el sobre de evidencia congelado.',
        details: null,
      };
    }
    return processDiagnosisResponseV2(formalEvidenceEnvelope, rawResponse);
  }, [formalEvidenceEnvelope]);

  const formalInitialInference = useMemo(
    () => resolveOllamaInferenceConfig(aiConfig),
    [aiConfig],
  );

  const evaluateFormalRun = useCallback(async (run: ExperimentRunV1) => {
    if (!formalEvidenceEnvelope) throw new Error('No está disponible el sobre formal para evaluar la corrida.');
    return evaluateFormalDiagnosisRun(run, formalEvidenceEnvelope);
  }, [formalEvidenceEnvelope]);

  // Liberar memoria VRAM del WebLLM anterior al cambiar de proveedor o desmontar
  useEffect(() => {
    return () => {
      if (aiProvider && aiProvider.unloadModel) {
        aiProvider.unloadModel().catch((err) => {
          console.error('Error al descargar el modelo local al cambiar de proveedor:', err);
        });
      }
    };
  }, [aiProvider]);

  // ── Derived pipeline state ──
  const report = pipelineData.report;
  const auditEvidence = pipelineData.auditEvidence;
  const logs = pipelineData.logs;
  const pipelineState = pipelineData.state;
  const aiAnalysis = pipelineData.aiAnalysis;
  const approvedCleaningScript = pipelineData.approvedScript;
  const benchmarkResults = pipelineData.benchmarkResults;
  const deterministicValidation = pipelineData.deterministicValidation;
  const improvementRun = pipelineData.improvementRun;
  const scriptValidation = pipelineData.scriptValidation;
  const diagnosticReport = pipelineData.diagnosticReport;

  const criticalCount = countBySeverity(report, IssueSeverity.CRITICAL);
  const warningCount = countBySeverity(report, IssueSeverity.WARNING);

  const [hasExported, setHasExported] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState('');
  const [pdfProgressStatus, setPdfProgressStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [exportJsonPreflightError, setExportJsonPreflightError] = useState<string | null>(null);
  const [isEvidencePackageGenerating, setIsEvidencePackageGenerating] = useState(false);
  const [evidencePackageError, setEvidencePackageError] = useState<string | null>(null);
  const [sessionDestroyed, setSessionDestroyed] = useState(false);
  const [showNewAnalysisDialog, setShowNewAnalysisDialog] = useState(false);
  const [showDestroySessionDialog, setShowDestroySessionDialog] = useState(false);
  const [newSessionMessage, setNewSessionMessage] = useState<string | null>(null);

  const hasData = !!report;

  // ── Export handlers ──
  const handleDownloadPdf = async () => {
    if (!diagnosticReport && !report) return;
    setIsPdfGenerating(true);
    setPdfProgressStatus('running');
    setPdfProgressMsg(diagnosticReport ? 'Generando informe diagnóstico profesional...' : 'Construyendo reporte PDF...');
    try {
      // Delay state update to let the UI render the progress
      await new Promise(resolve => setTimeout(resolve, 100));
      if (diagnosticReport) {
        setPdfProgressMsg('Componiendo informe y anexos finales...');
        generateDiagnosticPdfReport({
          diagnosticReport,
          pythonScript: approvedCleaningScript || pipelineData.cleaningScript || undefined,
          pythonScriptApproved: Boolean(approvedCleaningScript),
        });
      } else if (report) {
        setPdfProgressMsg('Generando páginas del reporte...');
        generatePdfReport(report, buildDeterministicPdfContent(report, approvedCleaningScript), aiAnalysis, scriptValidation, undefined, improvementRun?.healthDelta ?? null);
      }
      setPdfProgressStatus('success');
      setPdfProgressMsg(diagnosticReport ? 'Informe diagnóstico PDF descargado' : 'Reporte PDF descargado');
      setHasExported(true);
    } catch {
      setPdfProgressStatus('error');
      setPdfProgressMsg('Error al generar PDF');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const buildCurrentTechnicalExport = (options: { includeCorrectedDataset?: boolean } = {}) => {
    if (!report) return null;
    const structDiag = pipelineData.structuredDiagnosis;
    const failureEv = pipelineData.diagnosisFailureEvidence;
    const diagnosisStatus = deriveDiagnosisExportStatus({
      structuredDiagnosis: structDiag,
      failureEvidence: failureEv,
    });
    const receipt = structDiag?.executionReceipt ?? failureEv?.executionReceipt ?? null;
    const remediationActions = pipelineData.remediationPlan?.plan ?? [];
    const scriptApproved = Boolean(
      pipelineData.approvedScript
      && pipelineData.scriptContractV2
      && pipelineData.scriptContractVerificationV2?.valid === true
      && pipelineData.approvedScript === pipelineData.scriptContractV2.scriptText
    );
    const exportDiagnosticReport = diagnosticReport
      ? {
          ...diagnosticReport,
          exportReadiness: {
            ...diagnosticReport.exportReadiness,
            scriptExportsReady: scriptApproved,
          },
        }
      : null;
    const manifest = buildEvidenceManifest({
      auditEvidence,
      deterministicValidation,
      benchmarkResults,
      diagnosisEvidence: {
        status: diagnosisStatus,
        receiptHash: receipt?.receiptHash ?? null,
        model: receipt?.observedModel ?? receipt?.requestedModel ?? null,
        inputMode: receipt?.effectiveInputMode ?? null,
      },
      remediationReview: pipelineData.remediationPlan
        ? {
            totalActions: remediationActions.length,
            approvedActions: remediationActions.filter(action => action.approvalStatus === 'approved').length,
            rejectedActions: remediationActions.filter(action => action.approvalStatus === 'rejected').length,
            pendingActions: remediationActions.filter(action => action.approvalStatus === 'pending').length,
            scriptApproved,
          }
        : null,
      scriptContractEvidence: {
        exists: Boolean(pipelineData.scriptContractV2),
        verified: pipelineData.scriptContractVerificationV2?.valid === true,
        scriptHash: pipelineData.scriptContractV2?.scriptHash ?? null,
      },
      scriptValidation,
      hitlDecision: improvementRun?.hitlDecision ?? null,
      healthDeltaPoints: improvementRun?.healthDelta?.scoreDelta,
    });
    let executionBundle = null;
    let bundleParseFailed = false;
    try {
      executionBundle = pipelineData.executionBundleJson
        ? parsePythonExecutionBundle(pipelineData.executionBundleJson)
        : null;
    } catch {
      executionBundle = null;
      bundleParseFailed = true;
    }
    const verifiedEvidence = pipelineData.verifiedEvidence ?? null;
    let remediationExecution: RemediationExecutionExportV1 = buildNotRunRemediationExecution();
    if (verifiedEvidence) {
      remediationExecution = {
        status: 'reaudited',
        executionBundle: verifiedEvidence.bundle,
        pythonReceipt: verifiedEvidence.receipt,
        verification: verifiedEvidence.verification,
        correctedDataset: {
          sha256: verifiedEvidence.verification.correctedDatasetSha256,
          rowCount: verifiedEvidence.verification.after.rowCount,
          columnCount: verifiedEvidence.verification.after.columnCount,
          includedInEvidenceArchive: options.includeCorrectedDataset === true,
        },
        limitations: [...verifiedEvidence.verification.limitations],
      };
    } else if (pipelineData.executionState === 'verified' && executionBundle && pipelineData.executionReceipt?.output) {
      remediationExecution = {
        status: 'verified',
        executionBundle,
        pythonReceipt: pipelineData.executionReceipt,
        verification: null,
        correctedDataset: {
          sha256: pipelineData.executionReceipt.afterDatasetSha256 ?? '',
          rowCount: pipelineData.executionReceipt.output.rowCount,
          columnCount: pipelineData.executionReceipt.output.columnCount,
          includedInEvidenceArchive: false,
        },
        limitations: ['La ejecución Python fue verificada, pero la reauditoría no está disponible.'],
      };
    } else if (pipelineData.executionState === 'invalid' || bundleParseFailed) {
      remediationExecution = {
        status: 'invalid', executionBundle, pythonReceipt: pipelineData.executionReceipt ?? null,
        verification: null, correctedDataset: null,
        limitations: [pipelineData.executionValidationError || (bundleParseFailed
          ? 'El bundle de ejecución no es JSON válido y no pudo certificarse.'
          : 'La ejecución no pudo certificarse.')],
      };
    } else if (executionBundle) {
      remediationExecution = {
        status: 'prepared', executionBundle, pythonReceipt: null,
        verification: null, correctedDataset: null,
        limitations: ['La ejecución fue preparada, pero todavía no existe un resultado Python verificado.'],
      };
    }
    const exportPackage = buildAuraExportPackage({
      manifest,
      profile: {
        report,
        auditEvidence,
      },
      deterministicValidation,
      diagnosticReport: exportDiagnosticReport,
      hitlDecision: improvementRun?.hitlDecision ?? null,
      diagnosis: {
        status: diagnosisStatus,
        model: receipt?.requestedModel ?? aiConfig.model,
        providerType: aiConfig.providerType,
        diagnosisText: aiAnalysis,
        structuredDiagnosis: structDiag ?? null,
        failureEvidence: failureEv ?? null,
        inputSnapshot: (structDiag?.inputSnapshot ?? failureEv?.inputSnapshot ?? null) as unknown as Record<string, unknown> | null,
        executionReceipt: (structDiag?.executionReceipt ?? failureEv?.executionReceipt ?? null) as unknown as Record<string, unknown> | null,
        rawResponseHash: structDiag?.rawResponseHash ?? failureEv?.rawResponseHash ?? null,
        rawResponse: structDiag?.rawResponse ?? failureEv?.rawResponse ?? null,
      },
      script: {
        generatedScript: pipelineData.cleaningScript,
        scriptValidation,
        approvedScript: pipelineData.approvedScript,
        remediationPlan: pipelineData.remediationPlan,
        contract: pipelineData.scriptContractV2,
        verification: pipelineData.scriptContractVerificationV2,
      },
      benchmarkResults,
      improvementRun,
      remediationExecution,
    });
    const preflight = validateAuraExportPackage(exportPackage);
    return { exportPackage, preflight, exportDiagnosticReport };
  };

  const buildCurrentIssuesCsv = () => {
    if (!report) return null;
    const receiptHash = pipelineData.structuredDiagnosis?.executionReceipt?.receiptHash
      ?? pipelineData.diagnosisFailureEvidence?.executionReceipt.receiptHash
      ?? null;
    const scriptApproved = Boolean(
      pipelineData.approvedScript
      && pipelineData.scriptContractV2
      && pipelineData.scriptContractVerificationV2?.valid === true
      && pipelineData.approvedScript === pipelineData.scriptContractV2.scriptText
    );
    const exportDiagnosticReport = diagnosticReport
      ? {
          ...diagnosticReport,
          exportReadiness: {
            ...diagnosticReport.exportReadiness,
            scriptExportsReady: scriptApproved,
          },
        }
      : null;
    const identity = buildExportArtifactIdentity({
      report,
      auditEvidence,
      diagnosticReport: exportDiagnosticReport,
      diagnosisReceiptHash: receiptHash,
    });
    const header = [
      'runId', 'reportId', 'datasetSha256', 'diagnosisReceiptHash', 'reportContentHash',
      'id', 'ruleId', 'severity', 'category', 'ruleName', 'column', 'count',
      'affectedPercentage', 'description', 'sampleValues',
    ];
    const rows = report.issues.map((issue) => [
      identity.runId, identity.reportId, identity.datasetSha256 ?? '',
      identity.diagnosisReceiptHash ?? '', identity.reportContentHash,
      issue.id, issue.ruleId, issue.severity, issue.category, issue.ruleName,
      issue.column ?? '', issue.count,
      issue.affectedPercentage.toFixed(2), issue.description,
      issue.sampleValues.map(String).join(' | '),
    ]);
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  };

  const handleExportJson = () => {
    const current = buildCurrentTechnicalExport();
    if (!current) return;
    const { exportPackage, preflight } = current;
    if (!preflight.valid) {
      console.warn('export.preflight.failed', {
        errors: preflight.errors,
        warnings: preflight.warnings,
      });
      setExportJsonPreflightError(
        'No se descargó el JSON técnico porque el paquete no superó la validación interna. Revisa la sesión e inténtalo de nuevo.',
      );
      return;
    }
    if (preflight.warnings.length > 0) {
      console.warn('export.preflight.warnings', preflight.warnings);
    }
    setExportJsonPreflightError(null);
    downloadTextFile(
      `aura_audit_${Date.now()}.json`,
      JSON.stringify(exportPackage, null, 2),
      'application/json;charset=utf-8'
    );
    setHasExported(true);
  };

  const handleExportIssuesCsv = () => {
    const csv = buildCurrentIssuesCsv();
    if (!csv) return;
    downloadTextFile(`aura_issues_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
    setHasExported(true);
  };

  const handleExportEvidencePackage = async () => {
    const current = buildCurrentTechnicalExport({
      includeCorrectedDataset: includeCorrectedInEvidenceArchive,
    });
    const issuesCsv = buildCurrentIssuesCsv();
    if (!current || !issuesCsv) return;
    if (!current.preflight.valid) {
      console.warn('evidence-package.preflight.failed', current.preflight.errors);
      setEvidencePackageError(
        'El paquete no se descargó porque el expediente técnico no superó la validación interna.',
      );
      return;
    }

    // If the UI claims a verified execution + completed reaudit but the
    // in-memory evidence (corrected.csv bytes + reaudit reports) is missing,
    // stop the full ZIP and ask to reimport the output files.
    const claimsVerifiedRemediation =
      pipelineData.executionState === 'verified'
      && pipelineData.reauditState === 'completed';
    if (claimsVerifiedRemediation && !pipelineData.verifiedEvidence) {
      setEvidencePackageError(
        'La ejecución figura como verificada, pero corrected.csv y receipt.json ya no están en memoria. Volvé al paso "Aplicar y verificar" y reimportá ambos archivos antes de descargar el ZIP.',
      );
      return;
    }

    setIsEvidencePackageGenerating(true);
    setEvidencePackageError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      let diagnosticPdf: Uint8Array | null = null;
      if (current.exportDiagnosticReport) {
        generateDiagnosticPdfReport({
          diagnosticReport: current.exportDiagnosticReport,
          pythonScript: approvedCleaningScript || pipelineData.cleaningScript || undefined,
          pythonScriptApproved: Boolean(approvedCleaningScript),
          save: (doc) => {
            diagnosticPdf = new Uint8Array(doc.output('arraybuffer'));
          },
        });
      }
      const archive = await buildEvidenceArchive({
        technicalExport: current.exportPackage,
        issuesCsv,
        diagnosticPdf,
        activityLog: logs,
        verifiedExecution: pipelineData.verifiedEvidence ?? null,
        includeCorrectedDataset: includeCorrectedInEvidenceArchive,
      });
      downloadBlob(
        archive.filename,
        new Blob([Uint8Array.from(archive.bytes)], { type: 'application/zip' }),
      );
      setHasExported(true);
    } catch (error) {
      console.error('evidence-package.failed', error);
      setEvidencePackageError('No fue posible construir el ZIP de evidencia. La sesión permanece intacta.');
    } finally {
      setIsEvidencePackageGenerating(false);
    }
  };

  const handleDownloadExecutionBundle = () => {
    if (!pipelineData.executionBundleJson) return;
    downloadTextFile('execution-bundle.json', pipelineData.executionBundleJson, 'application/json;charset=utf-8');
  };

  const handleDownloadExecutionReceipt = () => {
    if (!pipelineData.executionReceipt) return;
    downloadTextFile('python-execution-receipt.json', JSON.stringify(pipelineData.executionReceipt, null, 2), 'application/json;charset=utf-8');
  };

  const handleDownloadCorrectedDataset = () => {
    const corrected = pipelineData.verifiedEvidence?.correctedCsv;
    if (!corrected) return;
    downloadBlob('corrected.csv', new Blob([Uint8Array.from(corrected)], { type: 'text/csv;charset=utf-8' }));
  };

  const returnToDiagnosticReport = () => {
    setPipelineData(current => ({
      ...current,
      state: current.diagnosticReport ? 'diagnostic_report' : 'diagnosis',
    }));
    requestAnimationFrame(() => scrollTo('sistema'));
  };

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goHome = () => {
    setShowHome(true);
    setShowExperimentCampaign(false);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goAudit = () => {
    setShowHome(false);
    setShowExperimentCampaign(false);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
    requestAnimationFrame(() => scrollTo('sistema'));
  };

  const goExperimentCampaign = () => {
    setShowHome(false);
    setShowExperimentCampaign(true);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyCampaignPipelineConfiguration = (configuration: CampaignPipelineConfigurationV1) => {
    setAiConfig((current) => applyCampaignConfigurationToAIConfig(current, configuration));
  };

  const goSettings = () => {
    setShowHome(false);
    setShowSettings(true);
    setShowExperimentCampaign(false);
    setShowAuditLog(false);
    setShowHelp(false);
    setShowMobileNav(false);
  };

  const handleDestroySession = () => {
    setShowDestroySessionDialog(true);
  };

  const confirmDestroySession = () => {
    clearPipelineSession();
    setPipelineData(INITIAL_PIPELINE_DATA);
    setShowHome(false);
    setHasExported(false);
    setPdfProgressStatus('idle');
    setPdfProgressMsg('');
    setSessionDestroyed(true);
    setShowDestroySessionDialog(false);
  };

  const handleNewAnalysis = () => {
    if (hasData) {
      setShowNewAnalysisDialog(true);
    } else {
      performNewAnalysis();
    }
  };

  const performNewAnalysis = () => {
    clearPipelineSession();
    setPipelineData(INITIAL_PIPELINE_DATA);
    setShowHome(true);
    setShowExperimentCampaign(false);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowChangelog(false);
    setShowMobileNav(false);
    setHasExported(false);
    setPdfProgressStatus('idle');
    setPdfProgressMsg('');
    setSessionDestroyed(false);
    setExportJsonPreflightError(null);
    setShowNewAnalysisDialog(false);
    setNewSessionMessage('Nueva sesión iniciada — el espacio de trabajo quedó limpio.');
    setTimeout(() => setNewSessionMessage(null), 4000);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  return (
    <ErrorBoundary><div className="aura-system">
      {showAuditLog && <AuditLogViewer onClose={() => setShowAuditLog(false)} />}

      {/* Navigation */}
      <nav className="sys-nav">
        {/* Bloque Izquierdo: Branding */}
        <div className="nav-brand" onClick={goHome} aria-label="Ir al inicio">
          <span className="nav-logo-mark nav-logo-mark--visible" aria-hidden="true">
            <svg className="aura-mark aura-data-mark" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="10" y="10" width="44" height="44" rx="8" />
              <path d="M20 44V32" />
              <path d="M32 44V24" />
              <path d="M44 44V18" />
              <path d="M18 24l10 6 8-10 10 6" />
              <circle cx="18" cy="24" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="28" cy="30" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="36" cy="20" r="1.8" fill="currentColor" stroke="none" />
              <circle cx="46" cy="26" r="1.8" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="nav-logo">AURA</span>
        </div>

        <div className="nav-right-cluster">
          {/* Bloque Derecho: Navegación de Capas (Escritorio) */}
          <div className="nav-center-menu">
            <button
              className={`nav-menu-item ${showHome ? 'active' : ''}`}
              onClick={goHome}
            >
              Home
            </button>

            <button
              className={`nav-menu-item ${!showHome && !showExperimentCampaign && !showAuditLog && !showSettings ? 'active' : ''}`}
              onClick={goAudit}
            >
              Auditoría
            </button>

            <button
              className={`nav-menu-item ${showExperimentCampaign ? 'active' : ''}`}
              onClick={goExperimentCampaign}
            >
              Laboratorio
            </button>

            <button
              className={`nav-menu-item ${showSettings ? 'active' : ''}`}
              onClick={goSettings}
            >
              Configuración
            </button>
          </div>

          {/* Controles mínimos (Escritorio) */}
          <div className="nav-system-controls">
            <label className="theme-toggle" aria-label="Cambiar tema">
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
              />
            </label>

            {hasData && (
              <button
                className="nav-reset-cta"
                onClick={handleNewAnalysis}
                data-testid="nav-new-analysis"
                type="button"
              >
                Nuevo análisis
              </button>
            )}
          </div>
        </div>

        {/* Botón Hamburguesa Móvil */}
        <button className="mobile-nav-toggle" onClick={() => setShowMobileNav(!showMobileNav)}>
          <div className={`hamburger ${showMobileNav ? 'open' : ''}`}>
            <span /><span /><span />
          </div>
        </button>
      </nav>

      {/* Mobile Navigation Menu */}
      <div className={`nav-links ${showMobileNav ? 'nav-links-open' : ''}`}>
        <button className="nav-link" onClick={goHome}>
          Home
        </button>
        <button className="nav-link" onClick={goAudit}>
          Auditoría
        </button>
        <button className="nav-link" onClick={goExperimentCampaign}>
          Laboratorio
        </button>
        <button className="nav-link" onClick={goSettings}>
          Configuración
        </button>
        <button className="nav-link" onClick={() => { setShowHome(false); setShowExperimentCampaign(false); setShowAuditLog(true); setShowMobileNav(false); }}>
          Trazabilidad
        </button>
        <button className="nav-link" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </div>

      {/* Settings and help stay inside the persistent app shell. */}
      {showSettings && (
        <SettingsPanel config={aiConfig} onSave={setAiConfig} onClose={() => setShowSettings(false)} />
      )}

      {showHelp && (
        <HelpCenter onClose={() => setShowHelp(false)} />
      )}

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      {showExperimentCampaign && (
        <Suspense fallback={<div className="oe4-campaign-loading">Preparando Laboratorio…</div>}>
          {oe4E2eHarnessEnabled && Oe4CampaignE2eHarness
            ? <Oe4CampaignE2eHarness />
            : <BenchmarkCampaignLab
                ollamaBaseUrl={aiConfig.ollamaBaseUrl || 'http://127.0.0.1:11434'}
                providerForRun={formalProviderForRun}
                processDiagnosis={processFormalDiagnosis}
                initialInference={formalInitialInference}
                createCampaignBundle={formalEvidenceEnvelope && pipelineData.file ? createFormalBundle : undefined}
                evaluateRun={evaluateFormalRun}
                onApplyPipelineConfiguration={applyCampaignPipelineConfiguration}
                onGoToAudit={goAudit}
              />}
        </Suspense>
      )}

      {/* AV Fixture — render Apply & Verify step visual states */}
      {AvFixture && window.location.search.includes('av-fixture=') && (
        <Suspense fallback={<div className="step-card" style={{ padding: '2rem', textAlign: 'center' }}>Cargando fixture visual…</div>}>
          <AvFixture />
        </Suspense>
      )}

      {AvFixture && window.location.search.includes('av-fixture=') ? null : (
      <>
      {/* Main Content — only show when not in settings or help. */}
      <main className="sys-main" style={{ display: showExperimentCampaign || showSettings || showHelp ? 'none' : undefined }}>
        {showHome && (
          <section className="home-hero" id="home">
            <p className="home-eyebrow">diagnóstico reproducible de datos</p>
            <h1 className="home-title">AURA</h1>
            <p className="home-desc">
              Un entorno local para cargar un CSV, perfilar su calidad, priorizar hallazgos y producir evidencia defendible antes de limpiar o publicar datos.
            </p>
            <div className="home-actions">
              <button className="btn-p btn--lg" onClick={goAudit}>Empezar auditoría</button>
            </div>
            <div className="home-flow" aria-label="Resumen del proceso AURA">
              <div className="home-flow-step">
                <span>01</span>
                <strong>Perfilar</strong>
                <p>Lectura del CSV, delimitador, columnas, volumen y señales de riesgo.</p>
              </div>
              <div className="home-flow-step">
                <span>02</span>
                <strong>Diagnosticar</strong>
                <p>Reglas deterministas, severidad, evidencia y asistencia del modelo cuando aplica.</p>
              </div>
              <div className="home-flow-step">
                <span>03</span>
                <strong>Defender</strong>
                <p>Reporte, hallazgos, script revisable y trazabilidad de decisiones.</p>
              </div>
            </div>
          </section>
        )}

        {sessionDestroyed && (
          <section className="section" style={{ textAlign: 'center' }} data-testid="session-destroyed-msg">
            <p className="sec-eye" style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
              Sesión destruida — tus datos locales fueron eliminados del navegador.
            </p>
          </section>
        )}

        {newSessionMessage && (
          <section className="section" style={{ textAlign: 'center' }} data-testid="new-session-msg">
            <p className="sec-eye" style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
              {newSessionMessage}
            </p>
          </section>
        )}

        {/* Main Pipeline — Phase 1: Upload + Diagnostic */}
        {!showHome && pipelineState !== 'export' && (
          <section id="sistema" className="audit-workspace">
            <MainPipeline
              aiConfig={aiConfig}
              aiProvider={aiProvider}
              initialData={pipelineData}
              onPipelineChange={setPipelineData}
              onAiConfigChange={setAiConfig}
              onOpenSettings={goSettings}
              onLog={(stage, msg) => { /* logs handled internally by MainPipeline */ }}
            />
          </section>
        )}

        {/* ── Export Section ── */}
        {!showHome && report && pipelineState === 'export' && (
          <section className="export-closure" id="export-section" data-testid="export-stage">
            <button
              type="button"
              className="btn-s export-return-button"
              onClick={returnToDiagnosticReport}
              data-testid="export-return-to-results"
            >
              <ArrowLeft size={14} /> Volver al informe diagnóstico
            </button>
            <div className="export-closure-header">
              <p className="sec-eye">EXPORTACIÓN</p>
              <h2 className="sec-title">Exportación de resultados</h2>
            </div>
            <p className="section-note export-closure-hero-desc">
              Descarga los resultados del análisis y cierra la sesión local cuando ya no necesites conservar los datos en el navegador.
            </p>

            <p className="export-validity-note" data-testid="export-validity-note">
              El JSON técnico conserva el recibo que certifica el método solicitado y efectivo, las secciones enviadas, el modelo observado y los hashes de entrada, prompt y respuesta. Una ejecución sin esa evidencia no se exporta como válida.
            </p>

            <div className="export-remediation-status" data-testid="export-remediation-status">
              <div>
                <p className="export-delivery-block-eyebrow">Remediación opcional</p>
                <h3 className="export-delivery-block-title">
                  {pipelineData.verifiedEvidence
                    ? 'Reauditoría completada'
                    : pipelineData.executionState === 'verified'
                      ? 'Ejecución verificada'
                      : pipelineData.executionState === 'invalid'
                        ? 'Ejecución no certificada'
                        : pipelineData.executionBundleJson
                          ? 'Ejecución preparada'
                          : 'No ejecutada'}
                </h3>
                {!pipelineData.executionBundleJson && !pipelineData.verifiedEvidence && (
                  <p data-testid="export-remediation-not-run">
                    El análisis fue completado, pero no se ejecutó una remediación sobre el dataset
                  </p>
                )}
              </div>
              {(pipelineData.executionBundleJson || pipelineData.executionReceipt || pipelineData.verifiedEvidence) && (
                <div className="btn-row export-remediation-actions">
                  {pipelineData.executionBundleJson && (
                    <button className="btn-s btn-sm" onClick={handleDownloadExecutionBundle} data-testid="export-download-execution-bundle">
                      Descargar bundle
                    </button>
                  )}
                  {pipelineData.executionReceipt && (
                    <button className="btn-s btn-sm" onClick={handleDownloadExecutionReceipt} data-testid="export-download-python-receipt">
                      Descargar recibo
                    </button>
                  )}
                  {pipelineData.verifiedEvidence && (
                    <button className="btn-s btn-sm" onClick={handleDownloadCorrectedDataset} data-testid="export-download-corrected-csv">
                      Descargar corrected.csv
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="export-delivery-block" data-testid="export-main-block">
              <p className="export-delivery-block-eyebrow">Resultados</p>
              <h3 className="export-delivery-block-title">Archivos disponibles</h3>
              <div className="export-delivery-cards">
                <article className="export-delivery-card export-delivery-card--primary export-delivery-card--evidence">
                  <div className="export-delivery-card-head">
                    <Download size={20} />
                    <div>
                      <h4>Paquete completo de evidencia</h4>
                      <p>Un solo ZIP con el PDF, JSON técnico, hallazgos, prompt exacto, respuesta del modelo, recibo, plan, contrato, verificación, script, actividad y vistas SVG reproducibles.</p>
                    </div>
                  </div>
                  <div className="export-delivery-card-action">
                    <p className="export-delivery-card-desc">
                      El CSV original no se incluye; queda identificado por su SHA-256. El expediente puede contener muestras de los hallazgos, por lo que debes revisarlo antes de compartirlo. Cada artefacto lleva hash y tamaño en manifest.json.
                    </p>
                    {pipelineData.verifiedEvidence && (
                      <label className="export-corrected-opt-in" data-testid="export-corrected-opt-in">
                        <input
                          type="checkbox"
                          checked={includeCorrectedInEvidenceArchive}
                          onChange={(event) => setIncludeCorrectedInEvidenceArchive(event.target.checked)}
                        />
                        <span>
                          Incluir corrected.csv en el ZIP. Puede contener datos personales (PII); revisa el archivo antes de compartirlo.
                        </span>
                      </label>
                    )}
                    <button
                      className="btn-p btn-sm export-primary-outline"
                      onClick={handleExportEvidencePackage}
                      disabled={isEvidencePackageGenerating}
                      data-testid="export-download-evidence-package"
                    >
                      {isEvidencePackageGenerating ? 'Preparando ZIP…' : 'Descargar evidencia completa (.zip)'}
                    </button>
                  </div>
                  {evidencePackageError && (
                    <div className="provider-unavailable-notice" role="alert" data-testid="export-evidence-package-warning">
                      <strong>Paquete no exportado.</strong>{' '}
                      {evidencePackageError}
                    </div>
                  )}
                </article>

                <article className="export-delivery-card">
                  <div className="export-delivery-card-head">
                    <FileText size={20} />
                    <div>
                      <h4>Informe diagnóstico PDF</h4>
                      <p>Documento de lectura con resumen ejecutivo, hallazgos priorizados, gráficos y límites metodológicos.</p>
                    </div>
                  </div>
                  <div className="export-delivery-card-action">
                    {isPdfGenerating ? (
                      <>
                        <span className="export-delivery-status export-delivery-status--generating">Generando…</span>
                        <ProgressDisclosure
                          title="Generando informe diagnóstico PDF"
                          indeterminate={pdfProgressStatus === 'running'}
                          status={pdfProgressStatus}
                          currentStep={pdfProgressMsg}
                          compact
                        />
                      </>
                    ) : (
                      <>
                        <p className="export-delivery-card-desc" data-testid="export-pdf-desc">Informe diagnóstico profesional con hallazgos, gráficos y recomendaciones. Para revisión humana.</p>
                        <button className="btn-s btn-sm" onClick={handleDownloadPdf} disabled={isPdfGenerating} data-testid="export-download-pdf">
                          Descargar PDF
                        </button>
                      </>
                    )}
                  </div>
                </article>

                <article className="export-delivery-card">
                  <div className="export-delivery-card-head">
                    <FileJson size={18} />
                    <div>
                      <h4>JSON técnico</h4>
                      <p>Expediente estructurado completo para auditoría, reproducción técnica o integración externa.</p>
                    </div>
                  </div>
                  {exportJsonPreflightError ? (
                    <div className="provider-unavailable-notice" role="alert" data-testid="export-json-preflight-warning">
                      <strong>JSON técnico no exportado.</strong>{' '}
                      {exportJsonPreflightError}
                    </div>
                  ) : (
                    <div className="export-delivery-card-action">
                      <p className="export-delivery-card-desc" data-testid="export-json-desc">Incluye perfil, hallazgos, diagnóstico, snapshot de entrada y recibo con el método realmente usado. Es la fuente técnica completa.</p>
                      <button className="btn-s btn-sm" onClick={handleExportJson} data-testid="export-download-json">
                        Descargar JSON
                      </button>
                    </div>
                  )}
                </article>

                <article className="export-delivery-card">
                  <div className="export-delivery-card-head">
                    <Download size={18} />
                    <div>
                      <h4>CSV de hallazgos</h4>
                      <p>Vista tabular de los hallazgos para hojas de cálculo o revisión QA.</p>
                    </div>
                  </div>
                  <div className="export-delivery-card-action">
                    <p className="export-delivery-card-desc" data-testid="export-csv-desc">Resume los mismos hallazgos deterministas del JSON en filas fáciles de filtrar. Lo complementa; no contiene el recibo técnico.</p>
                    <button className="btn-s btn-sm" onClick={handleExportIssuesCsv}>
                      Descargar CSV
                    </button>
                  </div>
                </article>
              </div>
            </div>

            <div className="export-session-block" data-testid="export-session-block">
              <p className="export-delivery-block-eyebrow">Sesión local</p>
              <h3 className="export-delivery-block-title">Cerrar y destruir datos locales</h3>
              <p className="export-session-block-desc">
                El análisis se conserva en el navegador para que puedas volver al flujo. Al cerrar, AURA elimina la sesión local y vuelve a la carga inicial.
              </p>
              <button
                className="btn-s export-destroy-button"
                onClick={handleDestroySession}
                data-testid="export-destroy-session"
              >
                Cerrar sesión y destruir datos locales
              </button>
            </div>
          </section>
        )}
      </main>
      <footer className="sys-footer" style={{ display: showSettings || showHelp ? 'none' : undefined }}>
        <span className="footer-brand">AURA</span>
        <div className="footer-links">
          <button className="footer-link" onClick={() => setShowHelp(true)}>Ayuda</button>
          <button className="footer-link" onClick={() => setShowChangelog(true)}>Historial</button>
        </div>
        <span className="footer-copy">casabero · aura · 2026</span>
      </footer>
      </>
      )}
    </div>

      {showNewAnalysisDialog && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNewAnalysisDialog(false); }} data-testid="new-analysis-dialog">
          <div className="modal-container modal-container--sm">
            <div className="modal-header">
              <AlertTriangle size={20} style={{ color: 'var(--orange)' }} />
              <h3>Nuevo análisis</h3>
              <button className="modal-close" onClick={() => setShowNewAnalysisDialog(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--space-md)' }}>
              <p style={{ marginBottom: 'var(--space-sm)', color: 'var(--ink2)', fontSize: '13px', lineHeight: 1.6 }}>
                <strong>Se eliminarán</strong> el análisis actual, diagnósticos, scripts, decisiones humanas y archivos preparados.
              </p>
              <p style={{ marginBottom: 'var(--space-sm)', color: 'var(--ink2)', fontSize: '13px', lineHeight: 1.6 }}>
                <strong>Se preservarán.</strong> La configuración del proveedor y los modelos no se modificarán.
              </p>
              <p style={{ color: 'var(--ink3)', fontSize: '12px', fontStyle: 'italic' }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', padding: 'var(--space-md)', borderTop: '1px solid var(--border-faint)' }}>
              <button className="btn-s" onClick={() => setShowNewAnalysisDialog(false)}>Cancelar</button>
              <button className="btn-p btn-p--destructive" onClick={performNewAnalysis} data-testid="new-analysis-confirm">
                <Trash2 size={14} /> Limpiar y nueva sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {showDestroySessionDialog && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDestroySessionDialog(false); }} data-testid="destroy-session-dialog">
          <div className="modal-container modal-container--sm">
            <div className="modal-header">
              <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
              <h3>Cerrar sesión y destruir datos</h3>
              <button className="modal-close" onClick={() => setShowDestroySessionDialog(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--space-md)' }}>
              <p style={{ marginBottom: 'var(--space-sm)', color: 'var(--ink2)', fontSize: '13px', lineHeight: 1.6 }}>
                <strong>Se eliminarán</strong> el análisis actual, diagnósticos, scripts, decisiones humanas y archivos preparados.
              </p>
              <p style={{ marginBottom: 'var(--space-sm)', color: 'var(--ink2)', fontSize: '13px', lineHeight: 1.6 }}>
                <strong>Se preservarán.</strong> La configuración del proveedor y los modelos no se modificarán.
              </p>
              <p style={{ color: 'var(--ink3)', fontSize: '12px', fontStyle: 'italic' }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', padding: 'var(--space-md)', borderTop: '1px solid var(--border-faint)' }}>
              <button className="btn-s" onClick={() => setShowDestroySessionDialog(false)}>Cancelar</button>
              <button className="btn-p btn-p--destructive" onClick={confirmDestroySession} data-testid="destroy-session-confirm">
                <Trash2 size={14} /> Destruir datos locales
              </button>
            </div>
          </div>
        </div>
      )}

    </ErrorBoundary>
  );
};

export default App;
