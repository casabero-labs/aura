import React, { useEffect, useMemo, useState } from 'react';

declare const __AURA_BUILD_SHA__: string;
declare const __AURA_BUILD_TIME__: string;

if (typeof __AURA_BUILD_SHA__ !== 'undefined') {
  console.log(
    `%c[AURA] Build: ${__AURA_BUILD_SHA__} | ${__AURA_BUILD_TIME__}`,
    'color: #888; font-size: 11px; font-family: monospace;',
  );
}
import { ChevronDown, ClipboardList, Download, FileCode2, FileJson, FileText, FlaskConical, HelpCircle, Settings, Layers, History, CheckCircle2, ShieldCheck, AlertTriangle, XCircle, Sun, Moon, BookOpen } from 'lucide-react';
import ChangelogModal from './components/ChangelogModal';
import ErrorBoundary from './components/ErrorBoundary';
import AuditLogViewer from './components/AuditLogViewer';
import BenchmarkLab from './components/BenchmarkLab';
import ImprovementRunPage from './components/ImprovementRunPage';
import SettingsPanel from './components/SettingsPanel';
import HelpCenter from './components/HelpCenter';
import ProgressDisclosure from './components/ProgressDisclosure';
import MainPipeline, { PipelineData } from './components/MainPipeline';
import { loadFromApi, syncToApi } from './services/api';
import { createAIProvider } from './services/aiProvider';
import { generatePdfReport } from './services/pdfGenerator';
import { generateDiagnosticPdfReport } from './services/diagnosticReport';
import { buildEvidenceManifest } from './services/evidenceManifest';
import { buildAuraExportPackage } from './services/exportPackage';
import { validateAuraExportPackage } from './services/exportContractValidation';
import { savePipelineSession, loadPipelineSession, clearPipelineSession } from './services/pipelineSession';
import { buildColabNotebookJSON } from './services/colabExporter';
import { downloadTextFile } from './utils/download';
import { AIConfig, AuditReport, BenchmarkResult, DeterministicValidationReport, EvidenceManifest, ExecutiveReportContent, IssueSeverity } from './types';

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
      'Re-auditar el dataset despues de la limpieza para medir delta de salud.',
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
        diagnosticReport: (snap as any).diagnosticReport ?? null,
        remediationPlan: (snap as any).remediationPlan ?? null,
        scriptContractV2: (snap as any).scriptContractV2 ?? null,
        scriptContractVerificationV2: (snap as any).scriptContractVerificationV2 ?? null,
        benchmarkResults: snap.benchmarkResults,
        improvementRun: snap.improvementRun,
        scriptValidation: snap.scriptValidation,
        deterministicValidation: snap.deterministicValidation,
        logs: snap.logs,
      };
    }
    return INITIAL_PIPELINE_DATA;
  });

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showImprovementRun, setShowImprovementRun] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [brandScrolled, setBrandScrolled] = useState(false);
  const [labBenchmarkResults, setLabBenchmarkResults] = useState<BenchmarkResult[]>([]);
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

  useEffect(() => {
    const onScroll = () => setBrandScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── AI Config (para settings panel) ──
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const local = localStorage.getItem('aura_ai_config');
    if (local) return { providerType: 'chrome', temperature: 0.1, autoAnalyze: false, ...JSON.parse(local) };
    return {
      model: 'gemini-nano',
      temperature: 0.1,
      autoAnalyze: false,
      providerType: 'chrome',
      apiKey: '',
      cloudProvider: undefined,
    };
  });

  useEffect(() => {
    loadFromApi<AIConfig>('ai_config', aiConfig).then((remote) => {
      if (JSON.stringify(remote) !== JSON.stringify(aiConfig)) setAiConfig(remote);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_ai_config', JSON.stringify(aiConfig));
    syncToApi('ai_config', aiConfig);
  }, [aiConfig]);

  const aiProvider = useMemo(() => createAIProvider(aiConfig), [aiConfig]);

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
  const rawData = pipelineData.rawData;
  const csvFields = pipelineData.csvFields;
  const csvDelimiter = pipelineData.csvDelimiter;
  const file = pipelineData.file;
  const logs = pipelineData.logs;
  const pipelineState = pipelineData.state;
  const aiAnalysis = pipelineData.aiAnalysis;
  const approvedCleaningScript = pipelineData.approvedScript;
  const benchmarkResults = pipelineData.benchmarkResults.length > 0
    ? pipelineData.benchmarkResults
    : labBenchmarkResults;
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
  const [sessionDestroyed, setSessionDestroyed] = useState(false);

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
        setPdfProgressMsg('Dibujando gráficos y tablas del informe...');
        generateDiagnosticPdfReport({ diagnosticReport });
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

  const handleExportJson = () => {
    if (!report) return;
    const manifest = buildEvidenceManifest({
      auditEvidence,
      deterministicValidation,
      benchmarkResults,
      scriptValidation,
      hitlDecision: improvementRun?.hitlDecision ?? null,
      healthDeltaPoints: improvementRun?.healthDelta?.scoreDelta,
    });
    const exportPackage = buildAuraExportPackage({
      manifest,
      profile: {
        report,
        auditEvidence,
      },
      deterministicValidation,
      hitlDecision: improvementRun?.hitlDecision ?? null,
      diagnosis: {
        model: aiConfig.model,
        providerType: aiConfig.providerType,
        diagnosisText: aiAnalysis,
      },
      script: {
        generatedScript: pipelineData.cleaningScript,
        scriptValidation,
        approvedScript: pipelineData.approvedScript,
      },
      benchmarkResults,
      improvementRun,
    });
    const preflight = validateAuraExportPackage(exportPackage);
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
    if (!report) return;
    const header = ['id', 'severity', 'category', 'ruleName', 'column', 'count', 'affectedPercentage', 'description', 'sampleValues'];
    const rows = report.issues.map((issue) => [
      issue.id, issue.severity, issue.category, issue.ruleName,
      issue.column ?? '', issue.count,
      issue.affectedPercentage.toFixed(2), issue.description,
      issue.sampleValues.map(String).join(' | '),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    downloadTextFile(`aura_issues_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
    setHasExported(true);
  };

  const handleExportApprovedScript = () => {
    if (!approvedCleaningScript) return;
    downloadTextFile(`aura_script_aprobado_${Date.now()}.py`, approvedCleaningScript, 'text/x-python;charset=utf-8');
    setHasExported(true);
  };

  const handleExportColab = () => {
    if (!approvedCleaningScript || !report) return;
    const notebook = buildColabNotebookJSON({
      datasetName: file?.name ?? 'dataset.csv',
      csvFields,
      approvedScript: approvedCleaningScript,
      auditSummary: {
        score: report.score,
        rowCount: report.rowCount,
        colCount: report.colCount,
        issueCount: report.issues.length,
        truncated: auditEvidence?.truncated ?? false,
      },
    });
    downloadTextFile(`aura_colab_${Date.now()}.ipynb`, notebook, 'application/x-ipynb+json;charset=utf-8');
    setHasExported(true);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goHome = () => {
    setShowHome(true);
    setShowLab(false);
    setShowImprovementRun(false);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goAudit = () => {
    setShowHome(false);
    setShowLab(false);
    setShowImprovementRun(false);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
    requestAnimationFrame(() => scrollTo('sistema'));
  };

  const goLab = () => {
    setShowHome(false);
    setShowLab(true);
    setShowImprovementRun(false);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
  };

  const goImprovementRun = () => {
    setShowHome(false);
    setShowLab(false);
    setShowImprovementRun(true);
    setShowAuditLog(false);
    setShowSettings(false);
    setShowHelp(false);
    setShowMobileNav(false);
  };

  const goSettings = () => {
    setShowHome(false);
    setShowSettings(true);
    setShowLab(false);
    setShowImprovementRun(false);
    setShowAuditLog(false);
    setShowHelp(false);
    setShowMobileNav(false);
  };

  const handleDestroySession = () => {
    clearPipelineSession();
    setPipelineData(INITIAL_PIPELINE_DATA);
    setShowHome(false);
    setHasExported(false);
    setPdfProgressStatus('idle');
    setPdfProgressMsg('');
    setSessionDestroyed(true);
  };

  const handleNewAnalysis = () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        'Esto limpiará el análisis actual del navegador y volverá a la carga inicial. ¿Deseas continuar?',
      );
      if (!confirmed) return;
    }
    clearPipelineSession();
    setPipelineData(INITIAL_PIPELINE_DATA);
    setShowHome(true);
    setShowLab(false);
    setShowImprovementRun(false);
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
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  return (
    <ErrorBoundary><div className="aura-system">
      {showAuditLog && <AuditLogViewer onClose={() => setShowAuditLog(false)} />}

      {/* Settings — full workspace when active */}
      {showSettings && (
        <SettingsPanel config={aiConfig} onSave={setAiConfig} onClose={() => setShowSettings(false)} />
      )}

      {/* Help — full workspace when active */}
      {showHelp && (
        <HelpCenter onClose={() => setShowHelp(false)} />
      )}

      {/* Navigation */}
      <nav className="sys-nav">
        {/* Bloque Izquierdo: Branding */}
        <div className="nav-brand" onClick={goHome} aria-label="Ir al inicio">
          <span className={`nav-logo ${brandScrolled ? 'nav-logo--hidden' : ''}`}>AURA</span>
          <span className={`nav-logo-mark ${brandScrolled ? 'nav-logo-mark--visible' : ''}`} aria-hidden="true">
            <svg className="aura-mark" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.55">
              <ellipse cx="32" cy="32" rx="24" ry="8.5" />
              <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(60 32 32)" />
              <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(-60 32 32)" />
            </svg>
          </span>
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
              className={`nav-menu-item ${!showHome && !showLab && !showImprovementRun && !showAuditLog && !showSettings ? 'active' : ''}`}
              onClick={goAudit}
            >
              Auditoría
            </button>

            <button
              className={`nav-menu-item ${showImprovementRun ? 'active' : ''}`}
              onClick={goImprovementRun}
            >
              Health Delta
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
        <button className="nav-link" onClick={goImprovementRun}>
          Health Delta
        </button>
        <button className="nav-link" onClick={goSettings}>
          Configuración
        </button>
        <button className="nav-link" onClick={() => { setShowHome(false); setShowAuditLog(true); setShowLab(false); setShowMobileNav(false); }}>
          Trazabilidad
        </button>
        <button className="nav-link" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </div>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      {showImprovementRun && (
        <ImprovementRunPage onBack={goAudit} />
      )}

      {showLab && (report ? (
        <BenchmarkLab
          report={report}
          rawData={rawData}
          csvFields={csvFields}
          csvDelimiter={csvDelimiter}
          fileName={file?.name}
          aiConfig={aiConfig}
          auditEvidence={auditEvidence || undefined}
          deterministicValidation={deterministicValidation}
          onResultsChange={setLabBenchmarkResults}
          onBack={() => setShowLab(false)}
          onApplyConfig={setAiConfig}
        />
      ) : (
        <main className="sys-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ color: 'var(--ink-faint)', marginBottom: 'var(--space-lg)' }}>
              <FlaskConical size={48} strokeWidth={1} />
            </div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--space-sm)' }}>
              Laboratorio de Modelos
            </p>
            <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6 }}>
              Carga y perfila un dataset en Auditoría para acceder al banco de pruebas y calibración de modelos.
            </p>
            <button className="btn-s" style={{ marginTop: 'var(--space-lg)' }} onClick={() => setShowLab(false)}>
              Volver a Auditoría
            </button>
          </div>
        </main>
      ))}

      {/* Main Content — only show when not in settings, help, or lab */}
      <main className="sys-main" style={{ display: showLab || showImprovementRun || showSettings || showHelp ? 'none' : undefined }}>
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

        {/* Main Pipeline — Phase 1: Upload + Diagnostic */}
        {!showHome && (
          <section id="sistema" className="audit-workspace">
            <MainPipeline
              aiConfig={aiConfig}
              aiProvider={aiProvider}
              initialData={pipelineData}
              onPipelineChange={setPipelineData}
              onAiConfigChange={setAiConfig}
              onOpenLab={goLab}
              onOpenSettings={goSettings}
              onLog={(stage, msg) => { /* logs handled internally by MainPipeline */ }}
            />
          </section>
        )}

        {/* ── Export Section ── */}
        {!showHome && report && pipelineState === 'export' && (
          <section className="export-closure" id="export-section" data-testid="export-stage">
            <div className="export-closure-header">
              <p className="sec-eye">EXPORTACIÓN</p>
              <h2 className="sec-title">Paquete final del análisis</h2>
            </div>
            <p className="section-note export-closure-hero-desc">
              Cierra el análisis con un informe legible para decisión y conserva los anexos técnicos solo como respaldo auditable.
            </p>

            {(() => {
              const manifest = buildEvidenceManifest({
                auditEvidence,
                deterministicValidation,
                benchmarkResults,
                scriptValidation,
                hitlDecision: improvementRun?.hitlDecision ?? null,
                healthDeltaPoints: improvementRun?.healthDelta?.scoreDelta,
              });
              const completedObjectives = manifest.objectivesCoverage.filter(o => o.status === 'completed').length;
              const statusLabel = completedObjectives >= 4 ? 'Completo' : completedObjectives >= 2 ? 'Parcial' : 'Incompleto';
              const statusColor = completedObjectives >= 4 ? 'var(--success)' : completedObjectives >= 2 ? 'var(--orange)' : 'var(--error)';

              const formalClaims = [];
              const preliminaryClaims = [];
              const pendingClaims = [];

              if (manifest.allowedClaims.deterministicEngine === 'formal') formalClaims.push('Motor determinista verificado');
              else if (manifest.allowedClaims.deterministicEngine === 'preliminary') preliminaryClaims.push('Motor determinista preliminar');
              else pendingClaims.push('Motor determinista pendiente');

              if (manifest.allowedClaims.scriptSafety === 'formal') formalClaims.push('Script seguro verificado');
              else if (manifest.allowedClaims.scriptSafety === 'preliminary') preliminaryClaims.push('Script seguro preliminar');
              else pendingClaims.push('Script seguro pendiente');

              if (manifest.allowedClaims.hitlDecision === 'formal') formalClaims.push('Decisión humana registrada');
              else pendingClaims.push('Decisión humana pendiente');

              if (manifest.allowedClaims.healthDelta === 'formal') formalClaims.push('Delta de salud formal');
              else if (manifest.allowedClaims.healthDelta === 'preliminary') preliminaryClaims.push('Delta de salud preliminar');
              else pendingClaims.push('Delta de salud pendiente');

              if (manifest.calibrationSummary.status === 'formal') {
                formalClaims.push(`${manifest.calibrationSummary.formalRuns} corrida(s) de calibración con evidencia formal limitada`);
              } else if (manifest.calibrationSummary.status === 'preliminary') {
                preliminaryClaims.push(
                  `Calibración experimental preliminar: ${manifest.calibrationSummary.completedRuns}/${manifest.calibrationSummary.totalRuns} corrida(s) completada(s)`
                );
              } else if (manifest.calibrationSummary.status === 'attempted') {
                pendingClaims.push(
                  `Calibración experimental sin resultado concluido: ${manifest.calibrationSummary.failedOrUnavailableRuns} intento(s) fallido(s) o no disponible(s)`
                );
              }

              const hasRemediationArtifacts = !!(
                approvedCleaningScript || improvementRun?.healthDelta
              );

              return (
                <>
                  {/* ── Block 1 — Informe principal ── */}
                  <div className="export-delivery-block" data-testid="export-main-block">
                    <p className="export-delivery-block-eyebrow">Documento principal</p>
                    <h3 className="export-delivery-block-title">Informe defendible para compartir</h3>
                    <div className="export-delivery-cards">
                      <article className="export-delivery-card export-delivery-card--primary">
                        <div className="export-delivery-card-head">
                          <FileText size={20} />
                          <div>
                            <h4>Informe diagnóstico PDF</h4>
                            <p>Documento curado con decisión ejecutiva, riesgos priorizados, gráficos, recomendaciones y límites metodológicos.</p>
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
                            <button className="btn-p btn-sm" onClick={handleDownloadPdf} disabled={isPdfGenerating} data-testid="export-download-pdf">
                              Descargar PDF
                            </button>
                          )}
                        </div>
                      </article>

                      <article className="export-delivery-card">
                        <div className="export-delivery-card-head">
                          <FileJson size={18} />
                          <div>
                            <h4>Anexo JSON técnico</h4>
                            <p>Paquete estructurado para auditoría, trazabilidad, validaciones y reproducción técnica.</p>
                          </div>
                        </div>
                        {exportJsonPreflightError ? (
                          <div className="provider-unavailable-notice" role="alert" data-testid="export-json-preflight-warning">
                            <strong>JSON técnico no exportado.</strong>{' '}
                            {exportJsonPreflightError}
                          </div>
                        ) : (
                          <div className="export-delivery-card-action">
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
                            <h4>Anexo CSV de hallazgos</h4>
                            <p>Tabla de hallazgos deterministas para hojas de cálculo, QA o integración externa.</p>
                          </div>
                        </div>
                        <div className="export-delivery-card-action">
                          <button className="btn-s btn-sm" onClick={handleExportIssuesCsv}>
                            Descargar CSV
                          </button>
                        </div>
                      </article>
                    </div>
                  </div>

                  {/* ── Claims ── */}
                  {(formalClaims.length > 0 || preliminaryClaims.length > 0 || pendingClaims.length > 0) && (
                    <div className="export-delivery-block" data-testid="export-claims-block">
                      <p className="export-delivery-block-eyebrow">Qué puedes afirmar</p>
                      <h3 className="export-delivery-block-title">Resumen de gobernanza</h3>

                      {formalClaims.length > 0 && (
                        <div className="export-governance-group">
                          <div className="export-governance-group-head">
                            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                            <strong>Afirmaciones respaldadas</strong>
                          </div>
                          <ul>
                            {formalClaims.map((claim) => (
                              <li key={claim}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {preliminaryClaims.length > 0 && (
                        <div className="export-governance-group export-governance-group--preliminary">
                          <div className="export-governance-group-head">
                            <AlertTriangle size={14} style={{ color: 'var(--orange)' }} />
                            <strong>En revisión</strong>
                          </div>
                          <ul>
                            {preliminaryClaims.map((claim) => (
                              <li key={claim}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {pendingClaims.length > 0 && (
                        <div className="export-governance-group export-governance-group--pending">
                          <div className="export-governance-group-head">
                            <XCircle size={14} style={{ color: 'var(--ink3)' }} />
                            <strong>No debes afirmar todavía</strong>
                          </div>
                          <ul>
                            {pendingClaims.map((claim) => (
                              <li key={claim}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {manifest.limitations.length > 0 && (
                        <div className="export-governance-limitations">
                          <span>Limitaciones conocidas</span>
                          <ul>
                            {manifest.limitations.slice(0, 3).map((lim) => (
                              <li key={lim}>{lim}</li>
                            ))}
                            {manifest.limitations.length > 3 && (
                              <li className="export-governance-limitations-more">
                                +{manifest.limitations.length - 3} limitaciones más en los detalles técnicos
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Block 2 — Anexos de remediación opcional ── */}
                  <div className="export-delivery-block" data-testid="export-remediation-block">
                    <p className="export-delivery-block-eyebrow">
                      Anexos de remediación opcional
                    </p>
                    {hasRemediationArtifacts ? (
                      <div className="export-remediation-cards">
                        {approvedCleaningScript && (
                          <article className="export-delivery-card">
                            <div className="export-delivery-card-head">
                              <FileCode2 size={18} />
                              <div>
                                <h4>Script aprobado</h4>
                                <p>Script de limpieza validado y aprobado por revisión humana.</p>
                              </div>
                            </div>
                            <div className="export-delivery-card-action">
                              <button className="btn-s btn-sm" onClick={handleExportApprovedScript}>
                                Descargar script
                              </button>
                            </div>
                          </article>
                        )}
                        {approvedCleaningScript && (
                          <article className="export-delivery-card">
                            <div className="export-delivery-card-head">
                              <BookOpen size={18} />
                              <div>
                                <h4>Notebook Colab</h4>
                                <p>Notebook ejecutable con el script aprobado, instrucciones de reauditoría y resumen del dataset.</p>
                              </div>
                            </div>
                            <div className="export-delivery-card-action">
                              <button className="btn-s btn-sm" onClick={handleExportColab}>
                                Descargar notebook
                              </button>
                            </div>
                          </article>
                        )}
                        {improvementRun?.healthDelta && (
                          <article className="export-delivery-card">
                            <div className="export-delivery-card-head">
                              <FlaskConical size={18} />
                              <div>
                                <h4>Delta de salud</h4>
                                <p>Comparación del score antes y después de la remediación opcional.</p>
                              </div>
                            </div>
                            <div className="export-delivery-card-action">
                              <span className="export-delivery-score-delta" style={{ color: improvementRun.healthDelta.scoreDelta > 0 ? 'var(--success)' : 'var(--ink3)' }}>
                                {improvementRun.healthDelta.scoreDelta > 0 ? '+' : ''}{improvementRun.healthDelta.scoreDelta} puntos
                              </span>
                            </div>
                          </article>
                        )}
                      </div>
                    ) : (
                      <>
                        <h3 className="export-delivery-block-title">Esta sesión no generó anexos</h3>
                        <p className="export-delivery-empty">
                          No hay anexos de remediación opcional porque este flujo no generó script ni revisión humana. La remediación es una rama opcional que nace desde el reporte diagnóstico.
                        </p>
                      </>
                    )}
                  </div>

                  {/* ── Block 3 — Evidencia técnica y trazabilidad (collapsed) ── */}
                  <details className="export-tech-disclosure" data-testid="export-tech-disclosure">
                    <summary className="export-tech-disclosure-summary">
                      <ChevronDown size={14} className="export-tech-disclosure-chevron" />
                      <span>Evidencia técnica y trazabilidad</span>
                      <span className="export-tech-disclosure-hint">manifiesto, cobertura de objetivos, metadatos</span>
                    </summary>
                    <div className="export-tech-disclosure-body">
                      <div className="export-manifest-status" data-testid="stage-decision-summary">
                        <div className="export-manifest-item">
                          <span className="export-manifest-label">Paquete</span>
                          <strong style={{ color: statusColor }}>{statusLabel}</strong>
                        </div>
                        <div className="export-manifest-item">
                          <span className="export-manifest-label">Script</span>
                          <strong style={{ color: approvedCleaningScript ? 'var(--success)' : 'var(--ink3)' }}>
                            {approvedCleaningScript ? 'Aprobado' : 'Pendiente'}
                          </strong>
                        </div>
                        <div className="export-manifest-item">
                          <span className="export-manifest-label">Evidencia</span>
                          <strong>{completedObjectives >= 4 ? 'formal' : completedObjectives >= 2 ? 'parcial' : 'incompleta'}</strong>
                        </div>
                        {manifest.calibrationSummary.totalRuns > 0 && (
                          <div className="export-manifest-item">
                            <span className="export-manifest-label">Calibración</span>
                            <strong>{manifest.calibrationSummary.status}</strong>
                          </div>
                        )}
                      </div>

                      <div className="export-manifest-checklist">
                        <span className="export-manifest-checklist-title">Cobertura técnica de evidencia</span>
                        {manifest.objectivesCoverage.map((obj) => (
                          <div key={obj.id} className={`export-manifest-row export-manifest-row--${obj.status}`}>
                            {obj.status === 'completed' ? <CheckCircle2 size={14} /> : obj.status === 'partial' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
                            <div>
                              <strong>{obj.id}: {obj.label}</strong>
                              <p>{obj.evidence}</p>
                              {obj.limitations.length > 0 && (
                                <ul className="export-manifest-limitations">
                                  {obj.limitations.map((lim) => <li key={lim}>{lim}</li>)}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>

                  {/* ── Block 4 — Gestión segura de sesión ── */}
                  <div className="export-session-block" data-testid="export-session-block">
                    <p className="export-delivery-block-eyebrow">Gestión segura de sesión</p>
                    <h3 className="export-delivery-block-title">Cerrar el análisis actual</h3>
                    <p className="export-session-block-desc">
                      Los datos se procesan localmente en el navegador. Puedes cerrar la sesión para eliminar el análisis actual y volver a la carga inicial.
                    </p>
                    <button
                      className="btn-s"
                      onClick={handleDestroySession}
                      style={{ borderColor: 'var(--error)', color: 'var(--error)', width: 'fit-content' }}
                      data-testid="export-destroy-session"
                    >
                      Cerrar sesión y destruir datos locales
                    </button>
                  </div>
                </>
              );
            })()}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="sys-footer" style={{ display: showLab || showImprovementRun || showSettings || showHelp ? 'none' : undefined }}>
        <span className="footer-brand">AURA</span>
        <div className="footer-links">
          <button className="footer-link" onClick={() => setShowHelp(true)}>Ayuda</button>
          <button className="footer-link" onClick={() => setShowChangelog(true)}>Historial</button>
        </div>
        <span className="footer-copy">casabero · tfm · 2026</span>
      </footer>
    </div></ErrorBoundary>
  );
};

export default App;
