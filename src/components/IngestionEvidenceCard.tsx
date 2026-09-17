import React from 'react';
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

const shortHash = (hash?: string): string => {
  if (!hash || hash === 'error') return '—';
  return hash.length > 16 ? `${hash.slice(0, 12)}…` : hash;
};

/**
 * Identidad del archivo cargado + detalle expandible de ingestión.
 * Sin tarjetas de métricas ni iconografía: filete, cifras tabulares y copy.
 */
const IngestionEvidenceCard: React.FC<IngestionEvidenceCardProps> = ({ evidence }) => {
  const isSuccess = evidence.ingestionStatus === 'success';

  return (
    <section className="file-identity" aria-labelledby="file-identity-title">
      <p className="file-identity-kicker">
        Archivo cargado · <code>{evidence.id}</code>
      </p>
      <h3 id="file-identity-title" className="file-identity-name">
        {evidence.fileName || '—'}
      </h3>
      <p className="file-identity-facts">
        {evidence.rowsProcessed.toLocaleString('es-CO')} filas · {evidence.columnsProcessed} columnas · delimitador {evidence.delimiter === ',' ? 'coma (,)' : `"${evidence.delimiter}"`} · {isSuccess ? 'ingestión completa' : 'ingestión fallida'}
      </p>
      {!isSuccess && (
        <p className="file-identity-error" role="alert">
          Error durante la ingesta: {evidence.ingestionError || 'desconocido'}
        </p>
      )}
      <details className="file-identity-detail">
        <summary>Detalle de ingestión</summary>
        <dl className="file-identity-list">
          <div>
            <dt>Tamaño</dt>
            <dd>{formatBytes(evidence.fileSize)}</dd>
          </div>
          <div>
            <dt>Parseo</dt>
            <dd>{evidence.parseDurationMs} ms{evidence.truncated ? ' · truncado' : ''}</dd>
          </div>
          <div>
            <dt>Fingerprint</dt>
            <dd><code>{evidence.datasetFingerprint}</code></dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd><code>{shortHash(evidence.datasetSha256)}</code></dd>
          </div>
        </dl>
      </details>
    </section>
  );
};

export default IngestionEvidenceCard;
