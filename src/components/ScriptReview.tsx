import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, Copy, Download, Edit3, Eye, FileCode2, Search, Terminal } from 'lucide-react';
import { AuditReport } from '../types';
import { highlightPython } from '../services/highlightPython';

interface ScriptReviewProps {
  code: string;
  language?: string;
  report?: AuditReport;
  onApprove?: (code: string) => void;
  onDraftChange?: () => void;
  approvedCode?: string;
}

type OperationKind = 'destructiva' | 'transformacion' | 'lectura';

const classifyOperation = (line: string): OperationKind | null => {
  const normalized = line.toLowerCase();
  if (/\b(drop|delete|del |remove|pop|truncate|overwrite|to_csv|to_excel)\b/.test(normalized)) return 'destructiva';
  if (/\b(fillna|replace|astype|rename|assign|map|apply|clip|str\.|where|loc\[|iloc\[)\b/.test(normalized)) return 'transformacion';
  if (/\b(value_counts|describe|isna|isnull|info|head|tail|shape|columns|dtypes|unique|nunique)\b/.test(normalized)) return 'lectura';
  return null;
};

const operationMeta: Record<OperationKind, { label: string; className: string }> = {
  destructiva: { label: 'destructiva', className: 'op-danger' },
  transformacion: { label: 'transformación', className: 'op-transform' },
  lectura: { label: 'lectura', className: 'op-read' },
};

const ScriptReview: React.FC<ScriptReviewProps> = ({
  code,
  language = 'python',
  report,
  onApprove,
  onDraftChange,
  approvedCode,
}) => {
  const [copied, setCopied] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedCode(code);
    setHasReviewed(false);
    setIsEditing(false);
  }, [code]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (node.scrollHeight <= node.clientHeight + 4) setHasReviewed(true);
  }, [editedCode, isEditing]);

  const lines = useMemo(() => editedCode.split('\n'), [editedCode]);
  const operations = useMemo(() => lines.map((line) => classifyOperation(line)), [lines]);
  const operationCounts = useMemo(() => operations.reduce((acc, kind) => {
    if (kind) acc[kind] += 1;
    return acc;
  }, { destructiva: 0, transformacion: 0, lectura: 0 } as Record<OperationKind, number>), [operations]);

  const affectedColumns = useMemo(() => {
    if (!report) return 0;
    return new Set(report.issues.map((issue) => issue.column).filter(Boolean)).size;
  }, [report]);

  const affectedRows = useMemo(() => {
    if (!report) return 0;
    const issueCounts = report.issues.map((issue) => issue.count).filter((count) => Number.isFinite(count));
    return Math.max(0, ...issueCounts, 0);
  }, [report]);

  const isApproved = approvedCode === editedCode && !!approvedCode;

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const reachedEnd = node.scrollTop + node.clientHeight >= node.scrollHeight - 12;
    if (reachedEnd) setHasReviewed(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([editedCode], { type: 'text/plain;charset=utf-8' });
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
    <div className="script-review">
      <div className="script-review-header">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--ink)]" />
          <span className="eyebrow text-[var(--ink)]">
            {language} - Gobernanza (HITL)
          </span>
        </div>
        <div className="script-actions">
          <button
            onClick={() => setIsEditing((value) => !value)}
            className="cs-button flex items-center gap-1.5 !min-h-8 !px-3 !py-1.5 !text-[10px]"
            title="Editar script antes de aprobar"
          >
            <Edit3 size={12} />
            {isEditing ? 'Ver código' : 'Editar'}
          </button>
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

      <div className="script-review-meta">
        <span><Eye size={12} /> Revisión humana requerida</span>
        <span>afecta {affectedColumns || '-'} columnas y {affectedRows || '-'} filas</span>
        {(['destructiva', 'transformacion', 'lectura'] as OperationKind[]).map((kind) => (
          <span key={kind} className={`operation-pill ${operationMeta[kind].className}`}>
            {operationCounts[kind]} {operationMeta[kind].label}
          </span>
        ))}
      </div>

      <div className="script-governance-note">
        <AlertTriangle size={14} />
        <p>El script no se ejecuta en AURA. Primero debes revisar todo el código, editarlo si hace falta y aprobarlo explícitamente.</p>
      </div>

      <div className="script-code-shell">
        {isEditing ? (
          <textarea
            className="script-editor"
            value={editedCode}
            onChange={(event) => {
              setEditedCode(event.target.value);
              setHasReviewed(false);
              onDraftChange?.();
            }}
            spellCheck={false}
            aria-label="Editar script Python"
          />
        ) : (
          <div className="script-scroll custom-scrollbar" ref={scrollRef} onScroll={handleScroll}>
            <pre className="script-code">
              {lines.map((line, index) => {
                const kind = operations[index];
                return (
                  <span key={`${index}-${line}`} className="script-line">
                    <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                    {kind && <span className={`line-op ${operationMeta[kind].className}`}>{operationMeta[kind].label}</span>}
                    <code dangerouslySetInnerHTML={{ __html: highlightPython(line) || ' ' }} />
                  </span>
                );
              })}
            </pre>
          </div>
        )}
        <div className="absolute bottom-2 right-4 opacity-[0.03] pointer-events-none flex items-center gap-2">
          <FileCode2 size={24} className="text-[var(--ink)]" />
          <span className="font-serif font-black text-[var(--ink)] uppercase tracking-widest text-xl">AURA GOVERNANCE</span>
        </div>
      </div>

      <div className="script-approval">
        <span className={hasReviewed ? 'approval-ready' : 'approval-blocked'}>
          {hasReviewed ? <Check size={13} /> : <Search size={13} />}
          {hasReviewed ? 'Código revisado completo' : 'Revisa hasta el final para habilitar aprobación'}
        </span>
        <button
          className="btn-p"
          disabled={!hasReviewed || !editedCode.trim() || isApproved}
          onClick={() => onApprove?.(editedCode)}
        >
          <ClipboardCheck size={14} />
          {isApproved ? 'Script aprobado' : 'Aprobar script'}
        </button>
      </div>
    </div>
  );
};

export default ScriptReview;
