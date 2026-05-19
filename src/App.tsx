import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Download, FileCode2, FileJson, FileText, FlaskConical, HelpCircle, Settings, Layers, Sun, Moon } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import AuditLogViewer from './components/AuditLogViewer';
import BenchmarkLab from './components/BenchmarkLab';
import SettingsPanel from './components/SettingsPanel';
import MainPipeline, { PipelineData } from './components/MainPipeline';
import { loadFromApi, syncToApi } from './services/api';
import { createAIProvider } from './services/aiProvider';
import { generatePdfReport } from './services/pdfGenerator';
import { AIConfig, AuditReport, BenchmarkResult, ExecutiveReportContent, IssueSeverity } from './types';

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
    logs: [],
  });

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [labBenchmarkResults, setLabBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('aura_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('aura_theme', theme);
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
    downloadTextFile(
      `aura_audit_${Date.now()}.json`,
      JSON.stringify({
        profile: {
          report,
          auditEvidence,
        },
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

      {showLab && report ? (
        <BenchmarkLab
          report={report}
          rawData={rawData}
          csvFields={csvFields}
          csvDelimiter={csvDelimiter}
          fileName={file?.name}
          aiConfig={aiConfig}
          auditEvidence={auditEvidence || undefined}
          onResultsChange={setLabBenchmarkResults}
          onBack={() => setShowLab(false)}
        />
      ) : (
        <>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel config={aiConfig} onSave={setAiConfig} onClose={() => setShowSettings(false)} />
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="help-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={() => setShowHelp(false)}>
          <section className="help-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-line">
              <p className="sec-eye">centro de ayuda</p>
              <button className="icon-btn" onClick={() => setShowHelp(false)} aria-label="Cerrar ayuda">×</button>
            </div>
            <div className="help-sections">
              <details className="help-section" open>
                <summary className="help-summary">Cómo usar AURA</summary>
                <ol className="help-steps">
                  <li><strong>Carga un CSV.</strong> El archivo se procesa localmente en el navegador.</li>
                  <li><strong>Perfila el dataset.</strong> Revisa estructura, columnas, estadística descriptiva y reglas activadas.</li>
                  <li><strong>Genera diagnóstico.</strong> Interpreta causas probables a partir de los hallazgos estructurados.</li>
                  <li><strong>Genera y revisa el script.</strong> Valida columnas, operaciones y trazabilidad antes de aprobar.</li>
                  <li><strong>Exporta evidencia.</strong> Descarga reportes y artefactos trazables.</li>
                </ol>
              </details>
              <details className="help-section">
                <summary className="help-summary">Modelos locales vs cloud</summary>
                <div className="help-text">
                  <p><strong>Local (WebGPU):</strong> El modelo se descarga en tu navegador. Sin datos salen de tu dispositivo.</p>
                  <p><strong>Cloud:</strong> Usa APIs de Google, Groq, DeepSeek u otros. Mayor capacidad pero los datos viajan al proveedor.</p>
                </div>
              </details>
              <details className="help-section">
                <summary className="help-summary">Scores y anomalías</summary>
                <div className="help-text">
                  <p><strong>Score (0-100):</strong> &gt;80 = dataset confiable, &lt;80 = requiere limpieza.</p>
                  <p><strong>CRITICAL:</strong> bloqueante. <strong>WARNING:</strong> requiere revisión. <strong>INFO:</strong> sugerencia.</p>
                </div>
              </details>
            </div>
          </section>
        </div>
      )}

      {/* Navigation */}
      <nav className="sys-nav">
        {/* Bloque Izquierdo: Branding y Contexto Académico */}
        <div className="nav-brand" onClick={() => { if (hasData) window.location.reload(); }} style={{ cursor: 'pointer' }}>
          <span className="nav-logo">
            AURA
          </span>
          <span className="nav-academic-pill">TFM UNIR</span>
        </div>

        {/* Bloque Central: Navegación de Capas (Escritorio) */}
        <div className="nav-center-menu">
          <button 
            className={`nav-menu-item ${!showLab && !showAuditLog ? 'active' : ''}`} 
            onClick={() => { setShowLab(false); setShowAuditLog(false); scrollTo('sistema'); }}
          >
            <Layers size={13} />
            <span>Auditoría y Diagnóstico</span>
          </button>

          {hasData && (
            <button 
              className={`nav-menu-item ${showLab ? 'active' : ''}`} 
              onClick={() => { setShowLab(true); setShowAuditLog(false); }}
            >
              <FlaskConical size={13} />
              <span>Laboratorio de Modelos</span>
            </button>
          )}
        </div>

        {/* Bloque Derecho: Herramientas y Estado (Escritorio) */}
        <div className="nav-system-controls">
          {/* Indicador Dinámico de Privacidad (OE3/Capa 0/Capa 2) */}
          <div className={`nav-status-pill ${aiConfig.providerType === 'local' ? 'local' : 'cloud'}`}>
            <span className="pulse-dot" />
            <span className="status-label">
              {aiConfig.providerType === 'local' ? 'CAPA 0: LOCAL-FIRST' : 'CAPA 2: NUBE HÍBRIDA'}
            </span>
          </div>

          <div className="vertical-divider" />

          {/* Herramientas de Configuración y Utilidades */}
          <div className="nav-tools-group">
            {/* Trazabilidad (Capa 3) */}
            <button 
              className={`tool-btn ${showAuditLog ? 'active' : ''}`} 
              onClick={() => { setShowAuditLog(true); setShowLab(false); }}
              aria-label="Registro de trazabilidad"
              title="Registro de Trazabilidad (Capa 3)"
            >
              <ClipboardList size={15} />
            </button>

            {/* Ajustes de IA (Capa 2) */}
            <button 
              className={`tool-btn ${showSettings ? 'active' : ''}`} 
              onClick={() => setShowSettings(true)} 
              aria-label="Ajustes de IA"
              title="Ajustes de IA (Capa 2)"
            >
              <Settings size={15} />
            </button>

            {/* Centro de Ayuda */}
            <button 
              className={`tool-btn ${showHelp ? 'active' : ''}`} 
              onClick={() => setShowHelp(true)} 
              aria-label="Centro de ayuda"
              title="Centro de Ayuda"
            >
              <HelpCircle size={15} />
            </button>

            {/* Alternar Tema */}
            <button
              className="tool-btn"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label="Cambiar tema"
              title="Alternar Modo Oscuro/Claro"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          </div>

          {hasData && (
            <>
              <div className="vertical-divider" />
              <button className="nav-reset-cta" onClick={() => window.location.reload()}>
                Nuevo análisis
              </button>
            </>
          )}
        </div>

        {/* Menú Móvil Fixed (Renderizado condicionalmente cuando está abierto) */}
        <div className={`nav-links ${showMobileNav ? 'nav-links-open' : ''}`}>
          <button className="nav-link" onClick={() => { setShowLab(false); setShowAuditLog(false); scrollTo('sistema'); setShowMobileNav(false); }}>
            Auditoría y Diagnóstico
          </button>
          {hasData && (
            <button className="nav-link" onClick={() => { setShowLab(true); setShowAuditLog(false); setShowMobileNav(false); }}>
              Laboratorio de Modelos
            </button>
          )}
          <button className="nav-link" onClick={() => { setShowAuditLog(true); setShowLab(false); setShowMobileNav(false); }}>
            Trazabilidad (Capa 3)
          </button>
          <button className="nav-link" onClick={() => { setShowSettings(true); setShowMobileNav(false); }}>
            Ajustes de IA (Capa 2)
          </button>
          <button className="nav-link" onClick={() => { setShowHelp(true); setShowMobileNav(false); }}>
            Ayuda
          </button>
          <button className="nav-link" onClick={() => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setShowMobileNav(false); }}>
            Tema: {theme === 'light' ? 'Claro' : 'Oscuro'}
          </button>
          {hasData && (
            <button className="nav-cta" onClick={() => { window.location.reload(); setShowMobileNav(false); }}>
              Nuevo análisis
            </button>
          )}
        </div>

        {/* Botón Hamburguesa Móvil */}
        <button className="mobile-nav-toggle" onClick={() => setShowMobileNav(!showMobileNav)} aria-label="Menú de navegación">
          <span className={`hamburger ${showMobileNav ? 'open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="sys-main">
        {/* Hero */}
        <section className="hero" id="sistema">
          <p className="hero-sub">
            AURA perfila el dataset con reglas reproducibles; luego separa diagnóstico, script, revisión humana y exportación.
          </p>
        </section>

        {/* Main Pipeline — Phase 1: Upload + Diagnostic */}
        <MainPipeline
          aiConfig={aiConfig}
          aiProvider={aiProvider}
          onPipelineChange={setPipelineData}
          onAiConfigChange={setAiConfig}
          onOpenLab={() => setShowLab(true)}
          onLog={(stage, msg) => { /* logs handled internally by MainPipeline */ }}
        />

        {/* Export Section */}
        {report && pipelineState === 'export' && (
          <section className="quote" id="export-section">
            <p className="quote-text">Informe y evidencia listos para llevar.</p>
            <p className="quote-attr">Exporta el perfil, la evidencia técnica y los artefactos aprobados.</p>
            <div className="export-grid">
              <button className="btn-p" onClick={handleDownloadPdf} disabled={isPdfGenerating}>
                <FileText size={14} /> {isPdfGenerating ? 'Generando' : 'Exportar reporte'}
              </button>
              <button className="btn-s" onClick={handleExportJson}>
                <FileJson size={14} /> JSON audit
              </button>
              <button className="btn-s" onClick={handleExportIssuesCsv}>
                <Download size={14} /> CSV issues
              </button>
              <button className="btn-s" onClick={handleExportApprovedScript} disabled={!approvedCleaningScript}>
                <FileCode2 size={14} /> Script aprobado
              </button>
            </div>
            <div className="export-summary">
              <span>críticos {criticalCount}</span>
              <span>advertencias {warningCount}</span>
              <span>{approvedCleaningScript ? 'script HITL aprobado' : 'script pendiente de aprobación'}</span>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="sys-footer">
        <span className="footer-brand">AURA</span>
        <span className="footer-copy">casabero · tfm · 2026</span>
      </footer>
        </>
      )}
    </div></ErrorBoundary>
  );
};

export default App;
