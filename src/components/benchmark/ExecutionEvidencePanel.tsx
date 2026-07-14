import React, { useState } from 'react';
import type { ExperimentRunV1 } from '../../services/benchmark/experimentTypes';
import CopyableHash from '../CopyableHash';

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
          <code>npm run oe4:python:run -- --bundle bundle.json --input synthetic_ground_truth.csv --output result.csv --receipt receipt.json</code>
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
      {representative && !run.execution?.pythonReceipt && (
        <div className="oe4-panel" data-testid="oe4-python-evidence-empty">
          <div className="oe4-panel-heading"><h2>Evidencia Python</h2></div>
          <div className="oe4-info">
            <p data-testid="oe4-python-syntax-not-measured">Sintaxis Python: No medida</p>
            <p data-testid="oe4-python-execution-not-run">Ejecución Python: No realizada</p>
            <p data-testid="oe4-python-reaudit-not-run">Reauditoría: No realizada</p>
          </div>
        </div>
      )}
      {run.execution?.pythonReceipt && (
        <div className="oe4-panel" data-testid="oe4-python-evidence-receipt">
          <div className="oe4-panel-heading"><h2>Evidencia Python</h2></div>
          <div className="oe4-info">
            <p data-testid="oe4-python-syntax-status">Sintaxis: {run.execution.pythonReceipt.syntax.status === 'passed' ? 'Superada' : 'Fallida'}</p>
            <p data-testid="oe4-python-execution-status">Ejecución: {run.execution.pythonReceipt.execution.status === 'passed' ? 'Superada' : 'Fallida'}</p>
            <p data-testid="oe4-python-version">Python {run.execution.pythonReceipt.pythonVersion}</p>
            {run.execution.pythonReceipt.pandasVersion && (
              <p data-testid="oe4-python-pandas-version">pandas {run.execution.pythonReceipt.pandasVersion}</p>
            )}
            <p data-testid="oe4-python-platform">Plataforma: {run.execution.pythonReceipt.platform}</p>
            {run.execution.pythonReceipt.output && (
              <p data-testid="oe4-python-output-dimensions">
                Salida: {run.execution.pythonReceipt.output.rowCount} filas × {run.execution.pythonReceipt.output.columnCount} columnas
              </p>
            )}
            <p data-testid="oe4-python-duration">
              Duración: {run.execution.pythonReceipt.execution.durationMs}ms
            </p>
          </div>
          <div className="diagnosis-tech-section">
            <h4 className="diagnosis-tech-section-title">Hashes del recibo Python</h4>
            <div className="diagnosis-tech-row">
              <CopyableHash value={run.execution.pythonReceipt.receiptHash} label="Recibo" testId="oe4-python-receipt-hash" />
              <CopyableHash value={run.execution.pythonReceipt.approvedScriptHash} label="Script" testId="oe4-python-script-hash" />
              <CopyableHash value={run.execution.pythonReceipt.beforeDatasetSha256} label="Dataset origen" testId="oe4-python-before-hash" />
              {run.execution.pythonReceipt.afterDatasetSha256 && (
                <CopyableHash value={run.execution.pythonReceipt.afterDatasetSha256} label="Dataset salida" testId="oe4-python-after-hash" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ExecutionEvidencePanel;
