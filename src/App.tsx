import React, { useState, useEffect, useMemo } from 'react';
import FileUpload from './components/FileUpload';
import ScoreGauge from './components/ScoreGauge';
import IssueList from './components/IssueList';
import GeminiAdvisor from './components/GeminiAdvisor';
import DataProfile from './components/DataProfile';
import SettingsPanel from './components/SettingsPanel';
import AuraLogo from './components/AuraLogo';
import { parseCsv } from './services/csvService';
import { runAudit } from './services/auditEngine';
import { createAIProvider } from './services/aiProvider';
import { generatePdfReport } from './services/pdfGenerator';
import ScoreBreakdown from './components/ScoreBreakdown';
import { AuditReport, AIConfig, ProviderMetrics } from './types';
import { FileSpreadsheet, RotateCcw, LayoutDashboard, AlertCircle, CheckCircle, AlertTriangle, FileDown, Loader2, Settings, Sparkles, BookOpen, Cpu, Terminal, Shield, BarChart3, Brain } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'IA'>('DASHBOARD');
  const [lastMetrics, setLastMetrics] = useState<ProviderMetrics | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('aura_ai_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migración: agregar providerType si no existe
      return { providerType: 'cloud', ...parsed };
    }
    return {
      apiKey: '',
      model: 'gemini-2.0-flash',
      autoAnalyze: true,
      providerType: 'cloud' as const
    };
  });

  // Capa 2: Proveedor de IA reactivo a la configuración
  const aiProvider = useMemo(() => createAIProvider(aiConfig), [aiConfig]);

  useEffect(() => {
    localStorage.setItem('aura_ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  // Konami Code Easter Egg
  useEffect(() => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let position = 0;

    const handler = (e: KeyboardEvent) => {
      if (e.key === konamiCode[position]) {
        position++;
        if (position === konamiCode.length) {
          document.body.classList.toggle('blueprint-mode');
          console.log("%c SYSTEM OVERRIDE: Blueprint Mode Active ", "background: #003366; color: #fff; font-weight: bold;");
          position = 0;
        }
      } else { position = 0; }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const runAiAnalysis = async (currentReport: AuditReport) => {
    const isAvailable = await aiProvider.isAvailable();
    if (!isAvailable) {
      alert("Por favor, configura tu API Key en los ajustes para usar la IA.");
      setShowSettings(true);
      return;
    }
    setIsAiLoading(true);
    setAiAnalysis('');
    try {
      // Capa 2: Análisis via proveedor abstracto (Gemini o WebLLM)
      const metrics = await aiProvider.analyzeStream(currentReport, (chunk) => {
        setAiAnalysis(prev => prev + chunk);
      });
      setLastMetrics(metrics);
      console.log('[AURA] Métricas de análisis:', metrics);
    } catch (err: any) {
      console.error(err);
      alert(`Error en IA: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setReport(null);
    setAiAnalysis('');

    try {
      const { data, meta } = await parseCsv(uploadedFile);
      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      setReport(auditResult);

      if (aiConfig.autoAnalyze) {
        await runAiAnalysis(auditResult);
      }

    } catch (err: any) {
      console.error(err);
      alert(`Error procesando el archivo: ${err.message || "Verifica el formato del CSV"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsPdfGenerating(true);
    try {
      // Capa 3: Reporte ejecutivo via proveedor abstracto
      const { content: executiveContent, metrics } = await aiProvider.generateExecutiveReport(report);
      setLastMetrics(metrics);
      generatePdfReport(report, executiveContent);
    } catch (error: any) {
      console.error('PDF Generation Error:', error);
      alert(`Error generando el PDF: ${error.message || "Verifica tu API Key o conexión"}`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setReport(null);
    setAiAnalysis('');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[var(--bg)] selection:bg-[var(--ink-soft)] selection:text-[var(--bg)]">

      {showSettings && (
        <SettingsPanel
          config={aiConfig}
          onSave={setAiConfig}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Panel Orquestador Principal */}
      <div className={`flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-700 scroll-smooth`}>
        <header className="px-8 py-6 border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <AuraLogo />
            <div className="pt-1">
              <h1 className="text-2xl font-sans font-bold text-[var(--ink)] tracking-widest uppercase">AURA</h1>
              <p className="text-[10px] text-[var(--ink2)] font-mono uppercase tracking-[0.2em] font-medium mt-1">Auditoría Técnica de Datos // v1.0.4</p>
            </div>
          </div>

          {report && (
            <nav className="flex items-center bg-[var(--surface)] border border-[var(--border)] p-1 rounded-sm">
              <button
                onClick={() => setActiveTab('DASHBOARD')}
                className={`flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all rounded-sm ${activeTab === 'DASHBOARD' ? 'bg-[var(--ink)] text-[var(--bg)] shadow-sm' : 'text-[var(--ink2)] hover:text-[var(--ink)]'}`}
              >
                <BarChart3 size={14} /> ./dashboard
              </button>
              <button
                onClick={() => setActiveTab('IA')}
                className={`flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all rounded-sm ${activeTab === 'IA' ? 'bg-[var(--ink)] text-[var(--bg)] shadow-sm' : 'text-[var(--ink2)] hover:text-[var(--ink)]'}`}
              >
                <Brain size={14} /> ./analisis_ia
              </button>
            </nav>
          )}

          <div className="flex items-center gap-5">
            {report && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="p-2 text-[var(--ink2)] hover:text-[var(--error)] transition-colors rounded-sm border border-[var(--border)] bg-[var(--surface)]"
                  title="Reiniciar Auditoría"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                  className="casabero-btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {isPdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  EXPORTAR REPORTE
                </button>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-[var(--ink2)] hover:text-[var(--ink)] transition-colors rounded border border-transparent hover:border-[var(--border)]"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 relative">
          {!report ? (
            <div className="h-full flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-1000">
              <div className="text-center max-w-2xl space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--ink2)] text-[10px] font-mono rounded-sm animate-in slide-in-from-top-4 duration-500">
                  <Shield size={10} /> ENTORNO SEGURO // EJECUCIÓN_LOCAL
                </div>
                <div className="relative inline-block">
                  <h2 className="text-5xl font-serif font-black text-[var(--ink)] tracking-tight leading-[1.1] cursor-default">
                    Diagnóstico Integral de Calidad de Datos
                  </h2>
                </div>
                <p className="text-[var(--ink2)] font-serif text-lg font-light leading-relaxed italic">
                  Análisis determinista de precisión quirúrgica combinado con razonamiento cognitivo local para la validación estructural de sus datasets.
                </p>
              </div>

              <FileUpload onFileSelect={processFile} />

              <div className="mt-20 grid grid-cols-3 gap-10 max-w-3xl text-[var(--ink2)] border-t border-[var(--border)] pt-12">
                <div className="text-center space-y-3">
                  <p className="font-serif font-bold text-3xl text-[var(--ink)]">20+</p>
                  <p className="text-[9px] font-sans uppercase tracking-[0.15em] font-medium">Reglas Lógicas</p>
                </div>
                <div className="text-center space-y-3 border-x border-[var(--border)] px-10">
                  <p className="font-serif font-bold text-3xl text-[var(--ink)]">100%</p>
                  <p className="text-[9px] font-sans uppercase tracking-[0.15em] font-medium">Privacidad Local</p>
                </div>
                <div className="text-center space-y-3">
                  <p className="font-serif font-bold text-3xl text-[var(--ink)]">IA</p>
                  <p className="text-[9px] font-sans uppercase tracking-[0.15em] font-medium">Análisis Cognitivo</p>
                </div>
              </div>

              <footer className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-[11px] font-serif italic text-[var(--ink-muted)]">
                  by <a href="https://casabero.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)] transition-colors">casabero.com</a>
                </p>
              </footer>
            </div>
          ) : (
            <div className="animate-in fade-in duration-700">
              {activeTab === 'DASHBOARD' ? (
                <div className="space-y-10 pb-20">
                  {/* Cabecera de Métricas Técnicas */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-[1px] border border-[var(--border)] bg-[var(--border)] rounded-lg overflow-hidden">
                    {/* Salud */}
                    <div className="bg-[var(--bg)] p-8 flex flex-col justify-between group hover:bg-[var(--surface)] transition-colors relative overflow-hidden md:col-span-2">
                      <div className="relative z-10">
                        <span className="eyebrow text-[var(--ink2)] mb-8 block">Salud Integral del Dataset</span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-7xl font-sans font-black tracking-tighter ${report.score >= 80 ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>
                            {report.score}
                          </span>
                          <span className="text-[var(--ink2)] font-serif italic text-sm">/ 100</span>
                        </div>
                        <ScoreBreakdown deductions={report.scoreBreakdown} />
                      </div>
                      <div className="absolute right-0 top-0 h-full w-1/3 opacity-[0.05] pointer-events-none p-4 mix-blend-multiply">
                        <ScoreGauge score={report.score} />
                      </div>
                    </div>

                    {/* Diseño */}
                    <div className="bg-[var(--bg)] p-8 flex flex-col justify-between group hover:bg-[var(--surface)] transition-colors">
                      <span className="eyebrow text-[var(--ink2)] mb-8">Estructura Dimensional</span>
                      <div className="space-y-2">
                        <p className="text-3xl font-sans font-black tracking-tight text-[var(--ink)]">{report.rowCount.toLocaleString()} <span className="text-[11px] font-serif text-[var(--ink2)] font-normal italic">filas</span></p>
                        <p className="text-3xl font-sans font-black tracking-tight text-[var(--ink)]">{report.colCount} <span className="text-[11px] font-serif text-[var(--ink2)] font-normal italic">columnas</span></p>
                      </div>
                    </div>

                    {/* Críticos */}
                    <div className="bg-[var(--bg)] p-8 flex flex-col justify-between group hover:bg-[var(--surface)] transition-colors">
                      <span className="eyebrow text-[var(--ink2)] mb-8">Alertas Detectadas</span>
                      <div className="flex items-baseline gap-4">
                        <span className="text-6xl font-sans font-black tracking-tighter text-[var(--ink)]">{report.issues.length}</span>
                        <div className="flex flex-col gap-1">
                          <span className={`w-3 h-3 rounded-sm ${report.issues.length > 0 ? 'bg-[var(--error)]' : 'bg-[var(--success)]'}`} />
                          <span className="text-[11px] font-serif italic text-[var(--ink2)]">{report.issues.length > 0 ? 'Requiere atención' : 'Limpio'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel de Perfiles Estructurales */}
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)]">
                      <h3 className="heading-md text-[var(--ink)]">Perfil de Columnas</h3>
                    </div>
                    <DataProfile stats={report.columnStats} issues={report.issues} />
                  </div>

                  {/* Log de Anomalías */}
                  {report.issues.length > 0 && (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)]">
                        <h3 className="heading-md text-[var(--ink)]">Registro de Anomalías</h3>
                      </div>
                      <div className="p-4 overflow-hidden bg-[var(--bg)]">
                        <IssueList issues={report.issues} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[calc(100vh-200px)] min-h-[600px] bg-[var(--bg)] animate-in slide-in-from-right duration-500 overflow-hidden border border-[var(--border)] rounded-lg shadow-sm">
                  <GeminiAdvisor analysis={aiAnalysis} isLoading={isAiLoading} />
                </div>
              )}

              <footer className="text-center py-10">
                <p className="text-[11px] font-serif italic text-[var(--ink-muted)]">
                  by <a href="https://casabero.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)] transition-colors">casabero.com</a>
                </p>
              </footer>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;