import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ScoreGauge from './components/ScoreGauge';
import IssueList from './components/IssueList';
import GeminiAdvisor from './components/GeminiAdvisor';
import DataProfile from './components/DataProfile';
import SettingsPanel from './components/SettingsPanel';
import AuraLogo from './components/AuraLogo';
import { parseCsv } from './services/csvService';
import { runAudit } from './services/auditEngine';
import { getGeminiAnalysisStream, generateExecutiveReport } from './services/geminiService';
import { generatePdfReport } from './services/pdfGenerator';
import ScoreBreakdown from './components/ScoreBreakdown';
import { AuditReport, AIConfig } from './types';
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
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('aura_ai_config');
    return saved ? JSON.parse(saved) : {
      apiKey: '',
      model: 'gemini-2.0-flash',
      autoAnalyze: true
    };
  });

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
    if (!aiConfig.apiKey && !(import.meta as any).env.VITE_GEMINI_API_KEY) {
      alert("Por favor, configura tu API Key en los ajustes para usar la IA.");
      setShowSettings(true);
      return;
    }
    setIsAiLoading(true);
    setAiAnalysis('');
    try {
      await getGeminiAnalysisStream(currentReport, aiConfig, (chunk) => {
        setAiAnalysis(prev => prev + chunk);
      });
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
      const executiveContent = await generateExecutiveReport(report, aiConfig);
      generatePdfReport(report, executiveContent);
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
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
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[var(--bg-color)] selection:bg-[var(--accent-focus)] selection:text-white">

      {showSettings && (
        <SettingsPanel
          config={aiConfig}
          onSave={setAiConfig}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Panel Orquestador Principal */}
      <div className={`flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-700 scroll-smooth`}>
        <header className="px-8 py-6 border-b border-[var(--border-color)] bg-[var(--bg-color)]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <AuraLogo />
            <div className="pt-1">
              <h1 className="text-2xl font-display font-bold text-[var(--main-color)] tracking-tighter">AURA</h1>
              <p className="text-[10px] text-[var(--secondary-color)] font-mono uppercase tracking-[0.3em] font-medium">Auditoría Técnica de Datos // v1.0.4</p>
            </div>
          </div>

          {report && (
            <nav className="flex items-center bg-[var(--technical-bg)] border border-[var(--border-color)] p-1">
              <button
                onClick={() => setActiveTab('DASHBOARD')}
                className={`flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${activeTab === 'DASHBOARD' ? 'bg-[var(--main-color)] text-white' : 'text-[var(--secondary-color)] hover:text-[var(--main-color)]'}`}
              >
                <BarChart3 size={14} /> ./dashboard
              </button>
              <button
                onClick={() => setActiveTab('IA')}
                className={`flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${activeTab === 'IA' ? 'bg-[var(--main-color)] text-white' : 'text-[var(--secondary-color)] hover:text-[var(--main-color)]'}`}
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
                  className="p-2 text-[var(--secondary-color)] hover:text-red-500 transition-colors rounded border border-[var(--border-color)] bg-[var(--technical-bg)]"
                  title="Reiniciar Auditoría"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                  className="flex items-center gap-2 px-6 py-2 text-xs font-display font-bold bg-[var(--main-color)] text-white hover:bg-[var(--accent-focus)] transition-all disabled:opacity-50"
                >
                  {isPdfGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  EXPORTAR_REPORTE
                </button>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-[var(--secondary-color)] hover:text-[var(--main-color)] transition-colors rounded border border-transparent hover:border-[var(--border-color)]"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 relative">
          {!report ? (
            <div className="h-full flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-1000">
              <div className="text-center max-w-xl space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--technical-bg)] border border-[var(--border-color)] text-[var(--secondary-color)] text-[10px] font-mono rounded-full animate-in slide-in-from-top-4 duration-500">
                  <Shield size={10} /> ENTORNO SEGURO // EJECUCIÓN_LOCAL
                </div>
                <div className="relative inline-block">
                  <h2 className="text-5xl font-display font-bold text-[var(--main-color)] tracking-tight leading-none cursor-default">
                    AURA: Diagnóstico Integral del Dataset
                  </h2>
                </div>
                <p className="text-[var(--secondary-color)] font-sans text-lg font-light leading-relaxed">
                  Analítica de precisión para la integridad estructural y validez de sus datos.
                </p>
              </div>

              <FileUpload onFileSelect={processFile} />

              <div className="mt-20 grid grid-cols-3 gap-10 max-w-3xl opacity-40 text-[var(--main-color)] border-t border-[var(--border-color)] pt-12">
                <div className="text-center space-y-2">
                  <p className="font-bold font-display text-xl">20+</p>
                  <p className="text-[9px] font-mono uppercase tracking-widest font-black">REGLAS_LÓGICAS</p>
                </div>
                <div className="text-center space-y-2 border-x border-[var(--border-color)] px-10">
                  <p className="font-bold font-display text-xl">100%</p>
                  <p className="text-[9px] font-mono uppercase tracking-widest font-black">PRIVACIDAD_LOCAL</p>
                </div>
                <div className="text-center space-y-2">
                  <p className="font-bold font-display text-xl">DEEP</p>
                  <p className="text-[9px] font-mono uppercase tracking-widest font-black">ANÁLISIS_NODOS</p>
                </div>
              </div>

              <footer className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-[10px] font-mono text-[var(--secondary-color)] opacity-50 uppercase tracking-[0.2em]">
                  by <a href="https://casabero.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--main-color)] transition-colors">casabero.com</a>
                </p>
              </footer>
            </div>
          ) : (
            <div className="animate-in fade-in duration-700">
              {activeTab === 'DASHBOARD' ? (
                <div className="space-y-10 pb-20">
                  {/* Cabecera de Métricas Técnicas */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-[1px] border border-[var(--border-color)] bg-[var(--border-color)] shadow-sm">
                    {/* Salud */}
                    <div className="bg-[var(--bg-color)] p-8 flex flex-col justify-between group hover:bg-[var(--technical-bg)] transition-colors relative overflow-hidden md:col-span-2">
                      <div className="relative z-10">
                        <span className="text-[10px] font-mono font-bold text-[var(--secondary-color)] uppercase tracking-widest mb-8 block">Salud_Integral_Dataset</span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-7xl font-display font-bold ${report.score >= 80 ? 'text-[var(--main-color)]' : 'text-[var(--secondary-color)]'}`}>
                            {report.score}
                          </span>
                          <span className="text-[var(--secondary-color)] font-mono text-sm">/ 100</span>
                        </div>
                        <ScoreBreakdown deductions={report.scoreBreakdown} />
                      </div>
                      <div className="absolute right-0 top-0 h-full w-1/3 opacity-[0.05] pointer-events-none p-4">
                        <ScoreGauge score={report.score} />
                      </div>
                    </div>

                    {/* Diseño */}
                    <div className="bg-[var(--bg-color)] p-8 flex flex-col justify-between group hover:bg-[var(--technical-bg)] transition-colors">
                      <span className="text-[10px] font-mono font-bold text-[var(--secondary-color)] uppercase tracking-widest mb-8">Diseño_Dataset</span>
                      <div className="space-y-1">
                        <p className="text-2xl font-display font-bold text-[var(--main-color)]">{report.rowCount.toLocaleString()} <span className="text-[10px] font-mono text-[var(--secondary-color)] font-normal uppercase italic">registros</span></p>
                        <p className="text-xl font-display font-bold text-[var(--main-color)]">{report.colCount} <span className="text-[10px] font-mono text-[var(--secondary-color)] font-normal uppercase italic">dimensiones</span></p>
                      </div>
                    </div>

                    {/* Críticos */}
                    <div className="bg-[var(--bg-color)] p-8 flex flex-col justify-between group hover:bg-[var(--technical-bg)] transition-colors">
                      <span className="text-[10px] font-mono font-bold text-[var(--secondary-color)] uppercase tracking-widest mb-8">Errores_Lógicos</span>
                      <div className="flex items-baseline gap-4">
                        <span className="text-6xl font-display font-bold text-[var(--main-color)]">{report.issues.length}</span>
                        <div className="flex flex-col gap-1">
                          <span className={`w-3 h-3 ${report.issues.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-green-600'}`} />
                          <span className="text-[9px] font-mono font-bold text-[var(--secondary-color)] uppercase">Alertas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel de Perfiles Estructurales */}
                  <div className="bg-[var(--bg-color)] border border-[var(--border-color)] shadow-sm">
                    <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--technical-bg)] flex items-center justify-between">
                      <h3 className="font-mono text-[10px] font-bold text-[var(--main-color)] uppercase tracking-[0.2em]">./estructura_del_dataset</h3>
                    </div>
                    <DataProfile stats={report.columnStats} issues={report.issues} />
                  </div>

                  {/* Log de Anomalías */}
                  {report.issues.length > 0 && (
                    <div className="bg-[var(--bg-color)] border border-[var(--border-color)] shadow-sm">
                      <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--technical-bg)]">
                        <h3 className="font-mono text-[10px] font-bold text-[var(--main-color)] uppercase tracking-[0.2em]">./log_reporte_anomalias</h3>
                      </div>
                      <div className="p-2 bg-[var(--technical-bg)]/20 overflow-hidden">
                        <IssueList issues={report.issues} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[calc(100vh-200px)] min-h-[600px] bg-[var(--bg-color)] animate-in slide-in-from-right duration-500 overflow-hidden border border-[var(--border-color)]">
                  <GeminiAdvisor analysis={aiAnalysis} isLoading={isAiLoading} />
                </div>
              )}

              <footer className="text-center py-10">
                <p className="text-[10px] font-mono text-[var(--secondary-color)] opacity-50 uppercase tracking-[0.2em]">
                  by <a href="https://casabero.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--main-color)] transition-colors">casabero.com</a>
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