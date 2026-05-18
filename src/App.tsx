import React, { useEffect, useMemo, useState } from 'react';
import { Brain, ClipboardCheck, Database, Download, FileCode2, FileJson, FileText, HelpCircle, Play, Settings, ShieldCheck, Check, ArrowRight, Upload, Table2, Search } from 'lucide-react';
import BenchmarkPanel from './components/BenchmarkPanel';
import ErrorBoundary from './components/ErrorBoundary';
import DataProfile from './components/DataProfile';
import { ExperimentDesigner } from './components/ExperimentDesigner';
import ExecutionEvidencePanel from './components/ExecutionEvidencePanel';
import FileUpload from './components/FileUpload';
import GeminiAdvisor from './components/GeminiAdvisor';
import ImprovementRunPanel from './components/ImprovementRunPanel';
import IssueList from './components/IssueList';
import ScoreBreakdown from './components/ScoreBreakdown';
import ScriptReview from './components/ScriptReview';
import SettingsPanel from './components/SettingsPanel';
import { api, loadFromApi, syncToApi } from './services/api';
import { createAIProvider } from './services/aiProvider';
import { runAudit } from './services/auditEngine';
import { parseCsv } from './services/csvService';
import { buildAuditEvidence, createTraceRecorder, fingerprintDataset } from './services/executionEvidence';
import { generatePdfReport } from './services/pdfGenerator';
import { AIConfig, AuditExecutionEvidence, AuditReport, ExecutiveReportContent, ImprovementRun, IssueSeverity, ProviderMetrics } from './types';

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
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [csvFields, setCsvFields] = useState<string[]>([]);
  const [csvDelimiter, setCsvDelimiter] = useState(',');
  const [auditEvidence, setAuditEvidence] = useState<AuditExecutionEvidence | null>(null);
  const [improvementRun, setImprovementRun] = useState<ImprovementRun | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [cleaningScript, setCleaningScript] = useState('');
  const [approvedCleaningScript, setApprovedCleaningScript] = useState('');
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [hasExported, setHasExported] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('aura_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('aura_theme', theme);
  }, [theme]);
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const local = localStorage.getItem('aura_ai_config');
    if (local) return { providerType: 'local', temperature: 0.1, autoAnalyze: false, ...JSON.parse(local) };
    return {
      model: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
      temperature: 0.1,
      autoAnalyze: false,
      providerType: 'local',
    };
  });

  useEffect(() => {
    loadFromApi<AIConfig>('ai_config', aiConfig).then((remote) => {
      if (JSON.stringify(remote) !== JSON.stringify(aiConfig)) {
        setAiConfig(remote);
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_ai_config', JSON.stringify(aiConfig));
    syncToApi('ai_config', aiConfig);
  }, [aiConfig]);

  const aiProvider = useMemo(() => createAIProvider(aiConfig), [aiConfig]);
  const criticalCount = countBySeverity(report, IssueSeverity.CRITICAL);
  const warningCount = countBySeverity(report, IssueSeverity.WARNING);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('es-CO', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { time, msg }].slice(-18));
  };

  const runAiAnalysis = async (currentReport: AuditReport) => {
    const isAvailable = await aiProvider.isAvailable();
    if (!isAvailable) {
      alert('WebGPU no esta disponible en este navegador. Usa Chrome/Edge compatible.');
      setShowSettings(true);
      return;
    }

    setIsAiLoading(true);
    setAiAnalysis('');
    addLog(`llm.local.start :: ${aiConfig.model}`);

    try {
      const metrics = await aiProvider.analyzeStream(currentReport, (chunk) => {
        setAiAnalysis((prev) => prev + chunk);
      });
      setLastMetrics(metrics);
      addLog(`llm.analysis.end :: ${metrics.model} · ${Math.round(metrics.latencyMs / 1000)}s · ${metrics.tokensGenerated} tokens`);
    } catch (err: any) {
      addLog(`llm.analysis.error :: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateScript = async (currentReport: AuditReport) => {
    const isAvailable = await aiProvider.isAvailable();
    if (!isAvailable) {
      alert('WebGPU no esta disponible en este navegador. Usa Chrome/Edge compatible.');
      setShowSettings(true);
      return;
    }

    setIsScriptLoading(true);
    setCleaningScript('');
    setApprovedCleaningScript('');
    addLog('Generando script de limpieza...');

    try {
      const { content, metrics } = await aiProvider.generateExecutiveReport(currentReport);
      setLastMetrics(metrics);
      const script = content.python_script || '';
      setCleaningScript(script);
      addLog(`Script generado: ${script.split('\n').length} líneas`);
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsScriptLoading(false);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setReport(null);
    setAiAnalysis('');
    setCleaningScript('');
    setApprovedCleaningScript('');
    setRawData([]);
    setCsvFields([]);
    setCsvDelimiter(',');
    setAuditEvidence(null);
    setImprovementRun(null);
    setHasExported(false);
    setLogs([]);
    addLog(`Cargando ${uploadedFile.name}...`);

    try {
      const trace = createTraceRecorder();
      const startedAt = new Date().toISOString();
      trace.mark('csv.parse.start', { fileName: uploadedFile.name, fileSize: uploadedFile.size });
      addLog('csv.parse.start :: leyendo archivo en navegador');
      const parseStart = performance.now();
      const { data, meta } = await parseCsv(uploadedFile);
      const parseDurationMs = Math.round(performance.now() - parseStart);
      trace.mark('csv.parse.end', {
        rows: data.length,
        columns: meta.fields?.length ?? 0,
        delimiter: meta.delimiter,
        truncated: meta.truncated,
        durationMs: parseDurationMs,
      });
      setRawData(data);
      setCsvFields(meta.fields);
      setCsvDelimiter(meta.delimiter);
      addLog(`csv.parse.end :: ${data.length} registros · ${meta.fields?.length ?? 0} columnas · ${parseDurationMs}ms`);

      const datasetFingerprint = fingerprintDataset(data, meta.fields);
      trace.mark('audit.run.start', { datasetFingerprint });
      addLog(`audit.run.start :: fingerprint=${datasetFingerprint}`);
      const auditStart = performance.now();
      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      const auditDurationMs = Math.round(performance.now() - auditStart);
      trace.mark('audit.run.end', {
        durationMs: auditDurationMs,
        score: auditResult.score,
        issues: auditResult.issues.length,
        duplicateRows: auditResult.duplicateRows,
      });
      const completedAt = new Date().toISOString();
      setAuditEvidence(buildAuditEvidence({
        fileName: uploadedFile.name,
        datasetFingerprint,
        startedAt,
        completedAt,
        parseDurationMs,
        auditDurationMs,
        rowsProcessed: data.length,
        columnsProcessed: meta.fields.length,
        delimiter: meta.delimiter,
        truncated: meta.truncated,
        report: auditResult,
        trace: trace.events,
      }));
      setReport(auditResult);
      addLog(`audit.run.end :: score=${auditResult.score}/100 · issues=${auditResult.issues.length} · ${auditDurationMs}ms`);

      if (aiConfig.autoAnalyze) {
        addLog('ia.autoAnalyze.queued :: el diagnóstico determinista ya quedó cerrado');
        window.setTimeout(() => {
          void runAiAnalysis(auditResult);
        }, 0);
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsPdfGenerating(true);
    addLog('pdf.generate.start :: usando evidencia determinista, sin nueva llamada LLM');
    try {
      generatePdfReport(report, buildDeterministicPdfContent(report, approvedCleaningScript));
      setHasExported(true);
      addLog('pdf.generate.end :: reporte descargado');
    } catch (error: any) {
      addLog(`pdf.generate.error :: ${error.message || 'no fue posible generar el PDF'}`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExportJson = () => {
    if (!report) return;
    downloadTextFile(
      `aura_audit_${Date.now()}.json`,
      JSON.stringify({ fileName: file?.name, generatedAt: new Date().toISOString(), report, auditEvidence, aiAnalysis, improvementRun }, null, 2),
      'application/json;charset=utf-8'
    );
    setHasExported(true);
    addLog('JSON de auditoría exportado');
  };

  const handleExportIssuesCsv = () => {
    if (!report) return;
    const header = ['id', 'severity', 'category', 'ruleName', 'column', 'count', 'affectedPercentage', 'description', 'sampleValues'];
    const rows = report.issues.map((issue) => [
      issue.id,
      issue.severity,
      issue.category,
      issue.ruleName,
      issue.column ?? '',
      issue.count,
      issue.affectedPercentage.toFixed(2),
      issue.description,
      issue.sampleValues.map(String).join(' | '),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    downloadTextFile(`aura_issues_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
    setHasExported(true);
    addLog('CSV de anomalías exportado');
  };

  const handleExportApprovedScript = () => {
    if (!approvedCleaningScript) return;
    downloadTextFile(`aura_script_aprobado_${Date.now()}.py`, approvedCleaningScript, 'text/x-python;charset=utf-8');
    setHasExported(true);
    addLog('Script aprobado exportado');
  };

  const terminalRows = logs.length > 0
    ? logs
    : [{ time: '--:--:--', msg: 'Esperando un archivo CSV para analizar' }];

  const hasData = !!report;
  const hasAiAnalysis = !!aiAnalysis;
  const hasScript = !!cleaningScript;
  const hasApprovedScript = !!approvedCleaningScript;

  const steps = [
    { num: 1, label: 'Subir CSV', icon: <Upload size={14} />, target: 'ingesta', done: hasData, active: !hasData },
    { num: 2, label: 'Diagnóstico', icon: <Search size={14} />, target: 'resultados', done: hasData, active: hasData && !hasAiAnalysis && !hasScript && !isAiLoading },
    { num: 3, label: 'Explorar', icon: <Table2 size={14} />, target: 'explorar', done: hasData, active: false },
    { num: 4, label: 'Análisis IA', icon: <Brain size={14} />, target: 'ia', done: hasAiAnalysis, active: hasData && (isAiLoading || (hasAiAnalysis && !hasScript)) },
    { num: 5, label: 'Revisar', icon: <ClipboardCheck size={14} />, target: 'revision', done: hasApprovedScript, active: hasScript && !hasApprovedScript },
    { num: 6, label: 'Mejorar', icon: <ShieldCheck size={14} />, target: 'benchmark', done: !!improvementRun, active: hasData && !improvementRun },
    { num: 7, label: 'Exportar', icon: <FileText size={14} />, target: 'evidencia', done: hasExported, active: hasData && (hasApprovedScript || hasAiAnalysis || !!improvementRun) && !hasExported },
  ];

  return (
    <ErrorBoundary><div className="aura-system">
      {showSettings && (
        <SettingsPanel config={aiConfig} onSave={setAiConfig} onClose={() => setShowSettings(false)} />
      )}

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
                  <li><strong>Ejecuta la IA.</strong> Interpretación con modelo local o cloud.</li>
                  <li><strong>Genera script.</strong> Código Python para limpiar los datos.</li>
                  <li><strong>Exporta.</strong> Descarga el reporte PDF.</li>
                </ol>
              </details>

              <details className="help-section">
                <summary className="help-summary">Modelos locales vs cloud</summary>
                <div className="help-text">
                  <p><strong>Local (WebGPU):</strong> El modelo se descarga en tu navegador. Sin datos salen de tu dispositivo. Configura y descarga el modelo desde Ajustes antes de cargar datos.</p>
                  <p><strong>Cloud:</strong> Usa APIs de Google, Groq, DeepSeek u otros. Mayor capacidad pero los datos viajan al proveedor.</p>
                  <p><strong>Recomendación:</strong> Usa local para datos sensibles, cloud para análisis profundos.</p>
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

      <nav className="sys-nav">
        <span className="nav-logo">
          <span className="logo-full">AURA</span>
          <span className="logo-short">AU</span>
        </span>
        <div className={`nav-links ${showMobileNav ? 'nav-links-open' : ''}`}>
          <button className="nav-link" onClick={() => { scrollTo('sistema'); setShowMobileNav(false); }}>Inicio</button>
          {hasData && <button className="nav-link" onClick={() => { scrollTo('resultados'); setShowMobileNav(false); }}>Resultados</button>}
          {hasData && <button className="nav-link" onClick={() => { scrollTo('explorar'); setShowMobileNav(false); }}>Explorar</button>}
          {hasData && <button className="nav-link" onClick={() => { scrollTo('ia'); setShowMobileNav(false); }}>IA</button>}
          {hasData && <button className="nav-link" onClick={() => { scrollTo('evidencia'); setShowMobileNav(false); }}>Exportar</button>}
          <div className="nav-status"><div className="pulse" />{isProcessing || isAiLoading ? 'running' : 'online'}</div>
          <button className="nav-cta" onClick={() => { scrollTo('sistema'); setShowMobileNav(false); }}>
            {hasData ? 'Nuevo análisis' : 'Empezar'}
          </button>
          <button className="icon-btn" onClick={() => { setShowHelp(true); setShowMobileNav(false); }} aria-label="Centro de ayuda"><HelpCircle size={14} /></button>
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

      <main className="sys-main">
        {/* Stepper */}
        <section className="stepper" id="sistema">
          <div className="stepper-track">
            {steps.map((step, i) => (
              <React.Fragment key={step.num}>
                <button
                  className={`stepper-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}
                  onClick={() => scrollTo(step.target)}
                  disabled={!hasData && step.num > 1}
                >
                  <div className="stepper-icon">{step.done ? <Check size={14} /> : step.icon}</div>
                  <span className="stepper-label">{step.label}</span>
                </button>
                {i < steps.length - 1 && <div className="stepper-line" />}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Hero simplificado */}
        <section className="hero">
          <h1 className="hero-h1">Audita la calidad de tus datos.</h1>
          <p className="hero-sub">
            AURA detecta anomalías, interpreta con IA y genera reportes — todo en tu navegador.
          </p>
        </section>

        {/* Upload */}
        <section id="ingesta" className="ingest-block">
          <FileUpload onFileSelect={processFile} />
        </section>

        {/* Terminal */}
        <section className="term" aria-label="Bitacora de ejecucion">
          <div className="term-bar">
            <div className="term-dot" /><div className="term-dot" /><div className="term-dot" />
            <span className="term-label">tail -f aura.pipeline.log</span>
            <code>{auditEvidence?.datasetFingerprint || 'trace.ready()'}</code>
          </div>
          <div className="term-body">
            {terminalRows.map((row, index) => (
              <span className="tl" key={`${row.time}-${index}`}>
                <span className="ts">{row.time}</span>
                <span className="pr">→</span>
                <span className="ok">{row.msg}</span>
                {index === terminalRows.length - 1 && (isProcessing || isAiLoading) && <span className="cursor" />}
              </span>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="stats">
          <div className="stat"><p className="stat-lbl">registros</p><p className="stat-num">{report?.rowCount ?? '-'}</p><p className="stat-sub">dataset activo</p></div>
          <div className="stat"><p className="stat-lbl">anomalías</p><p className="stat-num">{report?.issues.length ?? '-'}</p><p className="stat-sub">detectadas</p></div>
          <div className="stat"><p className="stat-lbl">score</p><p className="stat-num">{report ? `${report.score}%` : '-'}</p><p className="stat-sub">motor determinista</p></div>
        </section>

        {/* Flujo compactado */}
        {!hasData && (
          <section className="section" id="flujo">
            <p className="sec-eye">flujo de trabajo</p>
            <div className="layers-compact">
              <div className="layer-c"><span className="layer-cn">01</span><span>Subir CSV</span></div>
              <div className="layer-c"><span className="layer-cn">02</span><span>Diagnóstico rápido</span></div>
              <div className="layer-c"><span className="layer-cn">03</span><span>Explorar evidencia</span></div>
              <div className="layer-c"><span className="layer-cn">04</span><span>Consultar IA</span></div>
              <div className="layer-c"><span className="layer-cn">05</span><span>Aprobar tratamiento</span></div>
              <div className="layer-c"><span className="layer-cn">06</span><span>Llevar informe</span></div>
            </div>
          </section>
        )}

        {/* Resultados */}
        {report && (
          <section className="section diagnostic-section" id="resultados">
            <div className="section-header">
              <div>
                <p className="sec-eye">resultados</p>
                <h2 className="sec-title">Análisis completado.</h2>
              </div>
            </div>
            <div className="score-grid">
              <div>
                <h2 className="hero-h1 score-title">{report.score}<em>%</em></h2>
                <p className="sec-body">
                  {report.score >= 80
                    ? 'Dataset consistente para análisis.'
                    : 'Requiere limpieza antes de usar los datos.'}
                </p>
              </div>
              <div className="score-bars">
                <ScoreBreakdown deductions={report.scoreBreakdown} />
              </div>
            </div>
            {auditEvidence && <ExecutionEvidencePanel evidence={auditEvidence} />}

            {/* Guía contextual: siguiente paso */}
            <div className="context-guide">
              <span className="guide-icon"><ArrowRight size={14} /></span>
              <div>
                <p className="guide-title">Siguiente paso: interpreta con IA</p>
                <p className="guide-desc">El motor detectó {report.issues.length} anomalías. La IA puede explicar el impacto y generar un script de limpieza.</p>
              </div>
              <button className="btn-p btn-sm" onClick={() => scrollTo('ia')}>Ir a IA <ArrowRight size={12} /></button>
            </div>
          </section>
        )}

        {report && (
          <section className="section" id="explorar">
            <p className="sec-eye">hallazgos</p>
            <h2 className="sec-title">Anomalías detectadas.</h2>
            <IssueList issues={report.issues} />
          </section>
        )}

        {report && (
          <section className="section">
            <p className="sec-eye">perfil de columnas</p>
            <h2 className="sec-title">Estructura observada.</h2>
            <DataProfile stats={report.columnStats} issues={report.issues} />
          </section>
        )}

        {/* IA Section */}
        {report && (
          <section className="section" id="ia">
            <div className="section-header">
              <div>
                <p className="sec-eye">consulta IA</p>
                <h2 className="sec-title">Interpretación LLM de hallazgos.</h2>
              </div>
              <div className="section-actions">
                <button className="btn-p" disabled={isAiLoading} onClick={() => runAiAnalysis(report)}>
                  <Play size={14} /> {isAiLoading ? 'Ejecutando LLM' : `Analizar con ${aiConfig.model.split('-').slice(0, 2).join(' ')}`}
                </button>
                <button className="btn-p" disabled={isScriptLoading} onClick={() => generateScript(report)}>
                  <FileCode2 size={14} /> {isScriptLoading ? 'Generando' : 'Generar script'}
                </button>
              </div>
            </div>
            <div className="cognitive-grid">
              <div className="advisor-shell">
                <GeminiAdvisor analysis={aiAnalysis} isLoading={isAiLoading} providerType={aiConfig.providerType} model={aiConfig.model} />
              </div>
              <aside className="mini-panel">
                <div className="layer"><span className="layer-n"><Database size={14} /></span><span className="layer-name">Evidencia enviada</span><span className="layer-tag">{report.issues.length} issues</span></div>
                <div className="layer"><span className="layer-n"><Brain size={14} /></span><span className="layer-name">{aiConfig.model}</span><span className="layer-tag">{aiConfig.providerType}</span></div>
                <div className="layer"><span className="layer-n"><ShieldCheck size={14} /></span><span className="layer-name">Última latencia</span><span className="layer-tag">{lastMetrics ? `${lastMetrics.latencyMs}ms` : '-'}</span></div>
                <div className="layer"><span className="layer-n"><FileText size={14} /></span><span className="layer-name">Salida</span><span className="layer-tag">interpretativa</span></div>
              </aside>
            </div>
            {cleaningScript && (
              <div className="mt-6" id="revision">
                <ScriptReview
                  code={cleaningScript}
                  language="python"
                  report={report}
                  approvedCode={approvedCleaningScript}
                  onDraftChange={() => setApprovedCleaningScript('')}
                  onApprove={(approvedCode) => {
                    setApprovedCleaningScript(approvedCode);
                    addLog('Script aprobado por revisión humana');
                  }}
                />
              </div>
            )}

            {/* Guía contextual: exportar */}
            {hasAiAnalysis && (
              <div className="context-guide">
                <span className="guide-icon"><ArrowRight size={14} /></span>
                <div>
                  <p className="guide-title">Siguiente paso: exporta evidencia determinista</p>
                  <p className="guide-desc">El PDF se genera desde reglas reproducibles. La salida LLM queda como interpretación, no como evidencia formal.</p>
                </div>
                <button className="btn-p btn-sm" onClick={() => scrollTo('evidencia')}>Exportar <FileText size={12} /></button>
              </div>
            )}
          </section>
        )}

        {report && (
          <section className="section" id="benchmark">
            <BenchmarkPanel
              report={report}
              config={aiConfig}
              originalData={rawData}
              fields={csvFields}
              delimiter={csvDelimiter}
              fileName={file?.name}
              auditEvidence={auditEvidence || undefined}
              cleaningScript={approvedCleaningScript || cleaningScript}
              onImprovementRun={(run) => {
                setImprovementRun(run);
                addLog(`Ciclo de mejora: ${run.healthDelta?.scoreDelta ?? 0} puntos simulados`);
              }}
              onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
            />
          </section>
        )}

        {improvementRun && <ImprovementRunPanel run={improvementRun} />}

        {report && (
          <section className="section" id="experimentos">
            <ExperimentDesigner report={report} config={aiConfig} onLog={(msg) => addLog(msg)} />
          </section>
        )}

        {report && (
          <section className="quote" id="evidencia">
            <p className="quote-text">Informe y evidencia listos para llevar.</p>
            <p className="quote-attr">Exporta el diagnóstico determinista, la interpretación y los artefactos aprobados.</p>
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

      <footer className="sys-footer">
        <span className="footer-brand">AURA</span>
        <span className="footer-copy">casabero · tfm · 2026</span>
      </footer>
    </div></ErrorBoundary>
  );
};

export default App;
