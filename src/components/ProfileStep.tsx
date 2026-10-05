import React, { useEffect, useMemo, useState } from 'react';
import { AppliedDatasetRules } from './DatasetRulesEditor';
import ColumnStatsPanel from './ColumnStatsPanel';
import IngestionEvidenceCard from './IngestionEvidenceCard';
import { AuditExecutionEvidence, AuditReport, DeterministicValidationReport, IssueSeverity, QualityIssue, RULE_IDS } from '../types';
import { formatAffectedShare } from '../services/issuePresentation';

const describeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '(nulo)';
  if (value === '') return '(vacío)';
  if (typeof value === 'string' && !value.trim()) return '(solo espacios)';
  const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
  return text.length > 160 ? `${text.slice(0, 160)}… (valor recortado)` : text;
};

const readableNames: Record<string, string> = {
  [RULE_IDS.INVALID_EMAIL]: 'Correos con formato inválido',
  [RULE_IDS.INVALID_DATE]: 'Fechas que no existen o no son válidas',
  [RULE_IDS.IMPOSSIBLE_NEGATIVES]: 'Valores negativos que requieren revisión',
  [RULE_IDS.NULL_VALUES]: 'Valores faltantes',
  [RULE_IDS.DUPLICATE_KEY]: 'Identificadores repetidos',
  [RULE_IDS.EXACT_DUPLICATES]: 'Registros completos repetidos',
  [RULE_IDS.DOMAIN_VALUES]: 'Valores fuera de la lista permitida',
  [RULE_IDS.DOMAIN_NUMBER]: 'Números fuera de las condiciones elegidas',
  [RULE_IDS.FUTURE_DATES]: 'Fechas futuras que requieren revisión',
  [RULE_IDS.PII_DETECTED]: 'Posibles datos sensibles',
};
const severityLabel = (severity: IssueSeverity) => severity === IssueSeverity.CRITICAL ? 'Prioritario' : severity === IssueSeverity.WARNING ? 'Para revisar' : 'Informativo';

const IssueEvidence = ({ issue }: { issue: QualityIssue }) => <div className="profile-issue-evidence">
  <p>{issue.description}</p>
  {issue.rowNumbers?.length ? <p>Registros: {issue.rowNumbers.join(', ')}{issue.rowNumbers.length < issue.count ? ' (muestra)' : ''}</p> : <p>Este aviso no incluye números de registro.</p>}
  {issue.rowEvidence?.length ? <div>
    {issue.rowEvidence.map(cell => <p key={cell.rowNumber}>Registro {cell.rowNumber}: <span className="profile-source-value">{describeCell(cell.value)}</span></p>)}
    {issue.count > issue.rowEvidence.length && <p>Se muestran {issue.rowEvidence.length} ejemplos de {issue.count} registros señalados.</p>}
  </div> : issue.sampleValues?.length ? <p>Valores de ejemplo: {issue.sampleValues.slice(0, 3).map(describeCell).join(' · ')}</p> : null}
  <p className="profile-reading-note">Los registros empiezan en 1, sin contar la cabecera. Son muestras de los valores originales.</p>
</div>;

interface ProfileStepProps {
  report: AuditReport | null;
  auditEvidence: AuditExecutionEvidence;
  deterministicValidation?: DeterministicValidationReport | null;
  file?: File | null;
  onContinue: () => void;
  onRetry?: () => void;
}

export default function ProfileStep({ report, auditEvidence, file, onContinue, onRetry }: ProfileStepProps) {
  const [selectedColumn, setSelectedColumn] = useState('');
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, []);
  const sorted = useMemo(() => [...(report?.issues ?? [])].sort((a, b) => {
    const weight = { [IssueSeverity.CRITICAL]: 0, [IssueSeverity.WARNING]: 1, [IssueSeverity.INFO]: 2 };
    return weight[a.severity] - weight[b.severity] || b.affectedPercentage - a.affectedPercentage;
  }), [report]);
  if (auditEvidence.ingestionStatus === 'error') return <div className="profile-step">
    <h1 className="profile-editorial-title">No se pudo leer el archivo</h1>
    <IngestionEvidenceCard evidence={auditEvidence} />
    <button className="btn-p" type="button" onClick={onRetry}>Seleccionar otro archivo</button>
  </div>;
  if (!report) return null;
  const critical = sorted.filter(issue => issue.severity === IssueSeverity.CRITICAL);
  const warnings = sorted.filter(issue => issue.severity === IssueSeverity.WARNING);
  const info = sorted.filter(issue => issue.severity === IssueSeverity.INFO);
  const first = (critical.length ? critical : warnings).slice(0, 3);
  const columns = Object.values(report.columnStats);
  const selected = report.columnStats[selectedColumn];
  const hasConditions = Object.values(report.auditRules ?? {}).some(rule => Object.keys(rule).length);

  return <div className="profile-step profile-simple">
    <header className="profile-editorial-header" data-testid="profile-hero">
      <h1 className="profile-editorial-title">Revisión inicial</h1>
      <p className="profile-file-identity">{file?.name || auditEvidence.fileName || 'Archivo analizado'} · {report.rowCount.toLocaleString('es-CO')} registros · {report.colCount} columnas</p>
      <p className="profile-editorial-desc">{critical.length ? `Hay ${critical.length} avisos prioritarios para revisar.` : warnings.length ? `Hay ${warnings.length} avisos para revisar.` : 'No se encontraron avisos prioritarios.'}</p>
      <p className="profile-reading-note">{sorted.length ? `${sorted.length} avisos en total: ${critical.length} prioritarios, ${warnings.length} para revisar y ${info.length} informativos. Un registro puede aparecer en varios avisos.` : 'No se detectaron problemas en las comprobaciones realizadas. Esto no garantiza que se haya evaluado toda condición posible.'}</p>
    </header>

    {!!first.length && <section className="profile-first-review" aria-labelledby="profile-first-title" data-testid="profile-first-review">
      <h2 id="profile-first-title">{critical.length ? 'Revisa primero' : 'Avisos para revisar'}</h2>
      {first.map(issue => <details className="profile-issue" key={issue.id} data-testid="profile-priority-item">
        <summary><span className="profile-issue-name">{readableNames[issue.ruleId] ?? issue.ruleName}</span><span className="profile-issue-meta">{issue.column || 'Archivo completo'} · {issue.count ? `${issue.count.toLocaleString('es-CO')} registro${issue.count === 1 ? '' : 's'} señalado${issue.count === 1 ? '' : 's'}` : 'Aviso sobre la estructura'} · Ver detalle</span></summary>
        <IssueEvidence issue={issue} />
      </details>)}
      <p className="profile-reading-note">{(critical.length || warnings.length) > first.length ? `Se muestran ${first.length} de ${critical.length || warnings.length} avisos de este nivel. Todos están disponibles más abajo. ` : ''}Estos avisos provienen de las reglas; no autorizan cambios automáticos.</p>
    </section>}

    <div className="profile-actions" data-testid="profile-actions">
      <button className="btn-p profile-actions-primary" type="button" data-testid="profile-continue-diagnosis" onClick={onContinue}>Ir al diagnóstico</button>
      <p className="profile-reading-note">Puedes ampliar la revisión antes de pasar al diagnóstico.</p>
    </div>

    <div className="profile-detail-options">
      {!!sorted.length && <details className="profile-disclosure" data-testid="profile-all-disclosure">
        <summary>Ver todos los {sorted.length} hallazgos</summary>
        <div className="profile-disclosure-body">
          <p className="profile-reading-note">Un hallazgo es un aviso de una regla en una columna o en el archivo. Los registros señalados pueden repetirse entre hallazgos.</p>
          <div className="table-scroll" role="region" aria-label="Todos los hallazgos" tabIndex={0}>
            <table className="editorial-data-table">
              <caption>Todos los hallazgos, ordenados por importancia</caption>
              <thead><tr><th scope="col">Hallazgo</th><th scope="col">Columna</th><th scope="col">Registros y evidencia</th><th scope="col">Clasificación</th></tr></thead>
              <tbody>{sorted.map(issue => <tr key={issue.id}>
                <th scope="row">{issue.ruleName}</th><td>{issue.column || 'Archivo completo'}</td>
                <td>{formatAffectedShare(issue.count, report.rowCount)} señalados<details className="profile-row-detail"><summary>Ver registros y valores</summary><IssueEvidence issue={issue} /></details></td>
                <td>{severityLabel(issue.severity)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="profile-reading-note">La clasificación indica la prioridad asignada por la regla, no un riesgo confirmado.</p>
        </div>
      </details>}

      <details className="profile-disclosure" data-testid="profile-tech-disclosure">
        <summary>Ver columnas y estadísticas ({columns.length})</summary>
        <div className="profile-disclosure-body" data-testid="profile-column-table">
          <p className="profile-reading-note">Elige una columna para ver sus datos y estadísticas. El tipo estimado no garantiza que todos sus valores sean válidos.</p>
          <div className="profile-column-picker"><label htmlFor="profile-column-select">Columna</label><select id="profile-column-select" value={selectedColumn} onChange={event => setSelectedColumn(event.target.value)}><option value="">Selecciona una columna</option>{columns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select></div>
          {selected && <div data-testid="profile-column-detail"><ColumnStatsPanel key={selected.name} columnStats={{ [selected.name]: selected }} totalRows={report.rowCount} issues={report.issues} initiallyExpanded compact /></div>}
        </div>
      </details>

      <details className="profile-disclosure" data-testid="profile-rules-disclosure">
        <summary>{hasConditions ? 'Ver las reglas y excepciones aplicadas' : 'Ver qué reglas se aplicaron'}</summary>
        <div className="profile-disclosure-body"><AppliedDatasetRules rules={report.auditRules} /></div>
      </details>

      <details className="profile-disclosure" data-testid="profile-score-disclosure">
        <summary>Puntuación orientativa: {report.score}/100 · Ver cálculo</summary>
        <div className="profile-disclosure-body">
          <h2>Cómo se calculó la puntuación</h2>
          <p>Parte de 100 y resta los puntos de las reglas. No es un porcentaje de datos correctos ni una medida de precisión.</p>
          <ul>{report.scoreBreakdown.map((deduction, index) => <li key={index}>{deduction.reason}: {deduction.points.toLocaleString('es-CO', { maximumFractionDigits: 2 })} puntos.</li>)}</ul>
          <p>Se suman estos puntos y se restan de 100. El resultado se redondea y queda entre 0 y 100: {report.score}/100.</p>
          {report.scoreVersion !== 'rules-v2' && <p>Este informe usa la fórmula anterior, con un ajuste por tamaño del archivo.</p>}
        </div>
      </details>
    </div>
  </div>;
}
