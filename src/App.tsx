import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Database, FileCode2, FileText, HelpCircle, Play, Settings, ShieldCheck, Check, ArrowRight, Upload, BarChart3 } from 'lucide-react';
import BenchmarkPanel from './components/BenchmarkPanel';
import ErrorBoundary from './components/ErrorBoundary';
import DataProfile from './components/DataProfile';
import { ExperimentDesigner } from './components/ExperimentDesigner';
import FileUpload from './components/FileUpload';
import GeminiAdvisor from './components/GeminiAdvisor';
import IssueList from './components/IssueList';
import ScoreBreakdown from './components/ScoreBreakdown';
import ScriptReview from './components/ScriptReview';
import SettingsPanel from './components/SettingsPanel';
import { createAIProvider } from './services/aiProvider';
import { runAudit } from './services/auditEngine';
import { parseCsv } from './services/csvService';
import { generatePdfReport } from './services/pdfGenerator';
import { AIConfig, AuditReport, IssueSeverity, ProviderMetrics } from './types';

const countBySeverity = (report: AuditReport | null, severity: IssueSeverity) =>
  report?.issues.filter((issue) => issue.severity === severity).length ?? 0;

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [cleaningScript, setCleaningScript] = useState('');
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('aura_ai_config');
    if (saved) return { providerType: 'local', temperature: 0.1, ...JSON.parse(saved) };
    return {
      apiKey: '',
      model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      temperature: 0.1,
      autoAnalyze: false,
      providerType: 'local',
    };
  });

  const aiProvider = useMemo(() => createAIProvider(aiConfig), [aiConfig]);
  const criticalCount = countBySeverity(report, IssueSeverity.CRITICAL);
  const warningCount = countBySeverity(report, IssueSeverity.WARNING);

  useEffect(() => {
    localStorage.setItem('aura_ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('es-CO', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { time, msg }].slice(-9));
  };

  const runAiAnalysis = async (currentReport: AuditReport) => {
    const isAvailable = await aiProvider.isAvailable();
    if (!isAvailable) {
      alert(
        aiConfig.providerType === 'local'
          ? 'WebGPU no esta disponible en este navegador. Usa Chrome/Edge compatible o cambia a proveedor cloud.'
          : 'Configura la API key para usar el proveedor cloud.'
      );
      setShowSettings(true);
      return;
    }

    setIsAiLoading(true);
    setAiAnalysis('');
    addLog('Analizando con IA...');

    try {
      const metrics = await aiProvider.analyzeStream(currentReport, (chunk) => {
        setAiAnalysis((prev) => prev + chunk);
      });
      setLastMetrics(metrics);
      addLog(`Análisis completado en ${Math.round(metrics.latencyMs / 1000)}s`);
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateScript = async (currentReport: AuditReport) => {
    const isAvailable = await aiProvider.isAvailable();
    if (!isAvailable) {
      alert(
        aiConfig.providerType === 'local'
          ? 'WebGPU no esta disponible en este navegador. Usa Chrome/Edge compatible o cambia a proveedor cloud.'
          : 'Configura la API key para usar el proveedor cloud.'
      );
      setShowSettings(true);
      return;
    }

    setIsScriptLoading(true);
    setCleaningScript('');
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
    setLogs([]);
    addLog(`Cargando ${uploadedFile.name}...`);

    try {
      const { data, meta } = await parseCsv(uploadedFile);
      addLog(`${data.length} registros · ${meta.fields?.length ?? 0} columnas`);

      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      setReport(auditResult);
      addLog(`Score: ${auditResult.score}/100 · ${auditResult.issues.length} anomalías detectadas`);

      if (aiConfig.autoAnalyze) {
        await runAiAnalysis(auditResult);
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
    addLog('Generando PDF...');
    try {
      const isAiAvailable = await aiProvider.isAvailable();

      if (isAiAvailable) {
        const { content: executiveContent, metrics } = await aiProvider.generateExecutiveReport(report);
        setLastMetrics(metrics);
        generatePdfReport(report, executiveContent);
        addLog('PDF generado con análisis IA');
      } else {
        const fallbackContent = {
          title: 'AURA — Informe de Auditoría',
          domain_inferred: 'Dataset cargado por el usuario',
          dataset_technical_description: `Dataset CSV con ${report.rowCount} registros y ${report.colCount} columnas. ${report.duplicateRows} filas duplicadas detectadas.`,
          executive_summary: 'Generado sin asistencia de IA. Los hallazgos se basan únicamente en el motor determinista de AURA.',
          business_impact: `Se detectaron ${report.issues.length} anomalías que pueden afectar la calidad del análisis. Revisar hallazgos antes de usar los datos.`,
          key_findings: report.issues.slice(0, 5).map((issue) => `${issue.severity.toUpperCase()}: ${issue.description}`),
          recommendations: [
            'Revisar las anomalías detectadas antes de usar el dataset',
            'Ejecutar con IA habilitada para obtener interpretación completa',
            'Verificar manualmente las muestras afectadas'
          ]
        };
        generatePdfReport(report, fallbackContent);
        addLog('PDF generado (sin IA)');
      }
    } catch (error: any) {
      addLog(`Error generando PDF: ${error.message || 'no fue posible generar el PDF'}`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const terminalRows = logs.length > 0
    ? logs
    : [{ time: '--:--:--', msg: 'Esperando un archivo CSV para analizar' }];

  const hasData = !!report;
  const hasAiAnalysis = !!aiAnalysis;
  const hasExport = hasData;

  const steps = [
    { num: 1, label: 'Carga', icon: <Upload size={14} />, done: hasData, active: !hasData },
    { num: 2, label: 'Analiza', icon: <Brain size={14} />, done: hasAiAnalysis, active: hasData && !hasAiAnalysis },
    { num: 3, label: 'Exporta', icon: <FileText size={14} />, done: false, active: hasAiAnalysis },
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
          {hasData && <button className="nav-link" onClick={() => { scrollTo('ia'); setShowMobileNav(false); }}>IA</button>}
          {hasData && <button className="nav-link" onClick={() => { scrollTo('benchmark'); setShowMobileNav(false); }}>Benchmark</button>}
          <div className="nav-status"><div className="pulse" />{isProcessing || isAiLoading ? 'running' : 'online'}</div>
          <button className="nav-cta" onClick={() => { scrollTo('sistema'); setShowMobileNav(false); }}>
            {hasData ? 'Nuevo análisis' : 'Empezar'}
          </button>
          <button className="icon-btn" onClick={() => { setShowHelp(true); setShowMobileNav(false); }} aria-label="Centro de ayuda"><HelpCircle size={14} /></button>
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
                <div className={`stepper-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                  <div className="stepper-icon">{step.done ? <Check size={14} /> : step.icon}</div>
                  <span className="stepper-label">{step.label}</span>
                </div>
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
            <span className="term-label">actividad</span>
          </div>
          <div className="term-body">
            {terminalRows.map((row, index) => (
              <span className="tl" key={`${row.time}-${index}`}>
                <span className="pr">→ </span>
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

        {/* Capas compactas */}
        {!hasData && (
          <section className="section" id="capas">
            <p className="sec-eye">arquitectura</p>
            <div className="layers-compact">
              <div className="layer-c"><span className="layer-cn">00</span><span>Infraestructura</span></div>
              <div className="layer-c"><span className="layer-cn">01</span><span>Motor determinista</span></div>
              <div className="layer-c"><span className="layer-cn">02</span><span>Cognitivo IA</span></div>
              <div className="layer-c"><span className="layer-cn">03</span><span>Gobernanza</span></div>
              <div className="layer-c"><span className="layer-cn">04</span><span>Benchmark</span></div>
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
          <section className="section">
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
                <p className="sec-eye">capa 2 · IA</p>
                <h2 className="sec-title">Interpretación cognitiva.</h2>
              </div>
              <div className="section-actions">
                <button className="btn-p" disabled={isAiLoading} onClick={() => runAiAnalysis(report)}>
                  <Play size={14} /> {isAiLoading ? 'Procesando' : 'Ejecutar IA'}
                </button>
                <button className="btn-p" disabled={isScriptLoading} onClick={() => generateScript(report)}>
                  <FileCode2 size={14} /> {isScriptLoading ? 'Generando' : 'Generar script'}
                </button>
              </div>
            </div>
            <div className="cognitive-grid">
              <div className="advisor-shell">
                <GeminiAdvisor analysis={aiAnalysis} isLoading={isAiLoading} />
              </div>
              <aside className="mini-panel">
                <div className="layer"><span className="layer-n"><Database size={14} /></span><span className="layer-name">Smart sample</span><span className="layer-tag">{report.issues.length} issues</span></div>
                <div className="layer"><span className="layer-n"><Brain size={14} /></span><span className="layer-name">{aiConfig.model}</span><span className="layer-tag">{aiConfig.providerType}</span></div>
                <div className="layer"><span className="layer-n"><ShieldCheck size={14} /></span><span className="layer-name">Última latencia</span><span className="layer-tag">{lastMetrics ? `${lastMetrics.latencyMs}ms` : '-'}</span></div>
              </aside>
            </div>
            {cleaningScript && (
              <div className="mt-6">
                <ScriptReview code={cleaningScript} language="python" />
              </div>
            )}

            {/* Guía contextual: exportar */}
            {hasAiAnalysis && (
              <div className="context-guide">
                <span className="guide-icon"><ArrowRight size={14} /></span>
                <div>
                  <p className="guide-title">Siguiente paso: exporta el reporte</p>
                  <p className="guide-desc">Descarga un PDF con el análisis completo, hallazgos y recomendaciones.</p>
                </div>
                <button className="btn-p btn-sm" onClick={() => scrollTo('evidencia')}>Exportar <FileText size={12} /></button>
              </div>
            )}
          </section>
        )}

        {report && (
          <section className="section" id="benchmark">
            <BenchmarkPanel report={report} config={aiConfig} onLog={(msg) => addLog(msg)} />
          </section>
        )}

        {report && (
          <section className="section" id="experimentos">
            <ExperimentDesigner report={report} config={aiConfig} onLog={(msg) => addLog(msg)} />
          </section>
        )}

        {report && (
          <section className="quote" id="evidencia">
            <p className="quote-text">"La calidad de los datos no es un problema técnico: es un problema de conocimiento, evidencia y trazabilidad."</p>
            <p className="quote-attr">AURA · memoria TFM · arquitectura experimental</p>
            <div className="hero-actions quote-actions">
              <button className="btn-p" onClick={handleDownloadPdf} disabled={isPdfGenerating}>
                <FileText size={14} /> {isPdfGenerating ? 'Generando' : 'Exportar reporte'}
              </button>
              <button className="btn-s">críticos {criticalCount} · advertencias {warningCount}</button>
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
