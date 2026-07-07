import type { DiagnosticReport } from '../../services/diagnosticReport';

interface DiagnosticReportSummaryCardsProps {
  diagnosticReport: DiagnosticReport;
}

const numberFormatter = new Intl.NumberFormat('es-CO');

const diagnosticStatusLabels: Record<DiagnosticReport['status']['diagnosticStatus'], string> = {
  deterministic_only: 'Solo determinista',
  llm_diagnosis_available: 'Diagnóstico asistido disponible',
  llm_diagnosis_unavailable: 'Diagnóstico asistido no disponible',
};

const DiagnosticReportSummaryCards = ({ diagnosticReport }: DiagnosticReportSummaryCardsProps) => {
  const cards = [
    { label: 'Score base', value: `${diagnosticReport.metadata.scoreBase}/100` },
    { label: 'Filas', value: numberFormatter.format(diagnosticReport.metadata.rowCount) },
    { label: 'Columnas', value: numberFormatter.format(diagnosticReport.metadata.colCount) },
    { label: 'Total de hallazgos', value: numberFormatter.format(diagnosticReport.evidenceBase.totalIssues) },
    { label: 'Riesgos confirmados', value: numberFormatter.format(diagnosticReport.findingGroups.confirmedRisks.length) },
    {
      label: 'Posibles falsos positivos contextuales',
      value: numberFormatter.format(diagnosticReport.findingGroups.possibleFalsePositiveCandidates.length),
    },
    { label: 'Recomendaciones', value: numberFormatter.format(diagnosticReport.recommendations.length) },
    {
      label: 'Estado del diagnóstico',
      value: diagnosticStatusLabels[diagnosticReport.status.diagnosticStatus],
      wide: true,
    },
  ];

  return (
    <div className="diagnostic-report-summary-grid" data-testid="diagnostic-report-summary-cards">
      {cards.map((card) => (
        <div key={card.label} className={`profile-card diagnostic-report-summary-card ${card.wide ? 'diagnostic-report-summary-card--wide' : ''}`}>
          <span className="profile-card-label">{card.label}</span>
          <strong className="diagnostic-report-summary-value">{card.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default DiagnosticReportSummaryCards;
