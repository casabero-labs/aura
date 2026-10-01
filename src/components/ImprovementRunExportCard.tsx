import React, { useState } from 'react';
import type { ImprovementRunV1 } from '../services/improvementRunService';
import { exportImprovementRunJSON } from '../services/improvementRunService';
import SyntaxDisplay from './SyntaxDisplay';

interface Props {
  improvementRun: ImprovementRunV1;
}

const ImprovementRunExportCard: React.FC<Props> = ({ improvementRun }) => {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  let jsonString: string;
  try {
    jsonString = exportImprovementRunJSON(improvementRun);
  } catch {
    jsonString = JSON.stringify({ error: 'No se pudo exportar la ejecución de mejora.' }, null, 2);
  }

  const previewLines = jsonString.split('\n');
  const PREVIEW_MAX = 12;
  const isLong = previewLines.length > PREVIEW_MAX;
  const visibleLines = previewOpen ? previewLines : previewLines.slice(0, PREVIEW_MAX);
  const previewText = visibleLines.join('\n') + (isLong && !previewOpen ? '\n...' : '');

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `improvement-run-${improvementRun.runId.replace(/[^a-z0-9]/gi, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div data-testid="export-card" style={{ border: '1px solid var(--line)', borderRadius: 0, padding: '16px', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Exportar ejecución de mejora</h4>
        <span style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'monospace' }}>{improvementRun.runId}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          data-testid="download-button"
          onClick={handleDownload}
          style={{ padding: '6px 12px', fontSize: 13, borderRadius: 0, border: '1px solid var(--border-strong)', background: 'transparent', cursor: 'pointer' }}
        >
          Descargar JSON
        </button>
        <button
          data-testid="copy-button"
          onClick={handleCopy}
          style={{ padding: '6px 12px', fontSize: 13, borderRadius: 0, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--ink)', fontWeight: copied ? 600 : 400, cursor: 'pointer' }}
        >
          {copied ? 'Copiado' : 'Copiar al portapapeles'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button
          data-testid="toggle-preview"
          onClick={() => setPreviewOpen(o => !o)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ink-muted)', cursor: 'pointer', marginBottom: 4 }}
        >
          {previewOpen ? '▲ Ocultar vista previa' : '▶ Ver vista previa'}
        </button>
        {previewOpen && (
          <SyntaxDisplay
            filename="improvement-run.json"
            content={previewText}
            copyText={jsonString}
            maxHeight={240}
            contentTestId="json-preview"
          />
        )}
      </div>

      <p data-testid="export-notice" style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.5 }}>
        La exportación refleja una ejecución sobre datos de prueba controlados, no la validación de un dataset real.
      </p>
    </div>
  );
};

export default ImprovementRunExportCard;
