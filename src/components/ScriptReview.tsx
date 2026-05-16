import React, { useState } from 'react';
import { Terminal, Copy, Download, Check, FileCode2 } from 'lucide-react';

interface ScriptReviewProps {
  code: string;
  language?: string;
}

const ScriptReview: React.FC<ScriptReviewProps> = ({ code, language = 'python' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `limpieza_dataset_${new Date().getTime()}.py`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-6 border border-[var(--border-strong)] bg-[var(--surface)] rounded-sm overflow-hidden">
      {/* Header del Script */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-raised)]">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--ink)]" />
          <span className="eyebrow text-[var(--ink)]">
            {language} - Gobernanza (HITL)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="cs-button flex items-center gap-1.5 !min-h-8 !px-3 !py-1.5 !text-[10px]"
            title="Copiar al portapapeles"
          >
            {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={handleDownload}
            className="cs-button cs-button-primary flex items-center gap-1.5 !min-h-8 !px-3 !py-1.5 !text-[10px]"
            title="Descargar script .py"
          >
            <Download size={12} />
            Guardar .py
          </button>
        </div>
      </div>

      {/* Contenido del Código */}
      <div className="relative group bg-[var(--bg)] p-4">
        <pre className="overflow-x-auto text-[12px] font-mono text-[var(--ink2)] m-0 leading-relaxed custom-scrollbar">
          <code>{code}</code>
        </pre>
        {/* Marca de agua sutil */}
        <div className="absolute bottom-2 right-4 opacity-[0.03] pointer-events-none flex items-center gap-2">
          <FileCode2 size={24} className="text-[var(--ink)]" />
          <span className="font-serif font-black text-[var(--ink)] uppercase tracking-widest text-xl">AURA GOVERNANCE</span>
        </div>
      </div>
    </div>
  );
};

export default ScriptReview;
