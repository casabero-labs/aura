import React, { useState } from 'react';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';

interface ExecutionEvidencePanelProps {
  run: ExperimentRunV1;
  representative: boolean;
  busy: boolean;
  onDecision: (status: 'approved' | 'rejected') => Promise<void>;
  onPrepare: () => Promise<void>;
  onDownloadBundle: () => void;
  onImport: (csvFile: File, receiptFile: File) => Promise<void>;
  canPrepare: boolean;
  canImport: boolean;
}

const ExecutionEvidencePanel: React.FC<ExecutionEvidencePanelProps> = ({
  run,
  representative,
  busy,
  onDecision,
  onPrepare,
  onDownloadBundle,
  onImport,
  canPrepare,
  canImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
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
        <div>
          <p className="oe4-info">Representante aprobado. Falta preparar y ejecutar externamente el notebook controlado.</p>
          <button type="button" className="btn-p" disabled={busy || !canPrepare} onClick={() => void onPrepare()}>
            Preparar ejecución externa
          </button>
          {!canPrepare && <p className="oe4-blocker">La preparación externa no está disponible hasta completar el preflight formal.</p>}
        </div>
      )}
      {run.status === 'rejected' && <p className="oe4-info">Representante rechazado; la decisión permanece en la evidencia.</p>}
      {run.status === 'blocked' && <p className="oe4-blocker">La ejecución quedó bloqueada y no se sustituirá esta corrida.</p>}
      {run.status === 'awaiting_external_output' && (
        <div className="oe4-import-box">
          <p className="oe4-info">Descarga el bundle, ejecútalo localmente y vuelve con el CSV y su recibo JSON. Ambos deben coincidir por SHA-256.</p>
          <button type="button" className="btn-s" disabled={busy} onClick={onDownloadBundle}>
            Descargar bundle Python
          </button>
          <code>npm run oe4:python:run -- --bundle bundle.json --input controlled_customers_phase8.csv --output result.csv --receipt receipt.json</code>
          <label>
            <span>CSV resultante</span>
            <input aria-label="CSV resultante" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <label>
            <span>Recibo de ejecución JSON</span>
            <input aria-label="Recibo de ejecución JSON" type="file" accept=".json,application/json" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn-p" disabled={!file || !receiptFile || busy || !canImport} onClick={() => file && receiptFile && void onImport(file, receiptFile)}>
            Verificar, importar y reauditar
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
      {run.execution?.pythonReceipt && (
        <div className="oe4-before-after">
          <span>Recibo Python</span>
          <strong>{run.execution.pythonReceipt.syntax.status} / {run.execution.pythonReceipt.execution.status}</strong>
          <small>{run.execution.pythonReceipt.receiptHash.slice(0, 16)}…</small>
        </div>
      )}
    </section>
  );
};

export default ExecutionEvidencePanel;
