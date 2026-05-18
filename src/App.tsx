import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Database, FileCode2, FileText, HelpCircle, Play, Settings, ShieldCheck } from 'lucide-react';
import BenchmarkPanel from './components/BenchmarkPanel';
import ErrorBoundary from './components/ErrorBoundary';
import DataProfile from './components/DataProfile';
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
  const [logs, setLogs] = useState<{ time: string; msg: string; bold: string }[]>([]);
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

  const addLog = (bold: string, msg: string) => {
    const time = new Date().toLocaleTimeString('es-CO', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { time, bold, msg }].slice(-9));
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
    addLog('capa_2', 'smart sample enviado al motor cognitivo');

    try {
      const metrics = await aiProvider.analyzeStream(currentReport, (chunk) => {
        setAiAnalysis((prev) => prev + chunk);
      });
      setLastMetrics(metrics);
      addLog('capa_2.ok', `respuesta completada en ${metrics.latencyMs} ms`);
    } catch (err: any) {
      addLog('capa_2.error', err.message);
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
    addLog('capa_3', 'generando script de limpieza python');

    try {
      const { content, metrics } = await aiProvider.generateExecutiveReport(currentReport);
      setLastMetrics(metrics);
      const script = content.python_script || '';
      setCleaningScript(script);
      addLog('capa_3.ok', `script generado · ${script.split('\n').length} líneas`);
    } catch (err: any) {
      addLog('capa_3.error', err.message);
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
    addLog('aura.run', `${uploadedFile.name} cargado en memoria local`);

    try {
      const { data, meta } = await parseCsv(uploadedFile);
      addLog('csv.parse', `${data.length} registros · ${meta.fields?.length ?? 0} columnas · delimitador ${meta.delimiter}`);

      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      setReport(auditResult);
      addLog('capa_1.ok', `${auditResult.issues.length} anomalías · score ${auditResult.score}/100`);

      if (aiConfig.autoAnalyze) {
        await runAiAnalysis(auditResult);
      }
    } catch (err: any) {
      addLog('aura.error', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsPdfGenerating(true);
    addLog('report', 'generando informe ejecutivo');
    try {
      const isAiAvailable = await aiProvider.isAvailable();

      if (isAiAvailable) {
        const { content: executiveContent, metrics } = await aiProvider.generateExecutiveReport(report);
        setLastMetrics(metrics);
        generatePdfReport(report, executiveContent);
        addLog('report.ok', 'PDF descargado (con IA)');
      } else {
        // Offline fallback - generate PDF with minimal executive content
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
        addLog('report.ok', 'PDF descargado (offline)');
      }
    } catch (error: any) {
      addLog('report.error', error.message || 'no fue posible generar el PDF');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const terminalRows = logs.length > 0
    ? logs
    : [
        { time: '--:--:--', bold: 'aura.idle', msg: 'esperando dataset CSV' },
        { time: '--:--:--', bold: 'capa_0', msg: `${aiConfig.providerType === 'local' ? 'llm local configurado' : 'contraste cloud configurado'}` },
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
                <summary className="help-summary">Flujo operativo</summary>
                <ol className="help-steps">
                  <li><strong>Carga un CSV.</strong> La Capa 0 (WebLLM local) y Capa 1 (motor determinista) se ejecutan al instante.</li>
                  <li><strong>Revisa resultados.</strong> Score general, reglas activadas, perfil de columnas y muestras afectadas.</li>
                  <li><strong>Ejecuta la Capa 2.</strong> Interpretación con LLM local (WebGPU) o contraste cloud (Gemini).</li>
                  <li><strong>Script de limpieza.</strong> La Capa 3 genera un script Python revisable antes de aplicarlo.</li>
                  <li><strong>Benchmark.</strong> Capa 4: compara LLM local vs cloud bajo las mismas condiciones.</li>
                  <li><strong>Reglas activas.</strong> 24 reglas deterministas: 3 globales (duplicados, incoherencia temporal, redundancia derivable) y 21 por columna (nulos, tipos, formatos, PII, freshness, etc).</li>
                  <li><strong>Exporta.</strong> Descarga el reporte PDF con evidencia completa.</li>
                </ol>
              </details>

              <details className="help-section">
                <summary className="help-summary">Arquitectura</summary>
                <div className="layers help-layers">
                  <div className="layer"><span className="layer-n">00</span><span className="layer-name">Infraestructura</span><span className="layer-desc">WebLLM/WebGPU como ruta principal. Sin datos al servidor.</span><span className="layer-tag">local</span></div>
                  <div className="layer"><span className="layer-n">01</span><span className="layer-name">Motor determinista</span><span className="layer-desc">24 reglas Typescript auditables. Sin IA, sin secretos.</span><span className="layer-tag">rules</span></div>
                  <div className="layer"><span className="layer-n">02</span><span className="layer-name">Cognitivo</span><span className="layer-desc">Smart sample + salida estructurada. Interpretación anclada a evidencia.</span><span className="layer-tag">LLM</span></div>
                  <div className="layer"><span className="layer-n">03</span><span className="layer-name">Gobernanza</span><span className="layer-desc">Scripts revisables antes de aplicar. Control humano (HITL).</span><span className="layer-tag">human</span></div>
                  <div className="layer"><span className="layer-n">04</span><span className="layer-name">Benchmark</span><span className="layer-desc">Local vs cloud bajo condiciones comparables. Evidencia para TFM.</span><span className="layer-tag">evidence</span></div>
                </div>
              </details>

              <details className="help-section">
                <summary className="help-summary">Modelos y proveedores</summary>
                <div className="help-text">
                  <p><strong>Local (WebLLM):</strong> Usa WebGPU en Chrome/Edge. Modelo por defecto: Llama-3.2-3B-Instruct. Sin API key, sin datos que salgan del navegador.</p>
                  <p><strong>Cloud (Gemini):</strong> Ingresa tu API key de Google AI Studio en Ajustes. Mayor capacidad de análisis, pero los datos viajan al proveedor.</p>
                  <p><strong>Pro tip:</strong> Usa local para datos sensibles, cloud para análisis profundos. Benchmark te ayuda a comparar ambos.</p>
                </div>
              </details>

              <details className="help-section">
                <summary className="help-summary">Reportes y scores</summary>
                <div className="help-text">
                  <p><strong>Score (0-100):</strong> Penaliza por anomalías detectadas. &gt;80 = dataset confiable, &lt;80 = requiere limpieza.</p>
                  <p><strong>Reglas:</strong> 24 reglas verifican aspectos distintos: nulos, duplicados, outliers, formatos, integridad referencial, PII, freshness, etc.</p>
                  <p><strong>Anomalías:</strong> CRITICAL (bloqueante), WARNING (requiere revisión), INFO (sugerencia).</p>
                  <p><strong>PDF:</strong> Incluye score, reglas activadas, perfil de columnas e interpretación IA (si está disponible).</p>
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
          <button className="nav-link" onClick={() => { scrollTo('sistema'); setShowMobileNav(false); }}>Sistema</button>
          <button className="nav-link" onClick={() => { scrollTo('capas'); setShowMobileNav(false); }}>Capas</button>
          <button className="nav-link" onClick={() => { scrollTo('benchmark'); setShowMobileNav(false); }}>Benchmark</button>
          <button className="nav-link" onClick={() => { scrollTo('evidencia'); setShowMobileNav(false); }}>Docs</button>
          <div className="nav-status"><div className="pulse" />{isProcessing || isAiLoading ? 'running' : 'online'}</div>
          <button className="nav-cta" onClick={() => { scrollTo('sistema'); setShowMobileNav(false); }}>Iniciar diagnóstico</button>
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
        <section className="hero" id="sistema">
          <div className="hero-pre">
            <span className="hero-badge">tfm · tipo 2</span>
            <span className="hero-badge">{aiConfig.providerType === 'local' ? 'local-first' : 'cloud contrast'}</span>
            {file && <span className="hero-badge">{file.name}</span>}
          </div>
          <h1 className="hero-h1">Diagnóstico<br /><em>cognitivo</em> de<br />calidad de datos.</h1>
          <div className="hero-actions">
            <button className="btn-p" onClick={() => scrollTo('ingesta')}>Ejecutar AURA →</button>
            <button className="btn-s" onClick={() => setShowHelp(true)}>? Ayuda</button>
          </div>
        </section>

        <section id="ingesta" className="ingest-block">
          <FileUpload onFileSelect={processFile} />
        </section>

        <section className="term" aria-label="Bitacora de ejecucion">
          <div className="term-bar">
            <div className="term-dot" /><div className="term-dot" /><div className="term-dot" />
            <span className="term-label">aura · pipeline · diagnostico activo</span>
          </div>
          <div className="term-body">
            {terminalRows.map((row, index) => (
              <span className="tl" key={`${row.time}-${index}`}>
                <span className="pr">→ </span>
                <span className="cm">{row.bold}</span>
                <span className="ok"> · {row.msg}</span>
                {index === terminalRows.length - 1 && (isProcessing || isAiLoading) && <span className="cursor" />}
              </span>
            ))}
          </div>
        </section>

        <section className="stats">
          <div className="stat"><p className="stat-lbl">registros</p><p className="stat-num">{report?.rowCount ?? '-'}</p><p className="stat-sub">dataset activo</p></div>
          <div className="stat"><p className="stat-lbl">anomalías</p><p className="stat-num">{report?.issues.length ?? '-'}</p><p className="stat-sub">detectadas</p></div>
          <div className="stat"><p className="stat-lbl">score</p><p className="stat-num">{report ? `${report.score}%` : '-'}</p><p className="stat-sub">motor determinista</p></div>
        </section>

        <section className="section" id="capas">
          <p className="sec-eye">arquitectura · capas de control</p>
          <h2 className="sec-title">Un sistema que razona<br />sobre sus propios datos.</h2>
          <p className="sec-body">
            Cada capa reduce incertidumbre desde una responsabilidad distinta: privacidad, reglas,
            interpretación cognitiva, validación humana y evidencia experimental.
          </p>
          <div className="layers">
            <div className="layer"><span className="layer-n">00</span><span className="layer-name">Infraestructura local</span><span className="layer-desc">WebLLM/WebGPU como ruta principal</span><span className="layer-tag">local</span></div>
            <div className="layer"><span className="layer-n">01</span><span className="layer-name">Motor determinista</span><span className="layer-desc">24 reglas TypeScript auditables</span><span className="layer-tag">rules</span></div>
            <div className="layer"><span className="layer-n">02</span><span className="layer-name">Estabilidad cognitiva</span><span className="layer-desc">Smart sample + salida estructurada</span><span className="layer-tag">LLM</span></div>
            <div className="layer"><span className="layer-n">03</span><span className="layer-name">Gobernanza HITL</span><span className="layer-desc">Scripts revisables antes de aplicar</span><span className="layer-tag">human</span></div>
            <div className="layer"><span className="layer-n">04</span><span className="layer-name">Benchmark experimental</span><span className="layer-desc">Local vs cloud bajo condiciones comparables</span><span className="layer-tag">evidence</span></div>
          </div>
        </section>

        {report && (
          <section className="section diagnostic-section">
            <p className="sec-eye">capa 1 · reporte determinista</p>
            <div className="score-grid">
              <div>
                <h2 className="hero-h1 score-title">{report.score}<em>%</em></h2>
                <p className="sec-body">
                  {report.score >= 80
                    ? 'Base de datos consistente para análisis asistido.'
                    : 'Se requiere limpieza antes de automatizar decisiones o conclusiones.'}
                </p>
              </div>
              <div className="score-bars">
                <ScoreBreakdown deductions={report.scoreBreakdown} />
              </div>
            </div>
          </section>
        )}

        {report && (
          <section className="section">
            <p className="sec-eye">hallazgos · reglas activadas</p>
            <h2 className="sec-title">Anomalías detectadas.</h2>
            <IssueList issues={report.issues} />
          </section>
        )}

        {report && (
          <section className="section">
            <p className="sec-eye">perfil · columnas</p>
            <h2 className="sec-title">Estructura observada.</h2>
            <DataProfile stats={report.columnStats} issues={report.issues} />
          </section>
        )}

        {report && (
          <section className="section">
            <div className="panel-line">
              <div>
                <p className="sec-eye">capa 2 · interpretacion</p>
                <h2 className="sec-title">IA anclada a evidencia.</h2>
              </div>
              <button className="btn-p" disabled={isAiLoading} onClick={() => runAiAnalysis(report)}>
                <Play size={14} /> {isAiLoading ? 'Procesando' : 'Ejecutar IA'}
              </button>
              <button className="btn-p" disabled={isScriptLoading} onClick={() => generateScript(report)}>
                <FileCode2 size={14} /> {isScriptLoading ? 'Generando' : 'Generar script'}
              </button>
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
          </section>
        )}

        {report && (
          <section className="section" id="benchmark">
            <BenchmarkPanel report={report} config={aiConfig} onLog={addLog} />
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
