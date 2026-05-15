import React, { useEffect, useRef } from 'react';
import { Bot, Terminal, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ScriptReview from './ScriptReview';

interface GeminiAdvisorProps {
  analysis: string;
  isLoading: boolean;
}

const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ analysis, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysis]);

  if (!analysis && !isLoading) return null;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-color)]">
      <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--technical-bg)]/50">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 border border-[var(--main-color)] flex items-center justify-center transition-all ${isLoading ? 'animate-spin border-dashed' : ''}`}>
            <Cpu size={20} className="text-[var(--main-color)]" />
          </div>
          <div>
            <h2 className="font-display font-bold text-[var(--main-color)] uppercase tracking-tight">CAPA_COGNITIVA</h2>
            <p className="text-[9px] text-[var(--secondary-color)] font-mono font-bold uppercase tracking-[0.3em]">ID_EJECUCIÓN: {Math.random().toString(36).substring(7).toUpperCase()}</p>
          </div>
        </div>
        {isLoading && <span className="text-[9px] text-[var(--main-color)] animate-pulse font-mono font-bold uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[var(--main-color)] rounded-full animate-pulse" /> procesando_stream...</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-markdown select-text font-sans">
        {analysis ? (
          <div className="prose prose-sm max-w-none prose-p:text-[var(--text-main)] prose-headings:font-display prose-headings:font-bold prose-headings:text-[var(--main-color)] prose-headings:uppercase prose-headings:tracking-tight prose-strong:text-[var(--main-color)] prose-code:bg-[var(--technical-bg)] prose-code:text-[var(--main-color)] prose-code:font-mono prose-pre:p-0 prose-pre:bg-transparent">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeString = String(children).replace(/\n$/, '');
                  
                  if (!inline && language) {
                    return <ScriptReview code={codeString} language={language} />;
                  }
                  
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {analysis}
            </ReactMarkdown>
            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--secondary-color)] gap-6 opacity-20 border-2 border-dashed border-[var(--border-color)] m-4">
            <Terminal size={48} strokeWidth={1} />
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] font-medium text-center px-12 leading-relaxed">Inicie el Núcleo de IA para decodificar hallazgos de integridad y patrones neuronales...</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--technical-bg)] text-[9px] text-[var(--secondary-color)] font-mono font-bold uppercase tracking-widest flex justify-between items-center group cursor-default">
        <span className="flex items-center gap-2 group-hover:text-[var(--main-color)] transition-colors"><Bot size={14} className="text-[var(--main-color)]" /> Modelo_Neural_Activo</span>
        <span className="italic opacity-50 font-sans tracking-normal">./impulsado_por_gemini_2.0</span>
      </div>
    </div>
  );
};

export default GeminiAdvisor;