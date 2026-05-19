import React, { useMemo, useState } from 'react';
import { CheckCheck, ChevronDown, ChevronRight, Copy, FileCode2 } from 'lucide-react';
import { AuditReport } from '../types';
import { buildSmartSample } from '../services/providers/prompts';

interface ProfileEvidencePackageProps {
  report: AuditReport;
}

type JsonSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

const JsonKey = ({ children }: { children: React.ReactNode }) => <span className="json-key">"{children}"</span>;
const JsonStr = ({ children }: { children: React.ReactNode }) => <span className="json-string">{children}</span>;
const JsonNum = ({ children }: { children: React.ReactNode }) => <span className="json-number">{children}</span>;

const JsonSection: React.FC<JsonSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="json-section">
      <button className="json-section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`json-caret ${open ? 'open' : ''}`}>›</span>
        <span>{title}</span>
      </button>
      {open && <div className="json-section-content">{children}</div>}
    </div>
  );
};

const estimateUnits = (text: string) => Math.ceil(text.length / 4);

const ProfileEvidencePackage: React.FC<ProfileEvidencePackageProps> = ({ report }) => {
  const sample = useMemo(() => buildSmartSample(report), [report]);
  const jsonString = useMemo(() => JSON.stringify(sample, null, 2), [sample]);
  const unitEstimate = useMemo(() => estimateUnits(jsonString), [jsonString]);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is optional.
    }
  };

  return (
    <section className="section" id="profile-evidence-package">
      <div className="smart-sample-viewer">
        <div className="smart-sample-header">
          <div className="smart-sample-title">
            <FileCode2 size={14} />
            <span>PAQUETE PARA LA SIGUIENTE ETAPA</span>
          </div>
          <div className="smart-sample-meta">
            <span className="smart-sample-meta-chip">{sample.columns.length} columnas</span>
            <span className="smart-sample-meta-chip">{sample.detected_issues.length} reglas activadas</span>
            <span className="smart-sample-meta-chip">{jsonString.length.toLocaleString('es-CO')} caracteres</span>
            <button className="smart-sample-copy-btn" onClick={handleCopy} title="Copiar JSON">
              {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
              {copied ? 'copiado' : 'copiar'}
            </button>
          </div>
          <p className="smart-sample-subtitle">
            Esta es la salida verificable del perfilamiento: contexto del dataset, columnas observadas,
            muestras y reglas activadas. Sirve como evidencia técnica para las etapas posteriores.
          </p>
        </div>

        <button className="smart-sample-detail-toggle" onClick={() => setShowDetails((open) => !open)}>
          {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {showDetails ? 'Ocultar estructura técnica' : 'Ver estructura técnica'}
          <span>~{unitEstimate.toLocaleString('es-CO')} unidades estimadas</span>
        </button>

        {showDetails && (
          <div className="smart-sample-body">
            <JsonSection title={`context — ${Object.keys(sample.context).length} campos`} defaultOpen>
              <div className="json-kv">
                <span className="json-line"><JsonKey>total_rows</JsonKey>: <JsonNum>{sample.context.total_rows}</JsonNum>,</span>
                <span className="json-line"><JsonKey>total_columns</JsonKey>: <JsonNum>{sample.context.total_columns}</JsonNum>,</span>
                <span className="json-line"><JsonKey>detected_delimiter</JsonKey>: <JsonStr>"{sample.context.detected_delimiter}"</JsonStr>,</span>
                <span className="json-line"><JsonKey>quality_score</JsonKey>: <JsonNum>{sample.context.quality_score}</JsonNum></span>
              </div>
            </JsonSection>

            <JsonSection title={`columns — ${sample.columns.length} columnas`}>
              <pre className="json-raw">{JSON.stringify(sample.columns, null, 2)}</pre>
            </JsonSection>

            <JsonSection title={`detected_issues — ${sample.detected_issues.length} reglas activadas`}>
              <pre className="json-raw">{JSON.stringify(sample.detected_issues, null, 2)}</pre>
            </JsonSection>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfileEvidencePackage;
