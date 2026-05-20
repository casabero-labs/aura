import React, { useEffect, useRef, useState } from 'react';
import { Bot, Cpu, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ScriptReview from './ScriptReview';

interface GeminiAdvisorProps {
  analysis: string;
  isLoading: boolean;
  providerType: 'local' | 'cloud';
  model: string;
  onStop?: () => void;
}

const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ analysis, isLoading, providerType, model, onStop }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setCharCount(analysis.length);
  }, [analysis]);

  useEffect(() => {
    if (scrollRef.current && isLoading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [analysis, isLoading]);

  if (!analysis && !isLoading) return null;

  return (
    <div className="advisor-shell">
      <div className="advisor-header">
        <div className="advisor-header-left">
          <div className={`advisor-avatar ${isLoading ? 'advisor-avatar--pulse' : ''}`}>
            <Cpu size={20} />
          </div>
          <div>
            <h2 className="advisor-title">Diagnóstico generado</h2>
            <p className="advisor-subtitle">
              {providerType === 'local' ? 'WebGPU local' : 'Proveedor cloud'} · {model}
            </p>
          </div>
        </div>
        <div className="advisor-header-right">
          {isLoading && (
            <>
              <span className="advisor-status-badge">
                <div className="advisor-status-dot" />
                Ejecutando inferencia
              </span>
              {onStop && (
                <button className="advisor-stop-btn" onClick={onStop} title="Detener generación">
                  <Square size={10} /> Detener
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="advisor-content" ref={scrollRef}>
        {analysis ? (
          <div className="advisor-markdown custom-markdown">
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
                    <code className={`${className}`} style={{padding:'6px 6px', borderRadius:'var(--radius-xs)'}} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="advisor-placeholder">
            <Bot size={48} strokeWidth={1} />
            <p>Esperando el diagnóstico sobre los hallazgos deterministas.</p>
          </div>
        )}
      </div>

      <div className="advisor-footer">
        <span className="advisor-footer-left">
          <Bot size={14} /> Interpretación asistida, no evidencia primaria
        </span>
        <span className="advisor-footer-right">
          {charCount.toLocaleString('es-CO')} caracteres
        </span>
      </div>
    </div>
  );
};

export default GeminiAdvisor;
