import React from 'react';
import { ArrowRight, FileCode2, RotateCcw, ShieldCheck } from 'lucide-react';
import type { DiagnosticReport } from '../services/diagnosticReport';

interface DiagnosticReportGateStepProps {
  diagnosticReport: DiagnosticReport;
  onExportMain: () => void;
  onGenerateScript: () => void;
  onBackToDiagnosis: () => void;
}

const statusLabels: Record<DiagnosticReport['status']['diagnosticStatus'], string> = {
  deterministic_only: 'deterministic_only',
  llm_diagnosis_available: 'llm_diagnosis_available',
  llm_diagnosis_unavailable: 'llm_diagnosis_unavailable',
};

const numberFormatter = new Intl.NumberFormat('es-CO');

const DiagnosticReportGateStep: React.FC<DiagnosticReportGateStepProps> = ({
  diagnosticReport,
  onExportMain,
  onGenerateScript,
  onBackToDiagnosis,
}) => {
  const confirmedRisks = diagnosticReport.findingGroups.confirmedRisks.length;
  const falsePositiveCandidates = diagnosticReport.findingGroups.possibleFalsePositiveCandidates.length;
  const recommendationCount = diagnosticReport.recommendations.length;

  return (
    <section className="section" data-testid="diagnostic-report-stage">
      <div className="section-header">
        <div>
          <p className="sec-eye">diagnostic_report</p>
          <h2 className="sec-title">Perfil definitivo del dataset</h2>
        </div>
      </div>

      <p className="section-note">
        AURA consolidó evidencia determinista y diagnóstico disponible.
      </p>

      <div className="stage-decision-summary" data-testid="diagnostic-report-summary">
        <div className="stage-summary-item">
          <span className="stage-summary-label">Score base</span>
          <strong>{diagnosticReport.metadata.scoreBase}/100</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Filas / columnas</span>
          <strong>
            {numberFormatter.format(diagnosticReport.metadata.rowCount)} / {numberFormatter.format(diagnosticReport.metadata.colCount)}
          </strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Diagnóstico</span>
          <strong>{statusLabels[diagnosticReport.status.diagnosticStatus]}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Riesgos confirmados</span>
          <strong>{confirmedRisks}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Posibles falsos positivos contextuales</span>
          <strong>{falsePositiveCandidates}</strong>
        </div>
        <div className="stage-summary-item">
          <span className="stage-summary-label">Recomendaciones</span>
          <strong>{recommendationCount}</strong>
        </div>
      </div>

      <div className="companion-note">
        <ShieldCheck size={16} />
        <p>
          El score base no fue modificado. El script es opcional. HITL solo aplica si se entra a remediación con script.
        </p>
      </div>

      <div className="stage-actions">
        <button className="btn-p" onClick={onExportMain}>
          <ArrowRight size={14} /> Ir a exportación principal
        </button>
        <button className="btn-s" onClick={onGenerateScript}>
          <FileCode2 size={14} /> Generar script recomendado, opcional
        </button>
        <button className="btn-s" onClick={onBackToDiagnosis}>
          <RotateCcw size={14} /> Volver al diagnóstico
        </button>
      </div>
    </section>
  );
};

export default DiagnosticReportGateStep;
