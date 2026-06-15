import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, Download, FileCode2, FileJson, FileText, FlaskConical, HelpCircle, Settings, Layers, History, CheckCircle2, AlertTriangle, XCircle, Sun, Moon } from 'lucide-react';
import ChangelogModal from './components/ChangelogModal';
import ErrorBoundary from './components/ErrorBoundary';
import AuditLogViewer from './components/AuditLogViewer';
import BenchmarkLab from './components/BenchmarkLab';
import SettingsPanel from './components/SettingsPanel';
import HelpCenter from './components/HelpCenter';
import MainPipeline, { PipelineData } from './components/MainPipeline';
import { loadFromApi, syncToApi } from './services/api';
import { createAIProvider } from './services/aiProvider';
import { generatePdfReport } from './services/pdfGenerator';
import { buildEvidenceManifest } from './services/evidenceManifest';
import { AIConfig, AuditReport, BenchmarkResult, DeterministicValidationReport, EvidenceManifest, ExecutiveReportContent, IssueSeverity } from './types';

const countBySeverity = (report: AuditReport | null, severity: IssueSeverity) =>
  report?.issues.filter((issue) => issue.severity === severity).length ?? 0;

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

const App: React.FC = () => {
  // ── Pipeline data (recibido de MainPipeline) ──
  const [pipelineData, setPipelineData] = useState<PipelineData>({
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
    benchmarkResults: [],
    improvementRun: null,
    scriptValidation: null,
    deterministicValidation: null,
    logs: [],
  });

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
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

  // ── AI Config (para settings panel) ──
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const local = localStorage.getItem('aura_ai_config');
    if (local) return { providerType: 'local', temperature: 0.1, autoAnalyze: false, ...JSON.parse(local) };
    return {
      model: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
      temperature: 0.1,
      autoAnalyze: false,
      providerType: 'local',
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

  const criticalCount = countBySeverity(report, IssueSeverity.CRITICAL);
  const warningCount = countBySeverity(report, IssueSeverity.WARNING);

  const [hasExported, setHasExported] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const hasData = !!report;

  // ── Export handlers ──
  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsPdfGenerating(true);
    try {
      generatePdfReport(report, buildDeterministicPdfContent(report, approvedCleaningScript), aiAnalysis, scriptValidation);
      setHasExported(true);
    } catch (error: any) {
      // silently fail
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
    downloadTextFile(
      `aura_audit_${Date.now()}.json`,
      JSON.stringify({
        manifest,
        profile: {
          report,
          auditEvidence,
        },
        ...(deterministicValidation?.groundTruthMatched && {
          deterministicValidation,
        }),
        ...(improvementRun?.hitlDecision && {
          hitlDecision: improvementRun.hitlDecision,
        }),
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
        ...(benchmarkResults.length > 0 && {
          experiment: {
            benchmarkResults,
            improvementRun,
          },
        }),
      }, null, 2),
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <div className="nav-brand" onClick={() => { if (hasData) window.location.reload(); }}>
          <span className="nav-logo">AURA</span>
        </div>

        {/* Bloque Central: Navegación de Capas (Escritorio) */}
        <div className="nav-center-menu">
          <button
            className={`nav-menu-item ${!showLab && !showAuditLog && !showSettings ? 'active' : ''}`}
            onClick={() => { setShowLab(false); setShowAuditLog(false); setShowSettings(false); scrollTo('sistema'); }}
          >
            Auditoría
          </button>

          <button
            className={`nav-menu-item ${showLab ? 'active' : ''}`}
            onClick={() => { setShowLab(true); setShowAuditLog(false); setShowSettings(false); }}
          >
            Laboratorio
          </button>

          <button
            className={`nav-menu-item ${showSettings ? 'active' : ''}`}
            onClick={() => { setShowSettings(true); setShowLab(false); setShowAuditLog(false); }}
          >
            Configuración
          </button>
        </div>

        {/* Bloque Derecho: Controles mínimos (Escritorio) */}
        <div className="nav-system-controls">
          <label className="theme-toggle" aria-label="Cambiar tema">
            <input
              type="checkbox"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
            />
          </label>

          {hasData && (
            <button className="nav-reset-cta" onClick={() => window.location.reload()}>
              Nuevo análisis
            </button>
          )}
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
        <button className="nav-link" onClick={() => { setShowLab(false); setShowAuditLog(false); setShowSettings(false); setShowMobileNav(false); scrollTo('sistema'); }}>
          Auditoría
        </button>
        <button className="nav-link" onClick={() => { setShowLab(true); setShowAuditLog(false); setShowSettings(false); setShowMobileNav(false); }}>
          Laboratorio
        </button>
        <button className="nav-link" onClick={() => { setShowSettings(true); setShowLab(false); setShowAuditLog(false); setShowMobileNav(false); }}>
          Configuración
        </button>
        <button className="nav-link" onClick={() => { setShowAuditLog(true); setShowLab(false); setShowMobileNav(false); }}>
          Trazabilidad
        </button>
        <button className="nav-link" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </div>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

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
      <main className="sys-main" style={{ display: showLab || showSettings || showHelp ? 'none' : undefined }}>
        {/* Hero */}
        <section className="hero" id="sistema">
          <h1 className="hero-sub">
            La calidad del dato merece un diagnóstico preciso.
          </h1>
          <p className="hero-desc">
            Auditoría determinista, diagnóstico asistido y limpieza reproducible. Todo en el navegador.
          </p>
        </section>

        {/* Main Pipeline — Phase 1: Upload + Diagnostic */}
        <MainPipeline
          aiConfig={aiConfig}
          aiProvider={aiProvider}
          onPipelineChange={setPipelineData}
          onAiConfigChange={setAiConfig}
          onOpenLab={() => setShowLab(true)}
          onOpenSettings={() => setShowSettings(true)}
          onLog={(stage, msg) => { /* logs handled internally by MainPipeline */ }}
        />

        {/* Export Section */}
        {report && pipelineState === 'export' && (
          <section className="export-closure" id="export-section" data-testid="export-stage">
            <div className="export-closure-header">
              <p className="sec-eye">exportación</p>
              <h2 className="sec-title">Tu evidencia está lista</h2>
            </div>
            <p className="section-note">
              AURA reúne reporte, hallazgos, script y manifest para que puedas defender el proceso.
            </p>

            <div className="companion-note">
              <ShieldCheck size={16} />
              <p>Aquí no prometemos más de lo que la evidencia permite. Si algo quedó preliminar o pendiente, AURA lo muestra.</p>
            </div>

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

              return (
                <>
                  <div className="stage-decision-summary" data-testid="stage-decision-summary">
                    <div className="stage-summary-item">
                      <span className="stage-summary-label">Paquete</span>
                      <strong style={{ color: statusColor }}>{statusLabel}</strong>
                    </div>
                    <div className="stage-summary-item">
                      <span className="stage-summary-label">Script</span>
                      <strong style={{ color: approvedCleaningScript ? 'var(--success)' : 'var(--ink3)' }}>
                        {approvedCleaningScript ? 'Aprobado' : 'Pendiente'}
                      </strong>
                    </div>
                    <div className="stage-summary-item">
                      <span className="stage-summary-label">Evidencia</span>
                      <strong>{completedObjectives >= 4 ? 'formal' : completedObjectives >= 2 ? 'parcial' : 'incompleta'}</strong>
                    </div>
                  </div>

                  {formalClaims.length > 0 && (
                    <div className="export-human-summary">
                      <h3 className="export-human-summary-title">Qué puedes afirmar</h3>
                      <ul className="export-human-summary-list">
                        {formalClaims.map((claim) => (
                          <li key={claim}>
                            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                            {claim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preliminaryClaims.length > 0 && (
                    <div className="export-human-summary export-human-summary--preliminary">
                      <h3 className="export-human-summary-title">Qué está en revisión</h3>
                      <ul className="export-human-summary-list">
                        {preliminaryClaims.map((claim) => (
                          <li key={claim}>
                            <AlertTriangle size={14} style={{ color: 'var(--orange)' }} />
                            {claim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pendingClaims.length > 0 && (
                    <div className="export-human-summary export-human-summary--pending">
                      <h3 className="export-human-summary-title">Qué no debes afirmar todavía</h3>
                      <ul className="export-human-summary-list">
                        {pendingClaims.map((claim) => (
                          <li key={claim}>
                            <XCircle size={14} style={{ color: 'var(--ink3)' }} />
                            {claim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {manifest.limitations.length > 0 && (
                    <div className="export-limitations">
                      <span className="export-limitations-title">Limitaciones conocidas</span>
                      <ul>
                        {manifest.limitations.slice(0, 3).map((lim) => (
                          <li key={lim}>{lim}</li>
                        ))}
                        {manifest.limitations.length > 3 && (
                          <li className="export-limitations-more">
                            +{manifest.limitations.length - 3} limitaciones más en detalles técnicos
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="export-downloads">
                    <h3 className="export-downloads-title">Descargas</h3>
                    <div className="export-downloads-grid">
                      <button className="btn-p" onClick={handleDownloadPdf} disabled={isPdfGenerating}>
                        <FileText size={14} /> {isPdfGenerating ? 'Generando reporte' : 'Reporte PDF ejecutivo'}
                      </button>
                      <button className="btn-s" onClick={handleExportJson}>
                        <FileJson size={14} /> JSON técnico
                      </button>
                      <button className="btn-s" onClick={handleExportIssuesCsv}>
                        <Download size={14} /> Hallazgos CSV
                      </button>
                      <button className="btn-s" onClick={handleExportApprovedScript} disabled={!approvedCleaningScript}>
                        <FileCode2 size={14} /> Script aprobado
                      </button>
                    </div>
                  </div>

                  <details className="technical-details" style={{ marginTop: 'var(--space-lg)' }} data-testid="technical-details">
                    <summary className="technical-details-summary">
                      <ChevronDown size={14} className="technical-details-chevron" />
                      <span>Detalles técnicos</span>
                      <span className="technical-details-hint">cobertura técnica de evidencia y manifest</span>
                    </summary>
                    <div className="technical-details-body">
                      <div className="objectives-checklist">
                        <span className="objectives-checklist-title">Cobertura técnica de evidencia</span>
                        {manifest.objectivesCoverage.map((obj) => (
                          <div key={obj.id} className={`obj-row obj-row--${obj.status}`}>
                            {obj.status === 'completed' ? <CheckCircle2 size={14} /> : obj.status === 'partial' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
                            <div>
                              <strong>{obj.id}: {obj.label}</strong>
                              <p>{obj.evidence}</p>
                              {obj.limitations.length > 0 && (
                                <ul className="obj-limitations">
                                  {obj.limitations.map((lim) => <li key={lim}>{lim}</li>)}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </>
              );
            })()}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="sys-footer" style={{ display: showLab || showSettings || showHelp ? 'none' : undefined }}>
        <span className="footer-brand">AURA</span>
        <div className="footer-links">
          <button className="footer-link" onClick={() => setShowAuditLog(true)}>Trazabilidad</button>
          <button className="footer-link" onClick={() => setShowHelp(true)}>Ayuda</button>
          <button className="footer-link" onClick={() => setShowChangelog(true)}>Historial</button>
        </div>
        <span className="footer-copy">casabero · tfm · 2026</span>
      </footer>
    </div></ErrorBoundary>
  );
};

export default App;
