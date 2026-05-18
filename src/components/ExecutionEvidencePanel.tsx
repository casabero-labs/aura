import { Activity, Database, Fingerprint, Timer } from 'lucide-react';
import { AuditExecutionEvidence } from '../types';

interface ExecutionEvidencePanelProps {
  evidence: AuditExecutionEvidence;
}

const ExecutionEvidencePanel = ({ evidence }: ExecutionEvidencePanelProps) => (
  <section className="execution-evidence" aria-label="Evidencia de ejecución determinista">
    <div className="execution-evidence-head">
      <div>
        <p className="sec-eye">evidencia operacional</p>
        <h3>Motor determinista ejecutado.</h3>
      </div>
      <code>{evidence.datasetFingerprint}</code>
    </div>

    <div className="execution-evidence-grid">
      <div><Timer size={14} /><span>parse</span><strong>{evidence.parseDurationMs}ms</strong></div>
      <div><Activity size={14} /><span>audit</span><strong>{evidence.auditDurationMs}ms</strong></div>
      <div><Database size={14} /><span>filas</span><strong>{evidence.rowsProcessed}</strong></div>
      <div><Fingerprint size={14} /><span>issues</span><strong>{evidence.issueCount}</strong></div>
    </div>

    <details className="execution-trace">
      <summary>Ver traza verificable</summary>
      <ol>
        {evidence.trace.map((event) => (
          <li key={`${event.stage}-${event.elapsedMs}`}>
            <span>{event.elapsedMs}ms</span>
            <strong>{event.stage}</strong>
            {event.details && <code>{JSON.stringify(event.details)}</code>}
          </li>
        ))}
      </ol>
    </details>
  </section>
);

export default ExecutionEvidencePanel;
