import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import ColumnStatsPanel from './ColumnStatsPanel';
import IngestionEvidenceCard from './IngestionEvidenceCard';
import SeverityDistributionChart from './SeverityDistributionChart';
import { AuditExecutionEvidence, AuditReport, DeterministicValidationReport, IssueSeverity } from '../types';
import { formatAffectedShare } from '../services/issuePresentation';

interface ProfileStepProps {
  report: AuditReport | null;
  auditEvidence: AuditExecutionEvidence;
  deterministicValidation?: DeterministicValidationReport | null;
  file?: File | null;
  onContinue: () => void;
  onRetry?: () => void;
}

const ProfileStep: React.FC<ProfileStepProps> = ({ report, auditEvidence, file, onContinue, onRetry }) => {
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
        label: 'Sin alertas prioritarias en las reglas evaluadas',
        description: 'Este resultado describe las comprobaciones realizadas. La aptitud para tu análisis requiere revisar el contexto y los controles no evaluados.'
      };
    }
  }, [report, criticalCount, warningCount]);

  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const columnEntries = report
    ? Object.values(report.columnStats)
    : [];
  const selectedStats = selectedColumn ? report?.columnStats[selectedColumn] : undefined;

  return (
    <div className="profile-step">
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
            <div>
              <p className="guide-title">Error en la ingesta del archivo</p>
              <p className="guide-desc">No se pudo procesar el CSV. Verifica que el archivo sea válido y vuelve a intentarlo.</p>
            </div>
            <button className="btn-p btn-sm" onClick={onRetry}>
              Seleccionar otro archivo
            </button>
          </div>
        </>
      )}

      {!isError && report && (
        <>
          {/* A. Hero del paso (eyebrow, título, descripción) */}
          <div className="profile-editorial-header" data-testid="profile-hero">
            <p className="profile-editorial-eyebrow">Perfil base</p>
            <h1 className="profile-editorial-title">{datasetStatus.label}</h1>
            <p className="profile-editorial-desc">{datasetStatus.description}</p>
          </div>

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
            <div className="profile-summary-item">
              <span className="profile-summary-value">{report.score}/100</span>
              <span className="profile-summary-label">puntuación determinista</span>
            </div>
          </div>

          <section className="profile-decision-summary" data-testid="profile-decision-summary">
            {totalFindings > 0 && (
              <SeverityDistributionChart
                critical={criticalCount}
                warning={warningCount}
                info={infoCount}
              />
            )}
          </section>

          {/* D. Columnas más afectadas (visible por defecto) */}
          {topAffectedColumns.length > 0 && (
            <section className="profile-priorities" data-testid="profile-affected-columns">
              <h2 className="profile-priorities-title">Columnas más afectadas</h2>
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

          {/* E. Prioridades de limpieza (top hallazgos): una tabla, no tarjetas */}
          {topPriorities.length > 0 && (
            <section className="profile-priorities" data-testid="profile-priorities">
              <h2 className="profile-priorities-title">Prioridades principales</h2>
              <div className="table-scroll" role="region" aria-label="Prioridades principales" tabIndex={0}>
              <table className="editorial-data-table">
                <caption>Regla, columna y evidencia. La clasificación es de la regla, no un riesgo confirmado.</caption>
                <thead>
                  <tr>
                    <th scope="col">Hallazgo</th>
                    <th scope="col">Columna</th>
                    <th scope="col">Evidencia</th>
                    <th scope="col">Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  {topPriorities.map(issue => (
                    <tr key={issue.id}>
                      <th scope="row">{issue.ruleName}</th>
                      <td>{issue.column || 'dataset'}</td>
                      <td>{formatAffectedShare(issue.count, report.rowCount)} afectados</td>
                      <td>{issue.severity === IssueSeverity.CRITICAL ? 'crítico' : 'advertencia'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}

          {/* F. CTA principal — único botón prominente hacia Diagnóstico */}
          <section className="profile-columns" data-testid="profile-column-table">
            <h2 className="profile-priorities-title">Columnas</h2>
            <div className="table-scroll" role="region" aria-label="Columnas: tipo y completitud" tabIndex={0}>
            <table className="editorial-data-table">
              <caption>Tipo y completitud. Selecciona una fila para el detalle.</caption>
              <thead>
                <tr>
                  <th scope="col">Columna</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Nulos</th>
                  <th scope="col">Distintos</th>
                </tr>
              </thead>
              <tbody>
                {columnEntries.map((col) => (
                  <tr
                    key={col.name}
                    aria-selected={selectedColumn === col.name}
                    onClick={() => setSelectedColumn(col.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedColumn(col.name);
                      }
                    }}
                    tabIndex={0}
                  >
                    <th scope="row">{col.name}</th>
                    <td>{col.inferredType || '—'}</td>
                    <td>{col.nullCount}</td>
                    <td>{col.uniqueCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {selectedStats && (
              <p className="profile-decision-description" data-testid="profile-column-detail">
                {selectedStats.name}: {selectedStats.inferredType || 'tipo no inferido'}.
                {' '}{selectedStats.nullCount} nulos de {report.rowCount} filas.
                {selectedStats.semanticType ? ` Lectura semántica: ${selectedStats.semanticType}.` : ''}
              </p>
            )}
          </section>

          <div className="profile-actions" data-testid="profile-actions">
            <button
              className="btn-p profile-actions-primary"
              onClick={onContinue}
              type="button"
              data-testid="profile-continue-diagnosis"
            >
              Ir al diagnóstico
            </button>
          </div>

          <details className="technical-details" data-testid="profile-tech-disclosure">
            <summary className="technical-details-summary">
              <ChevronDown size={14} className="technical-details-chevron" />
              <span>Columnas detectadas</span>
              <span className="technical-details-hint">IQR es el rango entre cuartiles; cardinalidad es cuántos valores distintos hay</span>
            </summary>
            <div className="technical-details-body">

              <section className="profile-block" aria-labelledby="profile-characterization-title">
                <div className="profile-block-header">
                  <span className="profile-block-index">01</span>
                  <div>
                    <p className="sec-eye">estructura</p>
                    <h2 id="profile-characterization-title" className="sec-title">Tipos y cobertura por columna.</h2>
                  </div>
                </div>

                <section className="section section-nested profile-statistics-group" id="column-profile">
                  <ColumnStatsPanel columnStats={report.columnStats} totalRows={report.rowCount} />
                </section>
              </section>

            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default ProfileStep;
