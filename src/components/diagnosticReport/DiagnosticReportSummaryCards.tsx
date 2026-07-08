import type { DiagnosticReport } from '../../services/diagnosticReport';
import { buildDiagnosticPresentation } from '../../services/diagnosticReport';

interface DiagnosticReportSummaryCardsProps {
  diagnosticReport: DiagnosticReport;
}

const DiagnosticReportSummaryCards = ({ diagnosticReport }: DiagnosticReportSummaryCardsProps) => {
  const presentation = buildDiagnosticPresentation(diagnosticReport);

  return (
    <div className="diagnostic-report-summary-grid" data-testid="diagnostic-report-summary-cards">
      {presentation.metrics.map((metric) => (
        <div key={metric.label} className="profile-card diagnostic-report-summary-card">
          <span className="profile-card-label">{metric.label}</span>
          <strong className="diagnostic-report-summary-value">{metric.value}</strong>
          {metric.note && <span className="diagnostic-report-summary-note">{metric.note}</span>}
        </div>
      ))}
    </div>
  );
};

export default DiagnosticReportSummaryCards;
