import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileCode2, Copy, Download, ChevronDown, ChevronRight, Hash } from 'lucide-react';
import { AIConfig } from '../../types';
import { buildSmartSample, buildAnalysisPrompt } from '../../services/providers/prompts';
import { computePromptHash } from '../../services/llmAuditLog';

interface TechnicalEvidencePanelProps {
  report: any;
  aiConfig: AIConfig;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export const TechnicalEvidencePanel: React.FC<TechnicalEvidencePanelProps> = ({
  report,
  aiConfig,
  isOpen: externalIsOpen,
  onToggle,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalIsOpen === true && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [externalIsOpen]);

  const handleToggle = () => {
    const newState = !isOpen;
    if (onToggle) {
      onToggle(newState);
    } else {
      setInternalIsOpen(newState);
    }
  };
  const [showContext, setShowContext] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const smartSample = useMemo(() => buildSmartSample(report), [report]);
  const diagnosisPrompt = useMemo(
    () => buildAnalysisPrompt(report, aiConfig.promptContract, aiConfig.inputMode),
    [report, aiConfig.promptContract, aiConfig.inputMode]
  );
  const promptHash = useMemo(() => computePromptHash(diagnosisPrompt), [diagnosisPrompt]);

  const affectedColumns = new Set(report.issues.map((i: any) => i.column).filter(Boolean)).size;
  const sampleCount = report.issues.reduce((acc: number, i: any) => acc + (i.sampleValues?.length || 0), 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(smartSample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aura_smart_sample_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="technical-evidence-panel" ref={panelRef}>
      <button
        className="technical-evidence-toggle"
        onClick={handleToggle}
      >
        <FileCode2 size={14} />
        <span>Ver expediente técnico</span>
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {isOpen && (
        <div className="technical-evidence-content">
          <div className="technical-evidence-meta">
            <span className="technical-evidence-meta-item">
              <Hash size={10} /> Hash: {promptHash.substring(0, 12)}...
            </span>
            <span className="technical-evidence-meta-item">
              Filas: {report.rowCount?.toLocaleString()}
            </span>
            <span className="technical-evidence-meta-item">
              Columnas: {Object.keys(report.columnStats || {}).length}
            </span>
            <span className="technical-evidence-meta-item">
              Hallazgos: {report.issues?.length}
            </span>
            <span className="technical-evidence-meta-item">
              Samples: {sampleCount}
            </span>
          </div>

          <p className="technical-evidence-note">
            Esto es para auditoría, trazabilidad y anexos. No necesitas abrirlo para generar el diagnóstico.
          </p>

          <div className="technical-evidence-sections">
            <details open={showContext} onToggle={() => setShowContext(!showContext)}>
              <summary>
                {showContext ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                context — {Object.keys(smartSample.context || {}).length} campos
              </summary>
              {showContext && (
                <pre className="technical-evidence-pre">
                  {JSON.stringify(smartSample.context, null, 2)}
                </pre>
              )}
            </details>

            <details open={showColumns} onToggle={() => setShowColumns(!showColumns)}>
              <summary>
                {showColumns ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                columns — {smartSample.columns?.length} columnas
              </summary>
              {showColumns && (
                <pre className="technical-evidence-pre technical-evidence-pre--scroll">
                  {JSON.stringify(smartSample.columns, null, 2)}
                </pre>
              )}
            </details>

            <details open={showIssues} onToggle={() => setShowIssues(!showIssues)}>
              <summary>
                {showIssues ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                detected_issues — {smartSample.detected_issues?.length} reglas
              </summary>
              {showIssues && (
                <pre className="technical-evidence-pre technical-evidence-pre--scroll">
                  {JSON.stringify(smartSample.detected_issues, null, 2)}
                </pre>
              )}
            </details>
          </div>

          <div className="technical-evidence-actions">
            <button className="btn-s btn-xs" onClick={() => copyToClipboard(JSON.stringify(smartSample, null, 2))}>
              <Copy size={10} /> Copiar JSON
            </button>
            <button className="btn-s btn-xs" onClick={downloadJson}>
              <Download size={10} /> Descargar JSON
            </button>
            <button className="btn-s btn-xs" onClick={() => copyToClipboard(diagnosisPrompt)}>
              <Copy size={10} /> Copiar prompt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalEvidencePanel;
