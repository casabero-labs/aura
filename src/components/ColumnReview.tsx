import React, { useEffect, useRef, useState } from 'react';
import ColumnStatsPanel from './ColumnStatsPanel';
import { type AuditReport, type QualityIssue, IssueSeverity } from '../types';

const typeNames = { string: 'Texto', number: 'Números', boolean: 'Sí o no', date: 'Fechas', mixed: 'Tipos mezclados' };
const showValue = (value: unknown) => {
  if (value == null) return '(nulo)';
  if (value === '') return '(vacío)';
  if (typeof value === 'string' && !value.trim()) return '(solo espacios)';
  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 160)}… (valor recortado)` : text;
};
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ColumnReview({ report, issueName, renderEvidence }: {
  report: AuditReport;
  issueName: (issue: QualityIssue) => string;
  renderEvidence: (issue: QualityIssue) => React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const columns = Object.values(report.columnStats);
  const visible = columns.filter(column => fold(column.name).includes(fold(query)));
  const selected = report.columnStats[selectedName];
  const findings = report.issues.filter(issue => issue.column === selectedName).sort((a, b) => {
    const weight = { critical: 0, warning: 1, info: 2, good: 3 };
    return weight[a.severity] - weight[b.severity];
  });
  useEffect(() => {
    if (selectedName && detailTitle.current) {
      detailTitle.current.focus({ preventScroll: true });
      detailTitle.current.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    }
  }, [selectedName]);

  return <div className="column-review" data-testid="profile-column-table">
    <p className="profile-reading-note">Cada fila es una columna del archivo. «Con datos» indica cuántos registros tienen un valor; «Avisos» cuenta las reglas que señalaron algo en esa columna.</p>
    {columns.length > 12 && <div className="column-review-search"><label htmlFor="column-review-search">Buscar columna</label><input id="column-review-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setSelectedName(''); }} /></div>}
    {!!visible.length ? <div className="table-scroll" role="region" aria-label="Columnas del archivo" tabIndex={0}>
      <table className="editorial-data-table column-review-table">
        <thead><tr><th scope="col">Columna</th><th scope="col">Con datos</th><th scope="col">Avisos</th><th scope="col">Detalle</th></tr></thead>
        <tbody>{visible.map(column => {
          const count = report.issues.filter(issue => issue.column === column.name).length;
          return <tr key={column.name}><th scope="row">{column.name}</th><td>{report.rowCount - column.nullCount} de {report.rowCount}</td><td>{count}</td>
            <td><button type="button" className="btn-s btn-sm" aria-label={`Ver columna ${column.name}`} aria-current={selectedName === column.name ? 'true' : undefined} onClick={() => setSelectedName(column.name)}>Ver</button></td></tr>;
        })}</tbody>
      </table>
    </div> : <div><p>No hay columnas con ese nombre.</p><button type="button" className="btn-s btn-sm" onClick={() => setQuery('')}>Mostrar todas las columnas</button></div>}

    {selected && <section key={selectedName} className="column-review-detail" aria-labelledby="column-review-title" data-testid="profile-column-detail">
      <div className="column-review-heading"><h2 id="column-review-title" ref={detailTitle} tabIndex={-1}>{selected.name}</h2><button type="button" className="btn-s btn-sm" onClick={() => { setSelectedName(''); const buttons = document.querySelectorAll<HTMLButtonElement>('.column-review-table button'); Array.from(buttons).find(button => button.getAttribute('aria-label') === `Ver columna ${selectedName}`)?.focus(); }}>Cerrar detalle</button></div>
      <p className="column-review-type">Tipo estimado: {typeNames[selected.inferredType] ?? 'Sin determinar'}. El tipo no garantiza que todos los valores sean válidos.</p>
      <p>{selected.nullCount ? `${selected.nullCount} de ${report.rowCount} registros están sin dato.` : `Los ${report.rowCount} registros tienen un valor.`} Hay {selected.uniqueCount} valores diferentes.</p>

      <h3>Ejemplos del archivo</h3>
      {selected.sampleValues?.length ? <ul className="column-review-examples">{selected.sampleValues.slice(0, 5).map((value, index) => <li key={index}>{showValue(value)}</li>)}</ul> : <p>No hay ejemplos disponibles en este informe.</p>}
      <p className="profile-reading-note">Se muestran hasta cinco valores de muestra; no son todos los registros.</p>

      <h3>Avisos en esta columna</h3>
      {findings.length ? findings.map(issue => <details key={issue.id} className="column-review-issue"><summary>{issueName(issue)} <span>{issue.severity === IssueSeverity.CRITICAL ? '· Prioritario' : issue.severity === IssueSeverity.INFO ? '· Informativo' : '· Para revisar'}</span></summary>{renderEvidence(issue)}</details>) : <p>Las reglas evaluadas no señalaron avisos en esta columna.</p>}

      <details className="column-review-calculations"><summary>Ver cálculos estadísticos</summary>
        <p className="profile-reading-note">Aquí puedes consultar frecuencias, medidas numéricas y criterios de valores extremos. Son estadísticas, no decisiones de corrección.</p>
        <ColumnStatsPanel columnStats={{ [selected.name]: selected }} totalRows={report.rowCount} initiallyExpanded compact />
      </details>
    </section>}
  </div>;
}
