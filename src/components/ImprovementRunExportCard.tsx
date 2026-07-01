import React, { useState } from 'react';
import type { ImprovementRunV1 } from '../services/improvementRunService';
import { exportImprovementRunJSON } from '../services/improvementRunService';

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
    <div data-testid="export-card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>Export Improvement Run</h4>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{improvementRun.runId}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          data-testid="download-button"
          onClick={handleDownload}
          style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}
        >
          Download JSON
        </button>
        <button
          data-testid="copy-button"
          onClick={handleCopy}
          style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', background: copied ? '#d1fae5' : '#f9fafb', cursor: 'pointer' }}
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button
          data-testid="toggle-preview"
          onClick={() => setPreviewOpen(o => !o)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#6b7280', cursor: 'pointer', marginBottom: 4 }}
        >
          {previewOpen ? '▲ Hide preview' : '▶ Show preview'}
        </button>
        {previewOpen && (
          <pre
            data-testid="json-preview"
            style={{ fontSize: 11, fontFamily: 'monospace', background: '#f3f4f6', borderRadius: 4, padding: '8px', overflow: 'auto', maxHeight: 240, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {previewText}
          </pre>
        )}
      </div>

      <p data-testid="export-notice" style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
        Export reflects controlled fixture run, not real dataset validation.
      </p>
    </div>
  );
};

export default ImprovementRunExportCard;
