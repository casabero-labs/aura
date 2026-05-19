import React from 'react';
import { AlertCircle, CheckCircle2, ListChecks, Regex, Braces, Calculator } from 'lucide-react';
import { AuditReport, AuditExecutionEvidence, IssueCategory, IssueSeverity } from '../types';

interface ProfileExecutiveSummaryProps {
  report: AuditReport;
  auditEvidence: AuditExecutionEvidence;
}

const familyIcon: Record<IssueCategory, React.ReactNode> = {
  [IssueCategory.INTEGRITY]: <ListChecks size={12} />,
  [IssueCategory.HYGIENE]: <Regex size={12} />,
  [IssueCategory.TYPES]: <Braces size={12} />,
  [IssueCategory.LOGIC]: <Calculator size={12} />,
  [IssueCategory.SEMANTIC]: <Calculator size={12} />,
};

const familyLabel: Record<IssueCategory, string> = {
  [IssueCategory.INTEGRITY]: 'Reglas explícitas',
  [IssueCategory.HYGIENE]: 'Expresiones regulares',
  [IssueCategory.TYPES]: 'Heurística de tipos',
  [IssueCategory.LOGIC]: 'Estadística descriptiva',
  [IssueCategory.SEMANTIC]: 'Semántica y seguridad',
};

const ProfileExecutiveSummary: React.FC<ProfileExecutiveSummaryProps> = ({ report, auditEvidence }) => {
  const criticalIssues = report.issues.filter(i => i.severity === IssueSeverity.CRITICAL);
  const warningIssues = report.issues.filter(i => i.severity === IssueSeverity.WARNING);

  const activeCategories = Array.from(new Set(report.issues.map(i => i.category)));

  const topCriticalColumns = criticalIssues
    .filter(i => i.column)
    .slice(0, 3)
    .map(i => i.column);

  const healthLabel = report.score >= 80
    ? 'salud alta'
    : report.score >= 60
      ? 'salud intermedia'
      : 'salud crítica';

  const healthColor = report.score >= 80
    ? 'var(--success)'
    : report.score >= 60
      ? 'var(--orange)'
      : 'var(--error)';

  return (
    <section className="section" aria-labelledby="exec-summary-title">
      <div className="section-header">
        <div>
          <p className="sec-eye">resumen del perfil</p>
          <h2 id="exec-summary-title" className="sec-title">Estado general del dataset.</h2>
        </div>
      </div>

      {/* Executive paragraph */}
      <div className="exec-summary-card">
        <p className="exec-summary-text">
          El dataset tiene <strong>{report.rowCount.toLocaleString('es-CO')} filas</strong> y <strong>{report.colCount} columnas</strong>
          con delimitador <code>"{report.delimiterDetected}"</code>. El motor determinista calculó un score de{' '}
          <strong style={{ color: healthColor }}>{report.score}/100</strong> ({healthLabel}).
          {criticalIssues.length > 0 && (
            <> Se encontraron <strong style={{ color: 'var(--error)' }}>{criticalIssues.length} problemas críticos</strong>
              {topCriticalColumns.length > 0 && <> en las columnas {topCriticalColumns.map((c, i) => <React.Fragment key={c}>{i > 0 && ', '}<code>{c}</code></React.Fragment>)}</>}.</>
          )}
          {warningIssues.length > 0 && (
            <> Además, hay {warningIssues.length} advertencias que requieren revisión.</>
          )}
          {report.issues.length === 0 && (
            <> No se activaron reglas de anomalía. El dataset parece estructuralmente sano.</>
          )}
        </p>
      </div>

      {/* Families activated */}
      {activeCategories.length > 0 && (
        <div className="exec-families-grid">
          {activeCategories.map(category => {
            const count = report.issues.filter(i => i.category === category).length;
            return (
              <div key={category} className="exec-family-chip">
                <span className="exec-family-icon">{familyIcon[category]}</span>
                <span className="exec-family-name">{familyLabel[category]}</span>
                <span className="exec-family-count">{count} hallazgo{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* What goes to next stage */}
      <div className="exec-next-stage">
        <CheckCircle2 size={12} />
        <div>
          <strong>Qué se envía a la siguiente etapa</strong>
          <p>
            El diagnóstico recibe un paquete estructurado con {report.colCount} columnas observadas,
            {report.issues.length} reglas activadas, muestras de evidencia y estadísticas descriptivas.
            El modelo no ve el dataset completo.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProfileExecutiveSummary;
