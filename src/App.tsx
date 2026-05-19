import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileCode2, FileJson, FileText, FlaskConical, HelpCircle, Settings } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsPanel from './components/SettingsPanel';
import MainPipeline, { PipelineData } from './components/MainPipeline';
import BenchmarkLab from './components/BenchmarkLab';
import { loadFromApi, syncToApi } from './services/api';
import { createAIProvider } from './services/aiProvider';
import { generatePdfReport } from './services/pdfGenerator';
import { AIConfig, AuditReport, BenchmarkResult, ExecutiveReportContent, ImprovementRun, IssueSeverity } from './types';

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
    logs: [],
  });

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
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

  // ── Derived pipeline state ──
  const report = pipelineData.report;
  const auditEvidence = pipelineData.auditEvidence;
  const rawData = pipelineData.rawData;
  const csvFields = pipelineData.csvFields;
  const csvDelimiter = pipelineData.csvDelimiter;
  const file = pipelineData.file;
  const logs = pipelineData.logs;
  const pipelineState = pipelineData.state;

  const criticalCount = countBySeverity(report, IssueSeverity.CRITICAL);
  const warningCount = countBySeverity(report, IssueSeverity.WARNING);

  // ── Placeholder states for future phases ──
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [cleaningScript, setCleaningScript] = useState('');
  const [approvedCleaningScript, setApprovedCleaningScript] = useState('');
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [improvementRun, setImprovementRun] = useState<ImprovementRun | null>(null);
  const [hasExported, setHasExported] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const hasData = !!report;

  // ── Export handlers ──
  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsPdfGenerating(true);
    try {
      generatePdfReport(report, buildDeterministicPdfContent(report, approvedCleaningScript));
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
      JSON.stringify({ fileName: file?.name, generatedAt: new Date().toISOString(), report, auditEvidence, aiAnalysis, improvementRun }, null, 2),
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
      {/* Benchmark Lab Modal */}
      {showLab && report && (
        <BenchmarkLab
          report={report}
          rawData={rawData}
          csvFields={csvFields}
          csvDelimiter={csvDelimiter}
          fileName={file?.name}
          aiConfig={aiConfig}
          auditEvidence={auditEvidence || undefined}
          onClose={() => setShowLab(false)}
        />
      )}

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
                  <li><strong>Carga un CSV.</strong> El motor determinista analiza al instante.</li>
                  <li><strong>Revisa resultados.</strong> Score, anomalías y perfil de columnas.</li>
                  <li><strong>Analiza con IA.</strong> Interpretación contextual de hallazgos.</li>
                  <li><strong>Revisa y aprueba.</strong> Script auditables con simulación segura.</li>
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
        <span className="nav-logo">
          <span className="logo-full">AURA</span>
          <span className="logo-short">AU</span>
        </span>
        <div className={`nav-links ${showMobileNav ? 'nav-links-open' : ''}`}>
          <button className="nav-link" onClick={() => { scrollTo('sistema'); setShowMobileNav(false); }}>Inicio</button>
          {hasData && <button className="nav-link" onClick={() => { scrollTo('export-section'); setShowMobileNav(false); }}>Exportar</button>}
          <div className="nav-status"><div className="pulse" />{pipelineState === 'upload' ? 'listo' : 'online'}</div>
          <button className="nav-cta" onClick={() => { if (hasData) window.location.reload(); }}>
            {hasData ? 'Nuevo análisis' : 'Empezar'}
          </button>
          <button className="icon-btn" onClick={() => { setShowHelp(true); setShowMobileNav(false); }} aria-label="Centro de ayuda"><HelpCircle size={14} /></button>
          {hasData && (
            <button className="icon-btn" onClick={() => { setShowLab(true); setShowMobileNav(false); }} aria-label="Laboratorio de benchmark" title="Laboratorio 🔬">
              <FlaskConical size={14} />
            </button>
          )}
          <button
            className={`theme-toggle ${theme === 'light' ? 'on' : ''}`}
            onClick={() => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setShowMobileNav(false); }}
            aria-label="Cambiar tema"
          >
            <span className="theme-toggle-thumb" />
          </button>
          <button className="icon-btn" onClick={() => { setShowSettings(true); setShowMobileNav(false); }} aria-label="Ajustes"><Settings size={14} /></button>
        </div>
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
          <h1 className="hero-h1">Audita la calidad de tus datos.</h1>
          <p className="hero-sub">
            AURA primero fija evidencia determinista; después interpreta con IA y mide si la limpieza mejora el dataset.
          </p>
        </section>

        {/* Main Pipeline — Phase 1: Upload + Diagnostic */}
        <MainPipeline
          aiConfig={aiConfig}
          aiProvider={aiProvider}
          onPipelineChange={setPipelineData}
          onLog={(stage, msg) => { /* logs handled internally by MainPipeline */ }}
        />

        {/* Export Section */}
        {report && (
          <section className="quote" id="export-section">
            <p className="quote-text">Informe y evidencia listos para llevar.</p>
            <p className="quote-attr">Exporta el diagnóstico determinista y los artefactos aprobados.</p>
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
    </div></ErrorBoundary>
  );
};

export default App;
