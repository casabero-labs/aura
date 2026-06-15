import React, { useMemo } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
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
          {/* A. Header editorial corto */}
          <div className="profile-editorial-header">
            <p className="profile-editorial-eyebrow">perfil del dataset</p>
            <h1 className="profile-editorial-title">Análisis de calidad y estructura</h1>
          </div>

          {/* B. Resumen de decisión */}
          <section className="profile-decision-summary">
            <div className="profile-decision-score">
              <div className="profile-decision-score-ring" style={{ '--score-color': scoreColor } as React.CSSProperties}>
                <span className="profile-decision-score-value" style={{ color: scoreColor }}>
                  {report.score}
                </span>
              </div>
              <div className="profile-decision-status">
                <span className="profile-decision-status-label">{datasetStatus.label}</span>
                <span className="profile-decision-status-desc">{report.rowCount.toLocaleString('es-CO')} filas · {report.colCount} columnas</span>
              </div>
            </div>
            <p className="profile-decision-description">{datasetStatus.description}</p>
          </section>

          {/* C. Prioridades de limpieza */}
          {topPriorities.length > 0 && (
            <section className="profile-priorities">
              <h2 className="profile-priorities-title">Prioridades de limpieza</h2>
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

          {/* D. Acción principal */}
          <div className="profile-actions">
            <button className="btn-p profile-actions-primary" onClick={onContinue}>
              Generar diagnóstico <ArrowRight size={14} />
            </button>
            <button 
              className="btn-s profile-actions-secondary"
              onClick={() => {
                const details = document.querySelector('.technical-details') as HTMLDetailsElement;
                if (details) details.open = true;
              }}
            >
              Ver evidencia técnica
            </button>
          </div>

          {/* ── TECHNICAL DETAILS (collapsed por defecto) ── */}
          <details className="technical-details">
            <summary className="technical-details-summary">
              <ChevronDown size={14} className="technical-details-chevron" />
              <span>Evidencia técnica completa</span>
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
