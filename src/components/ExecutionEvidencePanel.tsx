import { Activity, Database, Fingerprint, Timer } from 'lucide-react';
import { AuditExecutionEvidence, ExecutionTraceEvent } from '../types';

interface ExecutionEvidencePanelProps {
  evidence: AuditExecutionEvidence;
}

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString('es-CO', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const detailsLabel = (event: ExecutionTraceEvent) => {
  if (!event.details) return '';
  return Object.entries(event.details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' · ');
};

const ExecutionEvidencePanel = ({ evidence }: ExecutionEvidencePanelProps) => (
  <section className="execution-evidence" aria-label="Ejecucion en vivo del motor determinista">
    <div className="execution-evidence-head">
      <div>
        <p className="sec-eye">ejecucion en vivo</p>
        <h3>Proceso determinista observado de inicio a fin.</h3>
      </div>
      <code>{evidence.datasetFingerprint}</code>
    </div>

    <div className="execution-evidence-grid">
      <div><Timer size={14} /><span>parse</span><strong>{evidence.parseDurationMs}ms</strong></div>
      <div><Activity size={14} /><span>audit</span><strong>{evidence.auditDurationMs}ms</strong></div>
      <div><Database size={14} /><span>filas</span><strong>{evidence.rowsProcessed}</strong></div>
      <div><Fingerprint size={14} /><span>issues</span><strong>{evidence.issueCount}</strong></div>
    </div>

    <div className="live-trace-panel live-trace-panel-tight" aria-label="Log visible del motor determinista">
      <div className="live-trace-head">
        <span>tail -f aura.audit.log</span>
        <code>{evidence.completedAt ? 'closed' : 'running'}</code>
      </div>
      <div className="terminal-log" role="log" aria-live="polite">
        {evidence.trace.map((event) => (
          <div className="terminal-log-row" key={`${event.stage}-${event.elapsedMs}`}>
            <span className="terminal-log-time">{timeLabel(event.timestamp)}</span>
            <strong className="terminal-log-stage">{event.stage}</strong>
            <span className="terminal-log-elapsed">{event.elapsedMs}ms</span>
            <code className="terminal-log-meta">{detailsLabel(event) || 'ok'}</code>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ExecutionEvidencePanel;
