import React, { useState } from 'react';
import { ClipboardList, Download, Trash2, ChevronDown, ChevronRight, X, Clock, Database, FileCode2 } from 'lucide-react';
import { getAuditLog, clearAuditLog, downloadAuditLog, getAuditStats, LlmAuditEntry } from '../services/llmAuditLog';
import SyntaxDisplay from './SyntaxDisplay';

const statusLabel: Record<LlmAuditEntry['status'], string> = {
  completed: 'Completado',
  error: 'Error',
  stopped: 'Detenido',
};

const statusColor: Record<LlmAuditEntry['status'], string> = {
  completed: 'var(--success)',
  error: 'var(--error)',
  stopped: 'var(--orange)',
};

interface AuditLogViewerProps {
  onClose: () => void;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<LlmAuditEntry[]>(getAuditLog());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const stats = getAuditStats();

  const handleClear = () => {
    if (confirm('¿Borrar todo el log de auditoría? Esta acción no se puede deshacer.')) {
      clearAuditLog();
      setEntries([]);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="audit-log-backdrop" onClick={handleBackdropClick}>
      <div className="audit-log-panel">
        <header className="audit-log-header">
          <div className="audit-log-title-block">
            <ClipboardList size={18} />
            <div>
              <h2>Log de auditoría LLM</h2>
              <p>Registro de todas las llamadas a modelos. Útil para evidencia académica.</p>
            </div>
          </div>
          <button className="audit-log-close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {/* Stats */}
        <div className="audit-log-stats">
          <div className="audit-stat">
            <span>Total llamadas</span>
            <strong>{stats.totalEntries}</strong>
          </div>
          <div className="audit-stat">
            <span>Latencia promedio</span>
            <strong>{stats.avgLatencyMs}ms</strong>
          </div>
          <div className="audit-stat">
            <span>Completadas</span>
            <strong>{stats.byStatus.completed || 0}</strong>
          </div>
          <div className="audit-stat">
            <span>Errores</span>
            <strong>{stats.byStatus.error || 0}</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="audit-log-actions">
          <button className="btn-s btn-sm" onClick={downloadAuditLog}>
            <Download size={12} /> Exportar JSON
          </button>
          <button className="btn-s btn-sm" onClick={handleClear} style={{ color: 'var(--error)' }}>
            <Trash2 size={12} /> Borrar log
          </button>
        </div>

        {/* Entries */}
        <div className="audit-log-entries">
          {entries.length === 0 && (
            <p className="audit-log-empty">Sin entradas. Ejecutá un diagnóstico para generar registros.</p>
          )}
          {entries.map(entry => (
            <div key={entry.id} className="audit-log-entry">
              <button
                className="audit-log-entry-header"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <span className="audit-chevron">
                  {expandedId === entry.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <span className="audit-entry-provider">
                  {entry.providerType === 'local' ? <Database size={10} /> : <CloudIcon size={10} />}
                  {entry.provider}
                </span>
                <span className="audit-entry-model">{entry.model}</span>
                <span className="audit-entry-status" style={{ color: statusColor[entry.status] }}>
                  {statusLabel[entry.status]}
                </span>
                <span className="audit-entry-latency">{entry.latencyMs}ms</span>
                <span className="audit-entry-time">
                  {new Date(entry.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </button>

              {expandedId === entry.id && (
                <div className="audit-log-entry-body">
                  <div className="audit-detail-grid">
                    <div className="audit-detail-row">
                      <span>ID</span>
                      <code>{entry.id}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Timestamp</span>
                      <code>{entry.timestamp}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Tipo</span>
                      <code>{entry.callType}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Proveedor</span>
                      <code>{entry.providerType} ({entry.provider})</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Modelo</span>
                      <code>{entry.model}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Temperatura</span>
                      <code>{entry.temperature}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Dataset fingerprint</span>
                      <code>{entry.datasetFingerprint || '-'}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Filas · Columnas</span>
                      <code>{entry.rowCount} · {entry.colCount}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Columnas en input</span>
                      <code>{entry.inputColumnCount}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Issues en input</span>
                      <code>{entry.inputIssueCount}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Prompt hash</span>
                      <code>{entry.promptHash}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Input JSON hash</span>
                      <code>{entry.inputJsonHash}</code>
                    </div>
                    <div className="audit-detail-row audit-detail-row--prompt">
                      <span>Prompt enviado al modelo</span>
                      <SyntaxDisplay filename="llm-call.prompt.txt" content={entry.promptText} maxHeight={320} />
                    </div>
                    <div className="audit-detail-row">
                      <span>Prompt length</span>
                      <code>{entry.promptLength.toLocaleString('es-CO')} chars</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Response length</span>
                      <code>{entry.responseLength.toLocaleString('es-CO')} chars</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Tokens generados</span>
                      <code>{entry.tokensGenerated}</code>
                    </div>
                    <div className="audit-detail-row">
                      <span>Latencia</span>
                      <code>{entry.latencyMs}ms</code>
                    </div>
                    {entry.error && (
                      <div className="audit-detail-row audit-detail-row--error">
                        <span>Error</span>
                        <code>{entry.error}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CloudIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

export default AuditLogViewer;
