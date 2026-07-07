import React from 'react';
import { ArrowRight, FileCode2, RotateCcw, ShieldCheck } from 'lucide-react';
import type { DiagnosticReport } from '../services/diagnosticReport';
import {
  DiagnosticFindingGroup,
  DiagnosticRecommendationsPanel,
  DiagnosticReportChartPreview,
  DiagnosticReportSummaryCards,
} from './diagnosticReport';

interface DiagnosticReportStepProps {
  diagnosticReport: DiagnosticReport;
  onExportMain: () => void;
  onGenerateScript: () => void;
  onBackToDiagnosis: () => void;
}

const subtitleByStatus: Record<DiagnosticReport['status']['diagnosticStatus'], string> = {
  llm_diagnosis_available: 'AURA integró evidencia determinista y diagnóstico asistido.',
  deterministic_only: 'AURA generó un reporte con evidencia determinista. El diagnóstico asistido no está disponible.',
  llm_diagnosis_unavailable: 'AURA generó el reporte con evidencia determinista y registró la indisponibilidad del diagnóstico asistido.',
};

const sourceLabels: Record<DiagnosticReport['diagnosisSummary']['source'], string> = {
  structured_v2: 'Contrato estructurado v2',
  legacy_text: 'Diagnóstico legacy en texto libre',
  unavailable: 'Evidencia determinista sin diagnóstico asistido',
};

const governancePrinciples = [
  'El score base no fue modificado.',
  'El diagnóstico contextualiza, no reemplaza la evidencia.',
  'El script es opcional.',
  'HITL solo aplica si se entra a remediación.',
  'No se corrigen datos automáticamente desde esta pantalla.',
];

const DiagnosticReportStep: React.FC<DiagnosticReportStepProps> = ({
  diagnosticReport,
  onExportMain,
  onGenerateScript,
  onBackToDiagnosis,
}) => (
  <section className="section diagnostic-report-stage" data-testid="diagnostic-report-stage">
    <div className="diagnostic-report-hero" data-testid="diagnostic-report-header">
      <div>
        <p className="sec-eye">perfil definitivo</p>
        <h2 className="sec-title">Diagnóstico consolidado del dataset</h2>
        <p className="section-note">{subtitleByStatus[diagnosticReport.status.diagnosticStatus]}</p>
        <p className="section-note" style={{ fontSize: '12px', color: 'var(--ink3)' }}>
          La remediación abre una rama opcional. Podés volver al reporte diagnóstico en cualquier momento. El informe se puede exportar sin generar script.
        </p>
      </div>
      <div className="diagnostic-report-actions diagnostic-report-actions--top">
        <button className="btn-p" onClick={onExportMain} data-testid="diagnostic-report-export-main">
          <ArrowRight size={14} /> Ir a exportación principal
        </button>
        <button className="btn-s" onClick={onGenerateScript} data-testid="diagnostic-report-generate-script">
          <FileCode2 size={14} /> Generar script recomendado, opcional
        </button>
        <button className="btn-s" onClick={onBackToDiagnosis} data-testid="diagnostic-report-back-diagnosis">
          <RotateCcw size={14} /> Volver al diagnóstico
        </button>
      </div>
    </div>

    <DiagnosticReportSummaryCards diagnosticReport={diagnosticReport} />

    <div className="diagnostic-report-governance" data-testid="diagnostic-report-governance">
      <div className="diagnostic-report-governance-head">
        <ShieldCheck size={16} />
        <strong>Principios de gobernanza</strong>
      </div>
      <ul>
        {governancePrinciples.map((principle) => <li key={principle}>{principle}</li>)}
      </ul>
    </div>

    <section className="diagnostic-report-executive" data-testid="diagnostic-report-executive-summary">
      <div className="diagnostic-report-section-head">
        <div>
          <p className="sec-eye">resumen ejecutivo</p>
          <h3>Resumen ejecutivo</h3>
        </div>
        <span className="diagnostic-report-badge">{sourceLabels[diagnosticReport.diagnosisSummary.source]}</span>
      </div>
      <p>{diagnosticReport.diagnosisSummary.executiveSummary}</p>
      {diagnosticReport.diagnosisSummary.limitations.length > 0 && (
        <div className="diagnostic-report-limitations">
          <span>Limitaciones visibles</span>
          <ul>
            {diagnosticReport.diagnosisSummary.limitations.slice(0, 3).map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </section>

    <DiagnosticReportChartPreview chartSpecs={diagnosticReport.chartSpecs} />

    <div className="diagnostic-report-findings-grid">
      <DiagnosticFindingGroup
        title="Riesgos confirmados"
        description="Hallazgos deterministas que se mantienen como riesgos relevantes del dataset."
        findings={diagnosticReport.findingGroups.confirmedRisks}
        testId="diagnostic-report-confirmed-risks"
      />
      <DiagnosticFindingGroup
        title="Posibles falsos positivos contextuales"
        description="Candidatos que requieren interpretación humana antes de remediar o descartar."
        findings={diagnosticReport.findingGroups.possibleFalsePositiveCandidates}
        testId="diagnostic-report-false-positive-candidates"
        falsePositiveContext
      />
      <DiagnosticFindingGroup
        title="Requieren revisión humana"
        description="Elementos donde la decisión de dominio no debe automatizarse."
        findings={diagnosticReport.findingGroups.humanReviewRequired}
        testId="diagnostic-report-human-review"
      />
      <DiagnosticFindingGroup
        title="Candidatos de remediación opcional"
        description="Hallazgos donde AURA puede ayudar a preparar un script, sin convertirlo en requisito."
        findings={diagnosticReport.findingGroups.optionalRemediationCandidates}
        testId="diagnostic-report-optional-remediation"
      />
    </div>

    <DiagnosticRecommendationsPanel recommendations={diagnosticReport.recommendations} />

    <div className="diagnostic-report-closeout">
      <p>
        Exportar no exige script. Script no es necesario para cerrar el análisis.
      </p>
      <div className="diagnostic-report-actions">
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
    </div>
  </section>
);

export default DiagnosticReportStep;
