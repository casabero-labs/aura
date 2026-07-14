import React from 'react';
import type { ExperimentEvidencePackage } from '../../services/benchmark/experimentArtifactExporter';
import type { FormalValidityResult } from '../../services/benchmark/experimentReport';

interface CampaignReportPanelProps {
  formalValidity: FormalValidityResult;
  evidencePackage: ExperimentEvidencePackage | null;
  onExport?: (evidencePackage: ExperimentEvidencePackage) => void;
}

interface ReportBlockerSummary {
  key: string;
  title: string;
  description: string;
}

const summarizeBlocker = (reason: string): ReportBlockerSummary => {
  if (reason.includes('protocolVersion must match')) {
    return {
      key: 'protocol',
      title: 'Protocolo anterior',
      description: 'Esta campaña pertenece a una versión anterior y se conserva únicamente como evidencia histórica.',
    };
  }
  if (reason.includes('environment.inference must match')) {
    return {
      key: 'inference',
      title: 'Configuración no vigente',
      description: 'Los parámetros usados no coinciden con el protocolo actual. No se mezclarán con la nueva campaña.',
    };
  }
  if (reason.includes('campaign status is not completed') || reason.includes('not every experimental unit was attempted')) {
    return {
      key: 'incomplete',
      title: 'Campaña incompleta',
      description: 'El reporte se habilitará cuando todas las unidades planeadas hayan sido intentadas.',
    };
  }
  if (reason.includes('REPRESENTATIVE_SELECTION_INVALID') || reason.includes('representatives') || reason.includes('nine representatives')) {
    return {
      key: 'representatives',
      title: 'Selección pendiente',
      description: 'Todavía faltan corridas válidas para seleccionar los representantes de cada combinación.',
    };
  }
  return {
    key: `other:${reason}`,
    title: 'Validación pendiente',
    description: 'La evidencia aún no reúne todas las condiciones necesarias para preparar el reporte.',
  };
};

const ARTIFACT_DESCRIPTIONS: Record<string, string> = {
  'campaign.json': 'Fuente canónica del experimento: configuración, corridas, evaluaciones, recibos y reauditorías.',
  'runs.csv': 'Una fila por corrida para comparar modelos, métodos, métricas, errores, hashes y estados.',
  'report.md': 'Informe legible en Markdown con método, resultados, fallos, métricas y conclusiones.',
  'report.pdf': 'Versión PDF del informe para revisión humana, archivo o publicación.',
  'manifest.json': 'Hashes de todos los archivos exportados para comprobar que el expediente no fue alterado.',
};

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
  const blockerSummaries = Array.from(
    new Map(formalValidity.reasons.map((reason) => {
      const summary = summarizeBlocker(reason);
      return [summary.key, summary] as const;
    })).values(),
  );
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
    <section className="oe4-panel oe4-report-panel" aria-labelledby="oe4-report-title">
      <div className="oe4-panel-heading">
        <div>
          <p className="oe4-eyebrow">Resultados reproducibles</p>
          <h2 id="oe4-report-title">{formalValidity.valid ? 'Reporte listo' : 'Reporte no disponible'}</h2>
        </div>
        <span className={`oe4-status ${formalValidity.valid ? 'oe4-status--reaudited' : 'oe4-status--blocked'}`}>
          {formalValidity.valid ? 'listo' : 'bloqueado'}
        </span>
      </div>
      {formalValidity.valid ? (
        <>
          <p className="oe4-info">Los cinco artefactos se derivarán de este experimento sin copiar métricas manualmente.</p>
          <ul aria-label="Artefactos disponibles" className="oe4-artifact-list">
            {evidencePackage?.artifacts.map((artifact) => (
              <li key={artifact.filename}>
                <strong>{artifact.filename}</strong>
                <span>{ARTIFACT_DESCRIPTIONS[artifact.filename] ?? 'Artefacto técnico del experimento.'}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="oe4-report-intro">AURA conserva esta evidencia, pero no la presentará como resultado formal.</p>
          <ul className="oe4-report-blockers" aria-label="Condiciones pendientes del reporte">
            {blockerSummaries.map((summary) => (
              <li key={summary.key}>
                <strong>{summary.title}</strong>
                <span>{summary.description}</span>
              </li>
            ))}
          </ul>
          <details className="oe4-report-technical">
            <summary>Ver detalle técnico</summary>
            <ul>
              {formalValidity.reasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}
            </ul>
          </details>
        </>
      )}
      <button type="button" className="btn-p" disabled={!formalValidity.valid || evidencePackage === null} onClick={exportAll}>
        Exportar resultados
      </button>
    </section>
  );
};

export default CampaignReportPanel;
