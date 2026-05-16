import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from './components/FileUpload';
import ScoreGauge from './components/ScoreGauge';
import IssueList from './components/IssueList';
import GeminiAdvisor from './components/GeminiAdvisor';
import DataProfile from './components/DataProfile';
import SettingsPanel from './components/SettingsPanel';
import BenchmarkPanel from './components/BenchmarkPanel';
import { parseCsv } from './services/csvService';
import { runAudit } from './services/auditEngine';
import { createAIProvider } from './services/aiProvider';
import { generatePdfReport } from './services/pdfGenerator';
import ScoreBreakdown from './components/ScoreBreakdown';
import { AuditReport, AIConfig, ProviderMetrics } from './types';
import { Moon, Sun, Settings, Database, Activity, ShieldAlert, Cpu } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [logs, setLogs] = useState<{time: string, msg: string, bold: string}[]>([]);
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('aura_ai_config');
    if (saved) return { providerType: 'local', ...JSON.parse(saved) };
    return { apiKey: '', model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', autoAnalyze: false, providerType: 'local' };
  });

  const aiProvider = useMemo(() => createAIProvider(aiConfig), [aiConfig]);

  useEffect(() => {
    localStorage.setItem('aura_ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const addLog = (bold: string, msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    setLogs(prev => [...prev, { time, bold, msg }]);
  };

  const runAiAnalysis = async (currentReport: AuditReport) => {
    const isAvailable = await aiProvider.isAvailable();
    if (!isAvailable) {
      alert(aiConfig.providerType === 'local'
        ? "Tu navegador no tiene WebGPU disponible para el modelo local. Puedes usar Chrome/Edge compatible o ejecutar el contraste cloud desde ajustes."
        : "Configura tu API Key en ajustes para usar el proveedor cloud."
      );
      setShowSettings(true);
      return;
    }
    setIsAiLoading(true);
    setAiAnalysis('');
    addLog('llm.guard', 'generando smart sample y llamando motor cognitivo...');
    try {
      const metrics = await aiProvider.analyzeStream(currentReport, (chunk) => {
        setAiAnalysis(prev => prev + chunk);
      });
      setLastMetrics(metrics);
      addLog('llm.done', `análisis cognitivo completado en ${metrics.latencyMs}ms`);
    } catch (err: any) {
      addLog('llm.error', `fallo en motor: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setReport(null);
    setAiAnalysis('');
    setLogs([]);
    addLog('csv.parse', `cargando ${uploadedFile.name} en memoria local`);

    try {
      const { data, meta } = await parseCsv(uploadedFile);
      addLog('csv.ready', `detectadas ${data.length} filas y ${meta.fields?.length} columnas`);
      
      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      addLog('rules.run', `22 reglas aplicadas deterministas finalizadas. Score: ${auditResult.score}`);
      setReport(auditResult);

      if (aiConfig.autoAnalyze) {
        await runAiAnalysis(auditResult);
      }
    } catch (err: any) {
      addLog('error', `fallo crítico: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsPdfGenerating(true);
    addLog('report.build', 'generando reporte ejecutivo PDF y scripts HITL');
    try {
      const { content: executiveContent, metrics } = await aiProvider.generateExecutiveReport(report);
      setLastMetrics(metrics);
      generatePdfReport(report, executiveContent);
      addLog('report.done', 'reporte descargado exitosamente');
    } catch (error: any) {
      addLog('report.error', 'error al generar PDF');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="page" data-theme={theme}>
      {showSettings && (
        <SettingsPanel config={aiConfig} onSave={setAiConfig} onClose={() => setShowSettings(false)} />
      )}

      {/* Sidebar */}
      <aside className="sidebar" aria-label="Navegación de AURA">
        <div className="brand">
          <div className="brand-mark">AU</div>
          <p className="brand-title">AURA</p>
          <p className="brand-subtitle">Entorno de diagnóstico cognitivo para calidad del dato.</p>
        </div>

        <nav className="nav" aria-label="Secciones">
          <button aria-current="page"><span className="nav-icon"><Activity size={12} className="absolute inset-0 m-auto" /></span>Diagnóstico</button>
          <button><span className="nav-icon"><Database size={12} className="absolute inset-0 m-auto" /></span>Motor de reglas</button>
          <button><span className="nav-icon"><Cpu size={12} className="absolute inset-0 m-auto" /></span>Capa cognitiva</button>
          <button><span className="nav-icon"><ShieldAlert size={12} className="absolute inset-0 m-auto" /></span>Gobernanza</button>
        </nav>

        <div className="system-card">
          <div className="status-line">
            <span className="label">Modo ejecución</span>
            <span className="status-pill">{aiConfig.providerType === 'local' ? 'LOCAL' : 'CLOUD'}</span>
          </div>
          <div className="status-line">
            <span className="label">Modelo IA</span>
            <span className="status-pill">{aiConfig.providerType === 'local' ? 'WebGPU' : 'Cloud'}</span>
          </div>
          <div className="status-line">
            <span className="label">Privacidad</span>
            <span className="status-pill">PII SAFE</span>
          </div>
          <p className="fine">El CSV y las reglas se ejecutan localmente; si usas cloud, solo se envía el smart sample.</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb" aria-label="Ruta">
            <span>aura</span><span>/</span><span>diagnostico</span><span>/</span><b>v1.0.4</b>
          </div>
          <div className="actions">
            {report && (
              <button onClick={handleDownloadPdf} disabled={isPdfGenerating} className="secondary">
                {isPdfGenerating ? 'Generando...' : 'Exportar Reporte'}
              </button>
            )}
            <button onClick={() => setShowSettings(true)} className="icon-button" title="Ajustes">
              <Settings size={16} />
            </button>
            <button onClick={toggleTheme} className="icon-button" title="Cambiar tema">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Workspace */}
        <div className="workspace">
          
          {/* Hero & Terminal */}
          <section className="proposal" aria-labelledby="hero-title">
            <div className="hero">
              <div>
                <p className="eyebrow">Motor Determinista + Cognitivo // v1.0.4</p>
                <h1 id="hero-title">Consola soberana de diagnóstico de datos.</h1>
                <p className="lead">AURA opera como un instrumento de gobernanza: primero genera evidencia reproducible, interpreta con IA anclada a hallazgos, y entrega scripts auditables.</p>
              </div>
              <div className="hero-footer" aria-label="Indicadores clave">
                <div className="metric"><strong>22+</strong><span>Reglas deterministas</span></div>
                <div className="metric"><strong>4</strong><span>Capas de estabilidad</span></div>
                <div className="metric"><strong>L/C</strong><span>Local vs Cloud</span></div>
                <div className="metric"><strong>HITL</strong><span>Gobernanza revisable</span></div>
              </div>
            </div>

            <div className="terminal" aria-label="Bitácora de proceso">
              <div className="terminal-head">
                <span>pipeline.log</span>
                <span>{isProcessing || isAiLoading ? 'streaming activo' : 'idle'}</span>
              </div>
              <div className="terminal-body">
                {logs.length === 0 && (
                  <div className="log-row opacity-50"><span>--:--</span><span>Esperando inserción de dataset...<span className="cursor"></span></span></div>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="log-row">
                    <span>{l.time}</span>
                    <span><b>{l.bold}</b> {l.msg}
                      {i === logs.length - 1 && (isProcessing || isAiLoading) && <span className="cursor"></span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Área de Trabajo Interactiva */}
          <section>
            <div className="section-title">
              <div>
                <p className="eyebrow">Flujo Operativo</p>
                <h2>Análisis Integral</h2>
              </div>
              <p>Arrastre su archivo CSV para iniciar el flujo de validación. Los datos crudos nunca abandonarán su navegador durante la fase determinista.</p>
            </div>

            <div className="app-grid mt-8">
              
              {/* Panel de Subida / Progreso */}
              <div className="panel">
                <div className="panel-head">
                  <h3>Ingreso de datos</h3>
                  <span className="badge">CSV</span>
                </div>
                
                <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg)]">
                   <FileUpload onFileSelect={processFile} />
                </div>

                {isProcessing && (
                  <div className="progress-block mt-4">
                    <div className="progress-meta"><span>Aplicando reglas deterministas</span><b>Procesando...</b></div>
                    <div className="progress animating"><span style={{ '--value': '60%' } as React.CSSProperties}></span></div>
                  </div>
                )}
                
                {report && (
                   <div className="progress-block mt-4">
                     <div className="progress-meta"><span>Motor determinista completado</span><b>100%</b></div>
                     <div className="progress"><span style={{ '--value': '100%' } as React.CSSProperties}></span></div>
                   </div>
                )}
              </div>

              {/* Dashboard Resultante (Aparece al tener reporte) */}
              {report && (
                <div className="dashboard">
                  <div className="score-row">
                    <div className="score-card relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="eyebrow text-[var(--ink2)]">Salud del Dataset</p>
                        <div className="score mt-4 mb-2">{report.score}<small>/100</small></div>
                        <p className="font-serif text-[15px] leading-relaxed text-[var(--ink2)]">
                           {report.score >= 80 ? 'Calidad óptima para despliegues analíticos.' : 'Insuficiente para automatización sin limpieza rigurosa previa.'}
                        </p>
                      </div>
                      <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none mix-blend-multiply w-64 h-64">
                         <ScoreGauge score={report.score} />
                      </div>
                    </div>
                    
                    <div className="quality-bars">
                       <ScoreBreakdown deductions={report.scoreBreakdown} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Grillas de Datos (Aparece si hay reporte) */}
          {report && (
            <section className="mt-8 space-y-8">
               <div className="card !p-0 overflow-hidden border-[var(--border-strong)]">
                  <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)] flex justify-between items-center">
                    <h3 className="font-serif text-[21px] m-0">Perfil de Columnas</h3>
                    <span className="screen-label">./perfil</span>
                  </div>
                  <DataProfile stats={report.columnStats} issues={report.issues} />
               </div>

               {report.issues.length > 0 && (
                 <div className="card !p-0 overflow-hidden border-[var(--border-strong)]">
                    <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)] flex justify-between items-center">
                      <h3 className="font-serif text-[21px] m-0">Registro de Anomalías</h3>
                      <span className="screen-label">./hallazgos</span>
                    </div>
                    <div className="bg-[var(--bg)] p-2">
                      <IssueList issues={report.issues} />
                    </div>
                 </div>
               )}
            </section>
          )}

          {/* Capa Cognitiva */}
          {report && (
            <section aria-labelledby="ai-title" className="mt-12">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Capa Cognitiva</p>
                  <h2 id="ai-title">Análisis e Interpretación</h2>
                </div>
                <p>El proveedor cognitivo interpreta dominios, clasifica impacto estructural y propone rutinas de mitigación basadas en evidencia determinista.</p>
              </div>

              <div className="ai-layout mt-8">
                <div className="analysis min-h-[500px]">
                  <header>
                    <span className="screen-label">./analisis_cognitivo</span>
                    <span className="badge">Motor: {aiConfig.providerType === 'local' ? 'Local' : 'Cloud'} · {aiConfig.model}</span>
                  </header>
                  <div className="bg-[var(--bg)] h-[calc(100%-58px)] overflow-hidden">
                     <GeminiAdvisor analysis={aiAnalysis} isLoading={isAiLoading} />
                  </div>
                </div>

                <aside className="side-stack">
                  <div className="evidence">
                    <h3>Smart Sample</h3>
                    <p className="mt-2 text-[13px]">Dataset curado enviado al motor cognitivo post-análisis determinista.</p>
                    <div className="evidence-list">
                      <div className="evidence-row"><span className="badge">Estructura</span><span>{report.rowCount} filas, {report.colCount} columnas</span></div>
                      <div className="evidence-row"><span className="badge">Reglas</span><span>{report.issues.length} violaciones detectadas</span></div>
                      <div className="evidence-row"><span className="badge">Salud</span><span>Score global: {report.score}/100</span></div>
                    </div>
                  </div>
                  
                  <div className="evidence">
                    <h3>Gobernanza HITL</h3>
                    <p className="mt-2 text-[13px]">Las recomendaciones deben aprobarse manualmente antes de incorporarse al pipeline.</p>
                    <div className="progress-block mt-4">
                      <div className="progress-meta"><span>Revisión Humana</span><b>Pendiente</b></div>
                      <div className="progress"><span style={{ '--value': '30%' } as React.CSSProperties}></span></div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )}

          {report && (
            <BenchmarkPanel report={report} config={aiConfig} onLog={addLog} />
          )}

        </div>
      </main>
    </div>
  );
};

export default App;
