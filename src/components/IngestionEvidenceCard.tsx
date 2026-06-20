import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Columns3, FileSpreadsheet, Fingerprint, Hash, Scissors } from 'lucide-react';
import { AuditExecutionEvidence } from '../types';

interface IngestionEvidenceCardProps {
  evidence: AuditExecutionEvidence;
}

const formatBytes = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const IngestionEvidenceCard: React.FC<IngestionEvidenceCardProps> = ({ evidence }) => {
  const isSuccess = evidence.ingestionStatus === 'success';

  return (
    <section className="ingestion-evidence-card" data-status={evidence.ingestionStatus} aria-labelledby="ingestion-evidence-title">
      <div className="ingestion-evidence-header">
        <div className="ingestion-evidence-kicker">
          {isSuccess ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>CONTRATO DE INGESTIÓN</span>
          <code className="ingestion-evidence-id">{evidence.id}</code>
        </div>
        <h3 id="ingestion-evidence-title" className="ingestion-evidence-title">
          Evidencia de carga del dataset
        </h3>
        <p className="ingestion-evidence-desc">
          {isSuccess
            ? 'Archivo CSV cargado, parseado y perfilado exitosamente en el navegador. Todos los metadatos registrados son trazables y reproducibles.'
            : `Error durante la ingesta: ${evidence.ingestionError || 'desconocido'}`
          }
        </p>
      </div>

      <div className="ingestion-evidence-grid">
        <div className="ingestion-metric">
          <FileSpreadsheet size={12} />
          <span className="ingestion-metric-label">Dataset</span>
          <code className="ingestion-metric-value">{evidence.fileName || '—'}</code>
        </div>
        <div className="ingestion-metric">
          <Hash size={12} />
          <span className="ingestion-metric-label">Tamaño</span>
          <code className="ingestion-metric-value">{formatBytes(evidence.fileSize)}</code>
        </div>
        <div className="ingestion-metric">
          <Hash size={12} />
          <span className="ingestion-metric-label">Filas</span>
          <code className="ingestion-metric-value">{evidence.rowsProcessed.toLocaleString('es-CO')}</code>
        </div>
        <div className="ingestion-metric">
          <Columns3 size={12} />
          <span className="ingestion-metric-label">Columnas</span>
          <code className="ingestion-metric-value">{evidence.columnsProcessed}</code>
        </div>
        <div className="ingestion-metric">
          <Scissors size={12} />
          <span className="ingestion-metric-label">Delimitador</span>
          <code className="ingestion-metric-value">{evidence.delimiter === ',' ? 'coma (,)' : `"${evidence.delimiter}"`}</code>
        </div>
        <div className="ingestion-metric">
          <Activity size={12} />
          <span className="ingestion-metric-label">Truncado</span>
          <code className="ingestion-metric-value">{evidence.truncated ? 'Sí' : 'No'}</code>
        </div>
        <div className="ingestion-metric">
          <Clock size={12} />
          <span className="ingestion-metric-label">Parseo</span>
          <code className="ingestion-metric-value">{evidence.parseDurationMs}ms</code>
        </div>
        <div className="ingestion-metric ingestion-metric--fingerprint">
          <Fingerprint size={12} />
          <span className="ingestion-metric-label">Fingerprint</span>
          <code className="ingestion-metric-value ingestion-fingerprint">{evidence.datasetFingerprint}</code>
        </div>
      </div>

      <div className={`ingestion-evidence-status ingestion-evidence-status--${evidence.ingestionStatus}`}>
        {isSuccess ? 'INGESTIÓN COMPLETA' : 'INGESTIÓN FALLIDA'}
      </div>
    </section>
  );
};

export default IngestionEvidenceCard;
