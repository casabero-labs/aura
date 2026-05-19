/**
 * DiagnosticTerminal — Bitácora completa rule-by-rule del auditEngine
 *
 * Muestra cada paso de auditoría como un log terminal visible.
 * Nada ocurre en background. Cada regla que se activa aparece aquí
 * con timestamp, regla activada, columna afectada, conteo y evidencia.
 *
 * Complementa el PipelineChecklist pero con formato de terminal
 * estilo `tail -f` más detallado y granular.
 */

import React from 'react';
import { Terminal, Activity, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { AuditReport, IssueSeverity } from '../types';

interface DiagnosticTerminalProps {
  report: AuditReport;
  auditDurationMs: number;
}

const severityIcon = (sev: IssueSeverity) => {
  switch (sev) {
    case IssueSeverity.CRITICAL: return <AlertCircle size={11} style={{ color: 'var(--error)' }} />;
    case IssueSeverity.WARNING: return <AlertTriangle size={11} style={{ color: 'var(--orange)' }} />;
    case IssueSeverity.INFO: return <Info size={11} style={{ color: 'var(--blue)' }} />;
    default: return <CheckCircle size={11} />;
  }
};

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const DiagnosticTerminal: React.FC<DiagnosticTerminalProps> = ({ report, auditDurationMs }) => {
  const { issues, scoreBreakdown } = report;
  const rowCount = report.rowCount;



  return (
    <div className="diag-terminal">
      <div className="diag-terminal-header">
        <div className="diag-terminal-title">
          <Terminal size={14} />
          <span>DIAGNÓSTICO RULE-BY-RULE — BITÁCORA COMPLETA</span>
        </div>
        <div className="diag-terminal-meta">
          <span><Activity size={10} /> auditoría: {formatTime(auditDurationMs)}</span>
          <span>{issues.length} reglas disparadas</span>
          <span>score: {scoreBreakdown.reduce((s, d) => s + d.points, 0)} pts deducidos</span>
        </div>
        <p className="diag-terminal-subtitle">
          Log completo de cada regla evaluada. Las reglas sin activación no aparecen aquí.
          Cada línea es una anomalía real detectada por el motor de la Capa 1.
        </p>
      </div>

      <div className="diag-terminal-log">
        {/* ── Header del log ── */}
        <div className="diag-log-header-row">
          <span className="diag-log-col">tiempo</span>
          <span className="diag-log-col">regla</span>
          <span className="diag-log-col">columna</span>
          <span className="diag-log-col">detalle</span>
        </div>

        {/* ── Score Deductions ── */}
        {scoreBreakdown.length > 0 && (
          <div className="diag-log-section">
            <div className="diag-log-section-label">DEDUCCIONES DE SCORE</div>
            {scoreBreakdown.map((d, idx) => (
              <div key={`ded-${idx}`} className="diag-log-row diag-log-row--deduction">
                <span className="diag-log-cell diag-log-cell--time">{auditDurationMs}ms</span>
                <span className="diag-log-cell diag-log-cell--rule">
                  <span className="diag-log-deduction-badge">{d.points} pts</span>
                  {d.reason}
                </span>
                <span className="diag-log-cell diag-log-cell--category">{d.category}</span>
                <span className="diag-log-cell diag-log-cell--detail">{d.reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Issues by Category ── */}
        {issues.length > 0 ? (
          issues.map((issue, idx) => (
            <div
              key={issue.id}
              className={`diag-log-row diag-log-row--issue diag-log-row--${issue.severity}`}
            >
              <span className="diag-log-cell diag-log-cell--time">
                {severityIcon(issue.severity)}
              </span>
              <span className="diag-log-cell diag-log-cell--rule">{issue.ruleName}</span>
              <span className="diag-log-cell diag-log-cell--column">
                {issue.column && <code>{issue.column}</code>}
              </span>
              <span className="diag-log-cell diag-log-cell--detail">
                <span className="diag-log-detail-main">{issue.description}</span>
                {issue.sampleValues && issue.sampleValues.length > 0 && (
                  <span className="diag-log-samples">
                    {issue.sampleValues.slice(0, 3).map((v, i) => (
                      <code key={i} className="diag-log-sample-chip">"{String(v).substring(0, 30)}"</code>
                    ))}
                  </span>
                )}
              </span>
            </div>
          ))
        ) : (
          <div className="diag-log-row diag-log-row--empty">
            <span className="diag-log-cell diag-log-cell--detail">
              <CheckCircle size={12} style={{ color: 'var(--success)' }} />
              Ninguna anomalía detectada — dataset limpio tras {formatTime(auditDurationMs)}
            </span>
          </div>
        )}

        {/* ── Footer: totales ── */}
        <div className="diag-log-footer">
          <span>
            {issues.filter(i => i.severity === IssueSeverity.CRITICAL).length} críticos ·
            {issues.filter(i => i.severity === IssueSeverity.WARNING).length} advertencias ·
            {issues.filter(i => i.severity === IssueSeverity.INFO).length} info ·
            {auditDurationMs}ms total
          </span>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticTerminal;