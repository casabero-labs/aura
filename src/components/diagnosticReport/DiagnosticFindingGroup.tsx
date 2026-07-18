import type { DiagnosticFinding } from '../../services/diagnosticReport';
import { IssueSeverity } from '../../types';

interface DiagnosticFindingGroupProps {
  title: string;
  description: string;
  findings: DiagnosticFinding[];
  testId: string;
  falsePositiveContext?: boolean;
  findingAttributes?: Readonly<Record<string, readonly string[]>>;
  falsePositiveFindingIds?: readonly string[];
  children?: React.ReactNode;
}

const severityLabels: Record<IssueSeverity, string> = {
  [IssueSeverity.CRITICAL]: 'Crítica',
  [IssueSeverity.WARNING]: 'Advertencia',
  [IssueSeverity.INFO]: 'Informativa',
  [IssueSeverity.GOOD]: 'Correcta',
};

const confidenceLabels: Record<DiagnosticFinding['confidence'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const boolLabel = (value: boolean) => (value ? 'Sí' : 'No');

const DiagnosticFindingGroup = ({
  title,
  description,
  findings,
  testId,
  falsePositiveContext = false,
  findingAttributes = {},
  falsePositiveFindingIds = [],
  children,
}: DiagnosticFindingGroupProps) => (
  <section className="diagnostic-report-section" data-testid={testId}>
    <div className="diagnostic-report-section-head">
      <div>
        <p className="sec-eye">{title}</p>
        <h3>{title}</h3>
      </div>
      <span className="diagnostic-report-badge">{findings.length}</span>
    </div>
    <p className="diagnostic-report-section-copy">{description}</p>

    {findings.length === 0 ? (
      <p className="diagnostic-report-empty">No hay elementos en este grupo.</p>
    ) : (
      <div className="diagnostic-finding-list">
        {findings.map((finding) => (
          <article
            className="diagnostic-finding-card"
            key={finding.id}
            data-testid="diagnostic-finding-card"
            data-finding-id={finding.id}
          >
            <div className="diagnostic-finding-card-head">
              <div>
                <h4>{finding.title}</h4>
                <div className="finding-card-meta">
                  <code>{severityLabels[finding.severity]}</code>
                  <code>{finding.category}</code>
                  <code>Confianza {confidenceLabels[finding.confidence]}</code>
                  {(findingAttributes[finding.id] ?? []).map((attribute) => (
                    <code key={attribute}>{attribute}</code>
                  ))}
                </div>
              </div>
              {(falsePositiveContext || falsePositiveFindingIds.includes(finding.id)) && (
                <span className="diagnostic-report-badge diagnostic-report-badge--warn">
                  Posible, no definitivo. No modifica score.
                </span>
              )}
            </div>

            <div className="diagnostic-finding-body">
              <div>
                <span>Columnas</span>
                <strong>{finding.columns.length > 0 ? finding.columns.join(', ') : 'Dataset completo'}</strong>
              </div>
              <div>
                <span>Evidencia</span>
                <strong>{finding.evidenceSummary}</strong>
              </div>
              <div>
                <span>Interpretación contextual</span>
                <strong>{finding.contextualInterpretation}</strong>
              </div>
              <div>
                <span>Revisión humana</span>
                <strong>{boolLabel(finding.requiresHumanReview)}</strong>
              </div>
              <div>
                <span>Puede generar script</span>
                <strong>{boolLabel(finding.canGenerateScript)}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    )}
    {children}
  </section>
);

export default DiagnosticFindingGroup;
