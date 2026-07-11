import React, { useState } from 'react';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';

interface ExecutionEvidencePanelProps {
  run: ExperimentRunV1;
  representative: boolean;
  busy: boolean;
  onDecision: (status: 'approved' | 'rejected') => Promise<void>;
  onImport: (file: File) => Promise<void>;
  canImport: boolean;
}

const ExecutionEvidencePanel: React.FC<ExecutionEvidencePanelProps> = ({
  run,
  representative,
  busy,
  onDecision,
  onImport,
  canImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const reaudit = run.execution?.reaudit;

  if (!representative) return null;

  return (
    <section className="oe4-panel" aria-labelledby="oe4-execution-title">
      <div className="oe4-panel-heading">
        <div><p className="oe4-eyebrow">Representante de celda</p><h2 id="oe4-execution-title">Decisión y ejecución externa</h2></div>
      </div>
      {run.status === 'reviewed' && (
        <div className="oe4-actions">
          <button type="button" className="btn-p" disabled={busy} onClick={() => void onDecision('approved')}>Aprobar representante</button>
          <button type="button" className="btn-s" disabled={busy} onClick={() => void onDecision('rejected')}>Rechazar representante</button>
        </div>
      )}
      {run.status === 'approved' && (
        <p className="oe4-info">Representante aprobado. Falta preparar y ejecutar externamente el notebook controlado.</p>
      )}
      {run.status === 'rejected' && <p className="oe4-info">Representante rechazado; la decisión permanece en la evidencia.</p>}
      {run.status === 'blocked' && <p className="oe4-blocker">La ejecución quedó bloqueada y no se sustituirá esta corrida.</p>}
      {run.status === 'awaiting_external_output' && (
        <div className="oe4-import-box">
          <label>
            <span>CSV resultante</span>
            <input aria-label="CSV resultante" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn-p" disabled={!file || busy || !canImport} onClick={() => file && void onImport(file)}>
            Importar y reauditar
          </button>
          {!canImport && <p className="oe4-blocker">La integración de importación no está disponible en este entorno.</p>}
        </div>
      )}
      {reaudit && (
        <div className="oe4-before-after">
          <span>Score antes/después</span>
          <strong>{reaudit.beforeScore} → {reaudit.afterScore}</strong>
          <small>{reaudit.outcome}</small>
        </div>
      )}
    </section>
  );
};

export default ExecutionEvidencePanel;
