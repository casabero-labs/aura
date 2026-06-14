import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, ChevronDown, Info } from 'lucide-react';
import BoxPlot from './BoxPlot';
import ColumnStatsPanel from './ColumnStatsPanel';
import DatasetProfile from './DatasetProfile';
import DeterministicEngineSummary from './DeterministicEngineSummary';
import DeterministicValidationPanel from './DeterministicValidationPanel';
import FindingsTable from './FindingsTable';
import IngestionEvidenceCard from './IngestionEvidenceCard';
import ProfileEvidencePackage from './ProfileEvidencePackage';
import ProfileStageHeader from './ProfileStageHeader';
import RuleActivationMatrix from './RuleActivationMatrix';
import { AuditExecutionEvidence, AuditReport, DeterministicValidationReport, IssueSeverity } from '../types';

interface ProfileStepProps {
  report: AuditReport | null;
  auditEvidence: AuditExecutionEvidence;
  deterministicValidation?: DeterministicValidationReport | null;
  file?: File | null;
  onContinue: () => void;
}

const severityIcon = (sev: IssueSeverity) => {
  switch (sev) {
    case IssueSeverity.CRITICAL: return <AlertCircle size={12} />;
    case IssueSeverity.WARNING: return <AlertTriangle size={12} />;
    default: return <Info size={12} />;
  }
};

const severityColor = (sev: IssueSeverity) => {
  switch (sev) {
    case IssueSeverity.CRITICAL: return 'var(--error)';
    case IssueSeverity.WARNING: return 'var(--orange)';
    default: return 'var(--ink3)';
  }
};

const ProfileStep: React.FC<ProfileStepProps> = ({ report, auditEvidence, deterministicValidation, file, onContinue }) => {
  const hasIqrColumns = report ? Object.values(report.columnStats).some((column) => column.inferredType === 'number' && column.iqr && column.iqr > 0) : false;
  const isError = auditEvidence.ingestionStatus === 'error';

  const criticalCount = report ? report.issues.filter(i => i.severity === IssueSeverity.CRITICAL).length : 0;
  const warningCount = report ? report.issues.filter(i => i.severity === IssueSeverity.WARNING).length : 0;

  const topFindings = useMemo(() => {
    if (!report) return [];
    return [...report.issues]
      .filter(i => i.severity === IssueSeverity.CRITICAL || i.severity === IssueSeverity.WARNING)
      .sort((a, b) => {
        const w = { [IssueSeverity.CRITICAL]: 0, [IssueSeverity.WARNING]: 1, [IssueSeverity.INFO]: 2 };
        return w[a.severity] - w[b.severity] || b.affectedPercentage - a.affectedPercentage;
      })
      .slice(0, 8);
  }, [report]);

  const affectedColumns = useMemo(() => {
    if (!report) return [];
    const colIssues: Record<string, { critical: number; warning: number; total: number }> = {};
    report.issues.forEach(i => {
      const col = i.column || 'dataset';
      if (!colIssues[col]) colIssues[col] = { critical: 0, warning: 0, total: 0 };
      colIssues[col].total++;
      if (i.severity === IssueSeverity.CRITICAL) colIssues[col].critical++;
      else if (i.severity === IssueSeverity.WARNING) colIssues[col].warning++;
    });
    return Object.entries(colIssues)
      .sort((a, b) => b[1].critical - a[1].critical || b[1].total - a[1].total)
      .slice(0, 6);
  }, [report]);

  const scoreColor = report ? (report.score >= 80 ? 'var(--success)' : report.score >= 60 ? 'var(--orange)' : 'var(--error)') : 'var(--ink3)';

  const scoreLabel = report
    ? (report.score >= 80 ? 'Dataset saludable' : report.score >= 60 ? 'Requiere atención' : 'Problemas críticos')
    : '';

  return (
    <>
      {isError && (
        <>
          <section className="profile-block">
            <div className="profile-block-header">
              <span className="profile-block-index">00</span>
              <div>
                <p className="sec-eye">ingestión</p>
                <h2 className="sec-title">Evidencia de carga.</h2>
              </div>
            </div>
            <IngestionEvidenceCard evidence={auditEvidence} />
          </section>
          <div className="context-guide">
            <span className="guide-icon"><ArrowRight size={14} /></span>
            <div>
              <p className="guide-title">Error en la ingesta del archivo</p>
              <p className="guide-desc">No se pudo procesar el CSV. Verifica que el archivo sea válido y vuelve a intentarlo.</p>
            </div>
            <button className="btn-p btn-sm" onClick={() => window.location.reload()}>
              Volver a cargar <ArrowRight size={12} />
            </button>
          </div>
        </>
      )}

      {!isError && report && (
        <>
          <ProfileStageHeader report={report} />

          {/* ── COMPACT PROFILE SUMMARY ── */}
          <section className="profile-summary-section">
            {/* Score + Quick Stats Row */}
            <div className="profile-summary-hero">
              <div className="profile-summary-score">
                <div className="profile-summary-score-ring" style={{ '--score-color': scoreColor } as React.CSSProperties}>
                  <span className="profile-summary-score-value" style={{ color: scoreColor }}>
                    {report.score}
                  </span>
                </div>
                <span className="profile-summary-score-label">{scoreLabel}</span>
              </div>
              <div className="profile-summary-stats">
                <div className="profile-summary-stat">
                  <span className="profile-summary-stat-value">{report.rowCount.toLocaleString('es-CO')}</span>
                  <span className="profile-summary-stat-label">filas</span>
                </div>
                <div className="profile-summary-stat">
                  <span className="profile-summary-stat-value">{report.colCount}</span>
                  <span className="profile-summary-stat-label">columnas</span>
                </div>
                <div className="profile-summary-stat profile-summary-stat--critical">
                  <span className="profile-summary-stat-value" style={{ color: 'var(--error)' }}>{criticalCount}</span>
                  <span className="profile-summary-stat-label">críticos</span>
                </div>
                <div className="profile-summary-stat profile-summary-stat--warning">
                  <span className="profile-summary-stat-value" style={{ color: 'var(--orange)' }}>{warningCount}</span>
                  <span className="profile-summary-stat-label">advertencias</span>
                </div>
              </div>
            </div>

            {/* Top Findings */}
            {topFindings.length > 0 && (
              <div className="profile-summary-findings">
                <h3 className="profile-summary-findings-title">Hallazgos principales</h3>
                <div className="profile-summary-findings-list">
                  {topFindings.map(issue => (
                    <div key={issue.id} className="profile-summary-finding">
                      <span className="profile-summary-finding-sev" style={{ color: severityColor(issue.severity) }}>
                        {severityIcon(issue.severity)}
                      </span>
                      <span className="profile-summary-finding-rule">{issue.ruleName}</span>
                      <code className="profile-summary-finding-col">{issue.column || 'dataset'}</code>
                      <span className="profile-summary-finding-pct">{issue.affectedPercentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most Affected Columns */}
            {affectedColumns.length > 0 && (
              <div className="profile-summary-affected">
                <h3 className="profile-summary-findings-title">Columnas más afectadas</h3>
                <div className="profile-summary-affected-list">
                  {affectedColumns.map(([col, counts]) => (
                    <span key={col} className="profile-summary-affected-chip">
                      <code>{col}</code>
                      {counts.critical > 0 && <span className="profile-summary-affected-chip-crit">{counts.critical} crit</span>}
                      {counts.warning > 0 && <span className="profile-summary-affected-chip-warn">{counts.warning} adv</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Primary CTA */}
            <div className="profile-summary-cta">
              <button className="btn-p" onClick={onContinue}>
                Generar diagnóstico <ArrowRight size={14} />
              </button>
            </div>
          </section>

          {/* ── TECHNICAL DETAILS (collapsed) ── */}
          <details className="technical-details">
            <summary className="technical-details-summary">
              <ChevronDown size={14} className="technical-details-chevron" />
              <span>Detalles técnicos</span>
              <span className="technical-details-hint">evidencia de ingestión, validación determinista, estadísticas por columna y paquete estructurado</span>
            </summary>
            <div className="technical-details-body">

              <section className="profile-block" aria-labelledby="ingestion-evidence-section-title">
                <div className="profile-block-header">
                  <span className="profile-block-index">00</span>
                  <div>
                    <p className="sec-eye">ingestión</p>
                    <h2 id="ingestion-evidence-section-title" className="sec-title">Contrato de ingestión y metadatos del archivo.</h2>
                  </div>
                </div>
                <IngestionEvidenceCard evidence={auditEvidence} />
              </section>

              <section className="profile-block" aria-labelledby="profile-characterization-title">
                <div className="profile-block-header">
                  <span className="profile-block-index">01</span>
                  <div>
                    <p className="sec-eye">caracterización</p>
                    <h2 id="profile-characterization-title" className="sec-title">Estructura y perfil estadístico del dataset.</h2>
                  </div>
                </div>
                <DatasetProfile
                  report={report}
                  fileName={file?.name}
                  fileSize={file?.size}
                  parseDurationMs={auditEvidence.parseDurationMs}
                  auditDurationMs={auditEvidence.auditDurationMs}
                  datasetFingerprint={auditEvidence.datasetFingerprint}
                />

                <section className="section section-nested profile-statistics-group" id="column-profile">
                  <ColumnStatsPanel columnStats={report.columnStats} totalRows={report.rowCount} />
                </section>

                {hasIqrColumns && (
                  <section className="section section-nested profile-statistics-group" id="boxplot">
                    <BoxPlot columnStats={report.columnStats} />
                  </section>
                )}
              </section>

              <section className="profile-block" aria-labelledby="profile-validation-title">
                <div className="profile-block-header">
                  <span className="profile-block-index">02</span>
                  <div>
                    <p className="sec-eye">validación determinista</p>
                    <h2 id="profile-validation-title" className="sec-title">Reglas aplicadas y score reproducible.</h2>
                  </div>
                </div>

                <DeterministicEngineSummary report={report} auditEvidence={auditEvidence} />

                {deterministicValidation && (
                  <section className="section section-nested" id="deterministic-validation">
                    <DeterministicValidationPanel validationReport={deterministicValidation} />
                  </section>
                )}

                <section className="section section-nested" id="rule-matrix">
                  <RuleActivationMatrix issues={report.issues} />
                </section>
              </section>

              <section className="profile-block" aria-labelledby="profile-findings-title">
                <div className="profile-block-header">
                  <span className="profile-block-index">03</span>
                  <div>
                    <p className="sec-eye">hallazgos y evidencia</p>
                    <h2 id="profile-findings-title" className="sec-title">Problemas observados y paquete estructurado.</h2>
                  </div>
                </div>

                <FindingsTable issues={report.issues} rowCount={report.rowCount} />

                <ProfileEvidencePackage report={report} />
              </section>

            </div>
          </details>
        </>
      )}
    </>
  );
};

export default ProfileStep;
