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
    <div className="my-6 border border-[var(--border-color)] bg-[var(--technical-bg)] shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header del Script */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-color)]">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--main-color)]" />
          <span className="text-[10px] font-mono font-bold text-[var(--main-color)] uppercase tracking-widest">
            {language} // Script de Limpieza (HITL)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-[var(--secondary-color)] hover:text-[var(--main-color)] hover:bg-[var(--technical-bg)] transition-all border border-transparent hover:border-[var(--border-color)]"
            title="Copiar al portapapeles"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            {copied ? 'COPIADO' : 'COPIAR'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest bg-[var(--main-color)] text-white hover:bg-[var(--accent-focus)] transition-all"
            title="Descargar script .py"
          >
            <Download size={12} />
            GUARDAR .PY
          </button>
        </div>
      </div>

      {/* Contenido del Código */}
      <div className="relative group">
        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-gray-300 bg-[#0d1117] m-0 !rounded-none">
          <code>{code}</code>
        </pre>
        {/* Marca de agua sutil */}
        <div className="absolute bottom-2 right-4 opacity-10 pointer-events-none flex items-center gap-2">
          <FileCode2 size={24} className="text-white" />
          <span className="font-display font-bold text-white uppercase tracking-widest">AURA GOVERNANCE</span>
        </div>
      </div>
    </div>
  );
};

export default ScriptReview;
