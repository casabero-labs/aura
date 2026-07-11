import React from 'react';
import type { ExperimentEvidencePackage } from '../../services/benchmark/experimentArtifactExporter';
import type { FormalValidityResult } from '../../services/benchmark/experimentReport';

interface CampaignReportPanelProps {
  formalValidity: FormalValidityResult;
  evidencePackage: ExperimentEvidencePackage | null;
  onExport?: (evidencePackage: ExperimentEvidencePackage) => void;
}

const downloadArtifact = (filename: string, mediaType: string, content: string | Uint8Array): void => {
  const blob = new Blob([content], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const CampaignReportPanel: React.FC<CampaignReportPanelProps> = ({ formalValidity, evidencePackage, onExport }) => {
  const exportAll = () => {
    if (!formalValidity.valid || evidencePackage === null) return;
    if (onExport) {
      onExport(evidencePackage);
      return;
    }
    evidencePackage.artifacts.forEach((artifact) =>
      downloadArtifact(artifact.filename, artifact.mediaType, artifact.content));
  };

  return (
    <section className="oe4-panel" aria-labelledby="oe4-report-title">
      <div className="oe4-panel-heading">
        <div><p className="oe4-eyebrow">Expediente TFM</p><h2 id="oe4-report-title">Preparación del reporte</h2></div>
        <span className={`oe4-status ${formalValidity.valid ? 'oe4-status--reaudited' : 'oe4-status--blocked'}`}>
          {formalValidity.valid ? 'listo' : 'bloqueado'}
        </span>
      </div>
      {formalValidity.valid ? (
        <p className="oe4-info">Los cinco artefactos se derivarán de esta campaña sin copiar métricas manualmente.</p>
      ) : (
        <ul className="oe4-blocker-list">
          {formalValidity.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
      <button type="button" className="btn-p" disabled={!formalValidity.valid || evidencePackage === null} onClick={exportAll}>
        Exportar expediente TFM
      </button>
    </section>
  );
};

export default CampaignReportPanel;
