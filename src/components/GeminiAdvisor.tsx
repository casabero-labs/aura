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
    <div className="h-full flex flex-col bg-[var(--bg)]">
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface)]">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 border border-[var(--border-strong)] bg-[var(--surface-raised)] flex items-center justify-center rounded-sm transition-all ${isLoading ? 'animate-pulse' : ''}`}>
            <Cpu size={20} className="text-[var(--ink)]" />
          </div>
          <div>
            <h2 className="heading-md text-[var(--ink)] tracking-tight">Motor Cognitivo</h2>
            <p className="eyebrow text-[var(--ink2)] mt-1">Análisis Asistido por IA</p>
          </div>
        </div>
        {isLoading && <span className="text-[10px] text-[var(--ink-soft)] font-sans font-medium uppercase tracking-wider flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse" /> Procesando...</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-markdown select-text font-sans">
        {analysis ? (
          <div className="prose prose-sm max-w-none prose-p:text-[var(--ink2)] prose-p:leading-relaxed prose-headings:font-serif prose-headings:font-bold prose-headings:text-[var(--ink)] prose-strong:text-[var(--ink)] prose-code:bg-[var(--surface-raised)] prose-code:text-[var(--ink)] prose-code:font-mono prose-code:border prose-code:border-[var(--border)] prose-pre:p-0 prose-pre:bg-transparent">
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
                    <code className={`${className} px-1.5 py-0.5 rounded-sm`} {...props}>
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
          <div className="flex flex-col items-center justify-center h-full text-[var(--ink-muted)] gap-6 opacity-60 m-4">
            <Bot size={48} strokeWidth={1} />
            <p className="font-serif text-[15px] italic text-center px-12 leading-relaxed">Esperando inicialización del motor cognitivo para decodificar hallazgos...</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] text-[11px] text-[var(--ink2)] font-sans flex justify-between items-center group cursor-default">
        <span className="flex items-center gap-2 group-hover:text-[var(--ink)] transition-colors"><Bot size={14} className="text-[var(--ink)]" /> Análisis anclado a evidencia</span>
        <span className="italic opacity-80 font-serif text-[11px]">Impulsado por Casabero AI</span>
      </div>
    </div>
  );
};

export default GeminiAdvisor;
