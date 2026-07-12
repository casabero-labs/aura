import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { FileCode2, Copy, Download, ChevronDown, ChevronRight, Hash } from 'lucide-react';
import { AIConfig } from '../../types';
import { buildSmartSample, buildAnalysisPrompt } from '../../services/providers/prompts';
import { computePromptHash } from '../../services/llmAuditLog';
import SyntaxDisplay from '../SyntaxDisplay';

interface DisclosureSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
}

const DisclosureSection: React.FC<DisclosureSectionProps> = ({ title, isOpen, onToggle, children }) => {
  return (
    <div className="technical-disclosure">
      <button
        type="button"
        className="technical-disclosure-toggle"
        onClick={() => onToggle(!isOpen)}
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{title}</span>
      </button>
      {isOpen && <div className="technical-disclosure-content">{children}</div>}
    </div>
  );
};

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
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current && panelRef.current) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleToggle = useCallback((newState: boolean) => {
    if (onToggle) {
      onToggle(newState);
    } else {
      setInternalIsOpen(newState);
    }
  }, [onToggle]);

  const [showContext, setShowContext] = useState(true);
  const [showColumns, setShowColumns] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        onClick={() => handleToggle(!isOpen)}
      >
        <FileCode2 size={14} />
        <span>Expediente técnico</span>
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {isOpen && (
        <div className="technical-evidence-content">
          <div className="technical-evidence-meta">
            <span className="technical-evidence-meta-item">
              <Hash size={10} /> {promptHash.substring(0, 12)}...
            </span>
            <span className="technical-evidence-meta-item">
              {aiConfig.inputMode}
            </span>
            <span className="technical-evidence-meta-item">
              {aiConfig.providerType}
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
            <DisclosureSection
              title={`context — ${Object.keys(smartSample.context || {}).length} campos`}
              isOpen={showContext}
              onToggle={setShowContext}
            >
              <SyntaxDisplay
                filename="context.json"
                content={JSON.stringify(smartSample.context, null, 2)}
              />
            </DisclosureSection>

            <DisclosureSection
              title={`columns — ${smartSample.columns?.length} columnas`}
              isOpen={showColumns}
              onToggle={setShowColumns}
            >
              <SyntaxDisplay
                filename="columns.json"
                content={JSON.stringify(smartSample.columns, null, 2)}
                maxHeight={320}
              />
            </DisclosureSection>

            <DisclosureSection
              title={`detected_issues — ${smartSample.detected_issues?.length} reglas`}
              isOpen={showIssues}
              onToggle={setShowIssues}
            >
              <SyntaxDisplay
                filename="detected_issues.json"
                content={JSON.stringify(smartSample.detected_issues, null, 2)}
                maxHeight={320}
              />
            </DisclosureSection>

            <DisclosureSection
              title={`prompt — ${diagnosisPrompt.length} chars`}
              isOpen={showPrompt}
              onToggle={setShowPrompt}
            >
              <SyntaxDisplay filename="diagnosis.prompt.txt" content={diagnosisPrompt} maxHeight={320} />
            </DisclosureSection>

            <DisclosureSection
              title="Depuración avanzada"
              isOpen={showAdvanced}
              onToggle={setShowAdvanced}
            >
              <div className="technical-evidence-advanced">
                <p className="technical-evidence-advanced-note">
                  Solo para diagnóstico de problemas. No afecta el funcionamiento normal.
                </p>
              </div>
            </DisclosureSection>
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
