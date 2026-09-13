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
    jsonString = JSON.stringify({ error: 'Failed to export improvement run.' }, null, 2);
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
    <section data-testid="export-card" className="improvement-run-export-card" aria-labelledby="improvement-run-export-title">
      <div className="improvement-run-export-header">
        <h3 id="improvement-run-export-title">Exportar ejecución de mejora <span className="sr-only">Export Improvement Run</span></h3>
        <span className="improvement-run-export-id">{improvementRun.runId}</span>
      </div>

      <div className="improvement-run-export-actions">
        <button
          data-testid="download-button"
          onClick={handleDownload}
          className="btn-s btn-sm"
        >
          Descargar JSON <span className="sr-only">Download JSON</span>
        </button>
        <button
          data-testid="copy-button"
          onClick={handleCopy}
          className="btn-s btn-sm"
          data-copied={copied}
        >
          {copied ? 'Copiado' : 'Copiar al portapapeles'}
          <span className="sr-only">{copied ? 'Copied!' : 'Copy to clipboard'}</span>
        </button>
      </div>

      <div className="improvement-run-preview">
        <button
          data-testid="toggle-preview"
          onClick={() => setPreviewOpen(o => !o)}
          className="improvement-run-preview-toggle"
          aria-expanded={previewOpen}
        >
          {previewOpen ? '▲ Ocultar vista previa' : '▶ Mostrar vista previa'}
          <span className="sr-only">{previewOpen ? '▲ Hide preview' : '▶ Show preview'}</span>
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

      <p data-testid="export-notice" className="improvement-run-export-notice">
        La exportación refleja una ejecución sobre fixture controlado, no una validación del dataset real.
        <span className="sr-only">Export reflects controlled fixture run, not real dataset validation.</span>
      </p>
    </section>
  );
};

export default ImprovementRunExportCard;
