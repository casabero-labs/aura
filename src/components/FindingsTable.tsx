import React, { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { IssueCategory, IssueSeverity, QualityIssue } from '../types';

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

const explainImpact = (issue: QualityIssue) => {
  if (issue.severity === IssueSeverity.CRITICAL) return 'Puede invalidar análisis o requerir revisión antes de usar la columna.';
  if (issue.severity === IssueSeverity.WARNING) return 'Puede introducir ruido, sesgo o inconsistencias si no se revisa.';
  return 'Señal de calidad útil para caracterizar el dataset y decidir acciones posteriores.';
};

const suggestAction = (issue: QualityIssue) => {
  if (issue.severity === IssueSeverity.CRITICAL) return 'Revisar antes de usar';
  if (issue.severity === IssueSeverity.WARNING) return 'Validar impacto';
  return issue.category === IssueCategory.TYPES ? 'Documentar tipo' : 'Normalizar si aplica';
};

const sampleText = (issue: QualityIssue) => {
  if (issue.sampleValues.length) {
    return issue.sampleValues.slice(0, 3).map((value) => JSON.stringify(value)).join(' · ');
  }
  if (issue.evidenceNote) return 'Sin muestra disponible';
  return 'Muestra pendiente de instrumentación';
};

const FindingsTable: React.FC<FindingsTableProps> = ({ issues, rowCount }) => {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [columnFilter, setColumnFilter] = useState('all');

  const columns = useMemo(() =>
    Array.from(new Set(issues.map((issue) => issue.column).filter(Boolean) as string[])).sort(),
    [issues]
  );
  const categories = useMemo(() =>
    Array.from(new Set(issues.map((issue) => issue.category))).sort(),
    [issues]
  );

  const filteredIssues = useMemo(() => issues.filter((issue) => {
    const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
    const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter;
    const matchesColumn = columnFilter === 'all' || issue.column === columnFilter;
    return matchesSeverity && matchesCategory && matchesColumn;
  }), [categoryFilter, columnFilter, issues, severityFilter]);

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const weight = { [IssueSeverity.CRITICAL]: 0, [IssueSeverity.WARNING]: 1, [IssueSeverity.INFO]: 2, [IssueSeverity.GOOD]: 3 };
    return weight[a.severity] - weight[b.severity] || b.affectedPercentage - a.affectedPercentage;
  });
  const criticalCount = issues.filter((issue) => issue.severity === IssueSeverity.CRITICAL).length;
  const warningCount = issues.filter((issue) => issue.severity === IssueSeverity.WARNING).length;
  const affectedColumns = columns.length;
  const topRule = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.ruleName] = (acc[issue.ruleName] || 0) + 1;
    return acc;
  }, {});
  const topRuleName = Object.entries(topRule).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sin activaciones';

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

      <div className="findings-summary">
        <div>
          <span>hallazgos</span>
          <strong>{issues.length}</strong>
        </div>
        <div>
          <span>críticos</span>
          <strong>{criticalCount}</strong>
        </div>
        <div>
          <span>advertencias</span>
          <strong>{warningCount}</strong>
        </div>
        <div>
          <span>columnas afectadas</span>
          <strong>{affectedColumns}</strong>
        </div>
        <div>
          <span>regla más repetida</span>
          <strong>{topRuleName}</strong>
        </div>
      </div>

      <div className="findings-filters" aria-label="Filtros de hallazgos">
        <span className="findings-filter-label"><Filter size={12} /> filtrar</span>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} aria-label="Filtrar por severidad">
          <option value="all">Todas las severidades</option>
          <option value={IssueSeverity.CRITICAL}>Críticos</option>
          <option value={IssueSeverity.WARNING}>Advertencias</option>
          <option value={IssueSeverity.INFO}>Informativos</option>
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por familia">
          <option value="all">Todas las familias</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={columnFilter} onChange={(event) => setColumnFilter(event.target.value)} aria-label="Filtrar por columna">
          <option value="all">Todas las columnas</option>
          {columns.map((column) => <option key={column} value={column}>{column}</option>)}
        </select>
      </div>

      <div className="findings-card-list">
        {sortedIssues.length === 0 && (
          <div className="findings-empty">No hay hallazgos para los filtros seleccionados.</div>
        )}
        {sortedIssues.map((issue) => (
          <article key={issue.id} className={`finding-card finding-card-${issue.severity}`}>
            <div className="finding-card-summary">
              <span className={`benchmark-status benchmark-status-${issue.severity}`}>
                {severityLabel[issue.severity]}
              </span>
              <span className="finding-card-main">
                <strong>{issue.ruleName}</strong>
                <small>{issue.description}</small>
              </span>
              <span className="finding-card-meta">
                <code>{issue.column || 'dataset'}</code>
                <span>{issue.count.toLocaleString('es-CO')} / {rowCount.toLocaleString('es-CO')}</span>
                <span>{issue.affectedPercentage.toFixed(2)}%</span>
              </span>
            </div>
            <div className="finding-card-body">
              <span>{issue.category}</span>
              <span>Evidencia: {sampleText(issue)}</span>
              <span>{suggestAction(issue)} · {explainImpact(issue)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default FindingsTable;
