import React from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { IssueSeverity, QualityIssue } from '../types';

interface FindingsTableProps {
  issues: QualityIssue[];
  rowCount: number;
}

const severityLabel: Record<IssueSeverity, string> = {
  [IssueSeverity.CRITICAL]: 'Crítico',
  [IssueSeverity.WARNING]: 'Advertencia',
  [IssueSeverity.INFO]: 'Informativo',
  [IssueSeverity.GOOD]: 'Correcto',
};

const severityIcon: Record<IssueSeverity, React.ReactNode> = {
  [IssueSeverity.CRITICAL]: <ShieldAlert size={13} />,
  [IssueSeverity.WARNING]: <AlertTriangle size={13} />,
  [IssueSeverity.INFO]: <Info size={13} />,
  [IssueSeverity.GOOD]: <Info size={13} />,
};

const explainImpact = (issue: QualityIssue) => {
  if (issue.severity === IssueSeverity.CRITICAL) return 'Puede invalidar análisis o requerir revisión antes de usar la columna.';
  if (issue.severity === IssueSeverity.WARNING) return 'Puede introducir ruido, sesgo o inconsistencias si no se revisa.';
  return 'Señal de calidad útil para caracterizar el dataset y decidir acciones posteriores.';
};

const sampleText = (values: unknown[]) => {
  if (!values.length) return '-';
  return values.slice(0, 3).map((value) => JSON.stringify(value)).join(' · ');
};

const FindingsTable: React.FC<FindingsTableProps> = ({ issues, rowCount }) => {
  const sortedIssues = [...issues].sort((a, b) => {
    const weight = { [IssueSeverity.CRITICAL]: 0, [IssueSeverity.WARNING]: 1, [IssueSeverity.INFO]: 2, [IssueSeverity.GOOD]: 3 };
    return weight[a.severity] - weight[b.severity] || b.affectedPercentage - a.affectedPercentage;
  });

  return (
    <section className="section" aria-labelledby="findings-title">
      <div className="section-header">
        <div>
          <p className="sec-eye">hallazgos reproducibles</p>
          <h2 id="findings-title" className="sec-title">Reglas activadas sobre el dataset.</h2>
        </div>
      </div>

      <p className="section-note">
        Estos hallazgos son la salida verificable del motor. Cada fila indica la regla activada, la columna afectada,
        cuántos registros toca y qué evidencia observó AURA.
      </p>

      <div className="benchmark-table-wrap mt-6">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Severidad</th>
              <th>Regla</th>
              <th>Familia</th>
              <th>Columna</th>
              <th>Filas</th>
              <th>%</th>
              <th>Evidencia</th>
              <th>Lectura</th>
            </tr>
          </thead>
          <tbody>
            {sortedIssues.length === 0 && (
              <tr>
                <td colSpan={8} className="benchmark-empty">No se activaron reglas de validación.</td>
              </tr>
            )}
            {sortedIssues.map((issue) => (
              <tr key={issue.id}>
                <td>
                  <span className={`benchmark-status benchmark-status-${issue.severity}`}>
                    {severityIcon[issue.severity]}
                    {severityLabel[issue.severity]}
                  </span>
                </td>
                <td>
                  <strong>{issue.ruleName}</strong>
                  <span>{issue.description}</span>
                </td>
                <td>{issue.category}</td>
                <td>{issue.column || 'dataset'}</td>
                <td>{issue.count.toLocaleString('es-CO')} / {rowCount.toLocaleString('es-CO')}</td>
                <td>{issue.affectedPercentage.toFixed(2)}%</td>
                <td>{sampleText(issue.sampleValues)}</td>
                <td>{explainImpact(issue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default FindingsTable;

