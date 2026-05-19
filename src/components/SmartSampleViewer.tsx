/**
 * SmartSampleViewer — JSON completo enviado al LLM
 *
 * Muestra el Smart Sample (buildSmartSample) como JSON real
 * que se inyecta en la Capa 2 (OE2).
 *
 * El usuario VE exactamente qué datos recibe el LLM.
 * Esto es transparencia total de la Capa 1 → Capa 2.
 *
 * Incluye:
 * - JSON formateado con syntax highlighting
 * - Secciones colapsables por sección del JSON
 * - Conteo de tokens aproximado
 * - Indicador de qué columnas son "feas" para el LLM
 */

import React, { useState } from 'react';
import { FileCode2, ChevronDown, ChevronRight, Copy, CheckCheck } from 'lucide-react';
import { AuditReport } from '../types';
import { buildSmartSample } from '../services/providers/prompts';

interface SmartSampleViewerProps {
  report: AuditReport;
}

const COUNT_TOKENS_APPROX = (text: string): number => {
  return Math.ceil(text.length / 4);
};

const JsonKey: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="json-key">{children}</span>
);
const JsonStr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="json-str">{children}</span>
);
const JsonNum: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="json-num">{children}</span>
);
const JsonBool: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="json-bool">{children}</span>
);
const JsonNull: React.FC = () => <span className="json-null">null</span>;
const JsonBrace: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="json-brace">{children}</span>
);
const JsonBracket: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="json-bracket">{children}</span>
);

interface JsonSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const JsonSection: React.FC<JsonSectionProps> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="json-section">
      <button className="json-section-toggle" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>{title}</span>
      </button>
      {open && <div className="json-section-content">{children}</div>}
    </div>
  );
};

const SmartSampleViewer: React.FC<SmartSampleViewerProps> = ({ report }) => {
  const [copied, setCopied] = useState(false);
  const sample = buildSmartSample(report);
  const jsonString = JSON.stringify(sample, null, 2);
  const tokenEstimate = COUNT_TOKENS_APPROX(jsonString);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const ctx = sample.context;
  const cols = sample.columns;
  const issues = sample.detected_issues;

  return (
    <div className="smart-sample-viewer">
      <div className="smart-sample-header">
        <div className="smart-sample-title">
          <FileCode2 size={14} />
          <span>SMART SAMPLE — JSON EXACTO ENVIADO A CAPA 2 (LLM)</span>
        </div>
        <div className="smart-sample-meta">
          <span className="smart-sample-meta-chip">
            ~{tokenEstimate.toLocaleString('es-CO')} tokens estimados
          </span>
          <span className="smart-sample-meta-chip">
            {jsonString.length.toLocaleString('es-CO')} caracteres
          </span>
          <button className="smart-sample-copy-btn" onClick={handleCopy} title="Copiar JSON">
            {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
            {copied ? 'copiado' : 'copiar'}
          </button>
        </div>
        <p className="smart-sample-subtitle">
          Este es el JSON real que recibe el LLM en la Capa 2. Cada campo es determinado
          por el motor de la Capa 1. Sin truncamiento, sin interpretaciones externas.
        </p>
      </div>

      <div className="smart-sample-body">
        {/* ── Context ── */}
        <JsonSection title={`▸ context — ${Object.keys(ctx).length} campos`} defaultOpen={false}>
          <div className="json-kv">
            <span className="json-line"><JsonKey>total_rows</JsonKey>: <JsonNum>{ctx.total_rows}</JsonNum>,</span>
            <span className="json-line"><JsonKey>total_columns</JsonKey>: <JsonNum>{ctx.total_columns}</JsonNum>,</span>
            <span className="json-line"><JsonKey>detected_delimiter</JsonKey>: <JsonStr>"{ctx.detected_delimiter}"</JsonStr>,</span>
            <span className="json-line"><JsonKey>quality_score</JsonKey>: <JsonNum>{ctx.quality_score}</JsonNum></span>
          </div>
        </JsonSection>

        {/* ── Columns ── */}
        <JsonSection title={`▸ columns — ${cols.length} columnas (cada una con tipo, nulos, únicos, top_values, sample_values)`} defaultOpen={false}>
          <div className="json-array">
            {cols.map((col, idx) => (
              <div key={idx} className="json-object-entry">
                <span className="json-line">
                  <JsonBrace>{'{'}</JsonBrace>
                </span>
                <div className="json-object-props">
                  <span className="json-line"><JsonKey>name</JsonKey>: <JsonStr>"{col.name}"</JsonStr>,</span>
                  <span className="json-line"><JsonKey>type</JsonKey>: <JsonStr>"{col.type}"</JsonStr>,</span>
                  <span className="json-line"><JsonKey>nulls</JsonKey>: <JsonNum>{col.nulls}</JsonNum>,</span>
                  <span className="json-line"><JsonKey>unique</JsonKey>: <JsonNum>{col.unique}</JsonNum>,</span>
                  <span className="json-line">
                    <JsonKey>top_values</JsonKey>: <JsonBracket>[</JsonBracket>
                    {col.top_values && col.top_values.length > 0 ? col.top_values.map((v, i) => (
                      <span key={i}><JsonStr>"{v}"</JsonStr>{i < col.top_values!.length - 1 ? ', ' : ''}</span>
                    )) : <JsonNull />}
                    <JsonBracket>]</JsonBracket>,
                  </span>
                  <span className="json-line">
                    <JsonKey>sample_values</JsonKey>: <JsonBracket>[</JsonBracket>
                    {col.sample_values && col.sample_values.length > 0 ? col.sample_values.map((v, i) => (
                      <span key={i}><JsonStr>"{String(v).substring(0, 60)}{String(v).length > 60 ? '…' : ''}"</JsonStr>{i < col.sample_values!.length - 1 ? ', ' : ''}</span>
                    )) : <JsonNull />}
                    <JsonBracket>]</JsonBracket>
                  </span>
                </div>
                <span className="json-line"><JsonBrace>{'}'}</JsonBrace>{idx < cols.length - 1 ? ',' : ''}</span>
              </div>
            ))}
          </div>
        </JsonSection>

        {/* ── Detected Issues ── */}
        <JsonSection title={`▸ detected_issues — ${issues.length} reglas activadas`} defaultOpen={false}>
          {issues.length === 0 ? (
            <div className="json-kv">
              <span className="json-line"><JsonStr>"Sin anomalías detectadas"</JsonStr></span>
            </div>
          ) : (
            <div className="json-array">
              {issues.map((issue, idx) => (
                <div key={idx} className="json-object-entry">
                  <span className="json-line">
                    <JsonBrace>{'{'}</JsonBrace>
                  </span>
                  <div className="json-object-props">
                    <span className="json-line"><JsonKey>rule</JsonKey>: <JsonStr>"{issue.rule}"</JsonStr>,</span>
                    <span className="json-line"><JsonKey>category</JsonKey>: <JsonStr>"{issue.category}"</JsonStr>,</span>
                    {issue.column && <span className="json-line"><JsonKey>column</JsonKey>: <JsonStr>"{issue.column}"</JsonStr>,</span>}
                    <span className="json-line"><JsonKey>details</JsonKey>: <JsonStr>"{issue.details.substring(0, 100)}{issue.details.length > 100 ? '…' : ''}"</JsonStr>,</span>
                    <span className="json-line">
                      <JsonKey>bad_samples</JsonKey>: <JsonBracket>[</JsonBracket>
                      {issue.bad_samples && issue.bad_samples.length > 0 ? issue.bad_samples.map((v, i) => (
                        <span key={i}><JsonStr>"{String(v).substring(0, 60)}{String(v).length > 60 ? '…' : ''}"</JsonStr>{i < issue.bad_samples!.length - 1 ? ', ' : ''}</span>
                      )) : <JsonStr>""</JsonStr>}
                      <JsonBracket>]</JsonBracket>
                    </span>
                  </div>
                  <span className="json-line"><JsonBrace>{'}'}</JsonBrace>{idx < issues.length - 1 ? ',' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </JsonSection>

        {/* ── Raw JSON ── */}
        <JsonSection title="▸ JSON completo — raw (para debugging)">
          <pre className="smart-sample-raw">{jsonString}</pre>
        </JsonSection>
      </div>
    </div>
  );
};

export default SmartSampleViewer;