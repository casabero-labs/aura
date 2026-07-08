import React, { useMemo } from 'react';
import { ArrowRight, ChevronDown, AlertOctagon, AlertTriangle, Info, BarChart3, Columns3 } from 'lucide-react';
import BoxPlot from './BoxPlot';
import ColumnStatsPanel from './ColumnStatsPanel';
import DatasetProfile from './DatasetProfile';
import DeterministicEngineSummary from './DeterministicEngineSummary';
import DeterministicValidationPanel from './DeterministicValidationPanel';
import FindingsTable from './FindingsTable';
import IngestionEvidenceCard from './IngestionEvidenceCard';
import ProfileEvidencePackage from './ProfileEvidencePackage';
import RuleActivationMatrix from './RuleActivationMatrix';
import { AuditExecutionEvidence, AuditReport, DeterministicValidationReport, IssueSeverity } from '../types';

interface ProfileStepProps {
  report: AuditReport | null;
  auditEvidence: AuditExecutionEvidence;
  deterministicValidation?: DeterministicValidationReport | null;
  file?: File | null;
  onContinue: () => void;
}

const ProfileStep: React.FC<ProfileStepProps> = ({ report, auditEvidence, deterministicValidation, file, onContinue }) => {
  const hasIqrColumns = report ? Object.values(report.columnStats).some((column) => column.inferredType === 'number' && column.iqr && column.iqr > 0) : false;
  const isError = auditEvidence.ingestionStatus === 'error';

  const criticalCount = report ? report.issues.filter(i => i.severity === IssueSeverity.CRITICAL).length : 0;
  const warningCount = report ? report.issues.filter(i => i.severity === IssueSeverity.WARNING).length : 0;
  const infoCount = report ? report.issues.filter(i => i.severity === IssueSeverity.INFO).length : 0;
  const totalFindings = report ? report.issues.length : 0;

  // Solo mostrar los 3 hallazgos más importantes
  const topPriorities = useMemo(() => {
    if (!report) return [];
    return [...report.issues]
      .filter(i => i.severity === IssueSeverity.CRITICAL || i.severity === IssueSeverity.WARNING)
      .sort((a, b) => {
        const w = { [IssueSeverity.CRITICAL]: 0, [IssueSeverity.WARNING]: 1, [IssueSeverity.INFO]: 2 };
        return w[a.severity] - w[b.severity] || b.affectedPercentage - a.affectedPercentage;
      })
      .slice(0, 3);
  }, [report]);

  // Top columnas afectadas (por número de hallazgos, deduplicado)
  const topAffectedColumns = useMemo(() => {
    if (!report) return [];
    const counts = new Map<string, number>();
    report.issues.forEach((issue) => {
      if (!issue.column) return;
      counts.set(issue.column, (counts.get(issue.column) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([column, count]) => ({ column, count }));
  }, [report]);

  // Calcular estado textual del dataset
  const datasetStatus = useMemo(() => {
    if (!report) return { label: '', description: '' };
    
    if (criticalCount > 0) {
      return {
        label: 'Requiere limpieza',
        description: `El dataset tiene ${criticalCount} problema${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''} que requiere${criticalCount === 1 ? '' : 'n'} atención antes de diagnosticar causas.`
      };
    } else if (warningCount > 0) {
      return {
        label: 'Riesgo moderado',
        description: `Se detectaron ${warningCount} advertencia${warningCount > 1 ? 's' : ''}. El dataset es usable pero tiene ${warningCount > 1 ? 'áreas' : 'área'} que puede${warningCount === 1 ? '' : 'n'} mejorar.`
      };
    } else {
      return {
        label: 'Dataset saludable',
        description: 'No se encontraron problemas significativos. El dataset está listo para análisis.'
      };
    }
  }, [report, criticalCount, warningCount]);

  const scoreColor = report ? (report.score >= 80 ? 'var(--success)' : report.score >= 60 ? 'var(--orange)' : 'var(--error)') : 'var(--ink3)';

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
          {/* A. Hero del paso (eyebrow, título, descripción) */}
          <div className="profile-editorial-header" data-testid="profile-hero">
            <p className="profile-editorial-eyebrow">PERFIL BASE</p>
            <h1 className="profile-editorial-title">Perfil técnico del dataset</h1>
            <p className="profile-editorial-desc">
              AURA analizó la estructura y calidad inicial del archivo mediante reglas deterministas reproducibles.
            </p>
          </div>

          {/* B. Resumen del dataset (archivo, filas, columnas, hallazgos) */}
          <div className="profile-summary-strip" data-testid="profile-summary-strip">
            <div className="profile-summary-item">
              <span className="profile-summary-value" style={{ fontSize: '15px', wordBreak: 'break-all' }}>
                {file?.name || auditEvidence.fileName || 'Archivo sin nombre'}
              </span>
              <span className="profile-summary-label">archivo</span>
            </div>
            <div className="profile-summary-item">
              <span className="profile-summary-value">{report.rowCount.toLocaleString('es-CO')}</span>
              <span className="profile-summary-label">filas</span>
            </div>
            <div className="profile-summary-item">
              <span className="profile-summary-value">{report.colCount}</span>
              <span className="profile-summary-label">columnas</span>
            </div>
            <div className="profile-summary-item">
              <span className="profile-summary-value profile-summary-value--critical">{totalFindings}</span>
              <span className="profile-summary-label">hallazgos</span>
            </div>
          </div>

          {/* C. Resumen de decisión (score, estado, distribución por severidad) */}
          <section className="profile-decision-summary" data-testid="profile-decision-summary">
            <div className="profile-decision-score">
              <div className="profile-decision-score-ring" style={{ '--score-color': scoreColor } as React.CSSProperties}>
                <span className="profile-decision-score-value" style={{ color: scoreColor }}>
                  {report.score}
                </span>
              </div>
              <div className="profile-decision-status">
                <span className="profile-decision-status-label">{datasetStatus.label}</span>
                <span className="profile-decision-status-desc">
                  Puntuación general del motor determinista (0-100)
                </span>
              </div>
            </div>
            <p className="profile-decision-description">{datasetStatus.description}</p>

            {/* Distribución por severidad — visible por defecto */}
            {totalFindings > 0 && (
              <div className="profile-severity-bars" data-testid="profile-severity-bars" style={{ marginTop: 'var(--space-md)' }}>
                <div className="profile-severity-row">
                  <span className="profile-sev-icon" style={{ color: 'var(--error)' }}><AlertOctagon size={12} /></span>
                  <span className="profile-sev-label">crítico</span>
                  <span className="profile-sev-count" style={{ color: 'var(--error)' }}>{criticalCount}</span>
                  <span className="profile-sev-bar-bg">
                    <span className="profile-sev-bar-fill" style={{ width: `${totalFindings ? (criticalCount / totalFindings) * 100 : 0}%`, background: 'var(--error)' }} />
                  </span>
                </div>
                <div className="profile-severity-row">
                  <span className="profile-sev-icon" style={{ color: 'var(--orange)' }}><AlertTriangle size={12} /></span>
                  <span className="profile-sev-label">advertencia</span>
                  <span className="profile-sev-count" style={{ color: 'var(--orange)' }}>{warningCount}</span>
                  <span className="profile-sev-bar-bg">
                    <span className="profile-sev-bar-fill" style={{ width: `${totalFindings ? (warningCount / totalFindings) * 100 : 0}%`, background: 'var(--orange)' }} />
                  </span>
                </div>
                <div className="profile-severity-row">
                  <span className="profile-sev-icon" style={{ color: 'var(--ink3)' }}><Info size={12} /></span>
                  <span className="profile-sev-label">informativo</span>
                  <span className="profile-sev-count" style={{ color: 'var(--ink3)' }}>{infoCount}</span>
                  <span className="profile-sev-bar-bg">
                    <span className="profile-sev-bar-fill" style={{ width: `${totalFindings ? (infoCount / totalFindings) * 100 : 0}%`, background: 'var(--ink3)' }} />
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* D. Columnas más afectadas (visible por defecto) */}
          {topAffectedColumns.length > 0 && (
            <section className="profile-priorities" data-testid="profile-affected-columns">
              <h2 className="profile-priorities-title">
                <Columns3 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Columnas más afectadas
              </h2>
              <div className="profile-priorities-list">
                {topAffectedColumns.map(({ column, count }) => (
                  <div key={column} className="profile-priority-item">
                    <div className="profile-priority-header">
                      <span className="profile-priority-column">{column}</span>
                      <span className="profile-priority-severity profile-priority-severity--warning">
                        {count} {count === 1 ? 'hallazgo' : 'hallazgos'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* E. Prioridades de limpieza (top hallazgos) */}
          {topPriorities.length > 0 && (
            <section className="profile-priorities" data-testid="profile-priorities">
              <h2 className="profile-priorities-title">
                <BarChart3 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Prioridades principales
              </h2>
              <div className="profile-priorities-list">
                {topPriorities.map(issue => (
                  <div key={issue.id} className="profile-priority-item">
                    <div className="profile-priority-header">
                      <span className="profile-priority-column">{issue.column || 'dataset'}</span>
                      <span className={`profile-priority-severity profile-priority-severity--${issue.severity}`}>
                        {issue.severity === IssueSeverity.CRITICAL ? 'crítico' : 'advertencia'}
                      </span>
                    </div>
                    <p className="profile-priority-rule">{issue.ruleName}</p>
                    <p className="profile-priority-impact">{issue.affectedPercentage.toFixed(0)}% de registros afectados</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* F. CTA principal — único botón prominente hacia Diagnóstico */}
          <div className="profile-actions" data-testid="profile-actions">
            <button
              className="btn-p profile-actions-primary"
              onClick={onContinue}
              type="button"
              data-testid="profile-continue-diagnosis"
            >
              Continuar al diagnóstico <ArrowRight size={14} />
            </button>
            <button
              className="btn-s profile-actions-secondary"
              onClick={() => {
                const details = document.querySelector('.technical-details') as HTMLDetailsElement;
                if (details) details.open = true;
              }}
              type="button"
            >
              Ver detalles técnicos
            </button>
          </div>

          {/* ── TECHNICAL DETAILS (closed by default) ── */}
          <details className="technical-details" data-testid="profile-tech-disclosure">
            <summary className="technical-details-summary">
              <ChevronDown size={14} className="technical-details-chevron" />
              <span>Datos técnicos del perfil</span>
              <span className="technical-details-hint">ingestión, caracterización, validación, reglas y hallazgos</span>
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
