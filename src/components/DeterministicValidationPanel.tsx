import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Target, Activity } from 'lucide-react';
import { DeterministicValidationReport, IssueCategory, PerRuleMetrics } from '../types';

interface DeterministicValidationPanelProps {
  validationReport: DeterministicValidationReport;
}

const categoryColor = (category: IssueCategory): string => {
  switch (category) {
    case IssueCategory.INTEGRITY: return 'var(--error)';
    case IssueCategory.HYGIENE: return 'var(--orange)';
    case IssueCategory.TYPES: return 'var(--blue)';
    case IssueCategory.LOGIC: return '#9b59b6';
    case IssueCategory.SEMANTIC: return '#e67e22';
  }
};

const statusIcon = (status: PerRuleMetrics['status']) => {
  switch (status) {
    case 'match': return <CheckCircle2 size={13} color="var(--success)" />;
    case 'partial': return <AlertTriangle size={13} color="var(--orange)" />;
    case 'missed': return <XCircle size={13} color="var(--error)" />;
    case 'expected_fp': return <Info size={13} color="var(--orange)" />;
    case 'unexpected_fp': return <AlertTriangle size={13} color="var(--error)" />;
  }
};

const statusLabel = (status: PerRuleMetrics['status']) => {
  switch (status) {
    case 'match': return 'match';
    case 'partial': return 'parcial';
    case 'missed': return 'no detectado';
    case 'expected_fp': return 'FP documentado';
    case 'unexpected_fp': return 'FP inesperado';
  }
};

const DeterministicValidationPanel: React.FC<DeterministicValidationPanelProps> = ({ validationReport }) => {
  const [expanded, setExpanded] = useState(true);

  if (!validationReport.groundTruthMatched) {
    return (
      <section className="deterministic-validation" aria-labelledby="dv-no-gt-title">
        <div className="deterministic-validation-header">
          <Info size={14} />
          <span>VALIDACIÓN DETERMINISTA FORMAL</span>
        </div>
        <h3 id="dv-no-gt-title" className="deterministic-validation-title">
          Sin ground truth para este dataset
        </h3>
        <p className="deterministic-validation-desc">
          No se encontró un ground truth conocido para las columnas detectadas.
          Las métricas TP/FP/FN no pueden calcularse sin una referencia de lo que se esperaba detectar.
          El motor determinista igualmente aplica todas las reglas de forma reproducible.
        </p>
      </section>
    );
  }

  const { summary, perRuleMetrics } = validationReport;
  const macroF1Color = summary.macroF1 >= 0.8 ? 'var(--success)' : summary.macroF1 >= 0.6 ? 'var(--orange)' : 'var(--error)';

  const expectedRules = perRuleMetrics.filter((m) => m.status !== 'unexpected_fp');
  const unexpectedFPs = perRuleMetrics.filter((m) => m.status === 'unexpected_fp');

  return (
    <section className="deterministic-validation" data-matched="true" aria-labelledby="dv-title">
      <div className="deterministic-validation-header">
        <Target size={14} />
        <span>VALIDACIÓN DETERMINISTA FORMAL</span>
        <code className="dv-dataset-badge">{validationReport.datasetName}</code>
      </div>

      <h3 id="dv-title" className="deterministic-validation-title">
        Métricas por regla contra ground truth
      </h3>
      <p className="deterministic-validation-desc">
        Cada regla del motor determinista se compara con lo que se esperaba detectar.
        Esto permite cuantificar precisión, exhaustividad y F1 del perfilamiento automático.
      </p>

      {/* ── Summary Cards ── */}
      <div className="dv-macro-grid">
        <div className="dv-macro-card">
          <span className="dv-macro-label">Macro Precisión</span>
          <span className="dv-macro-value">{(summary.macroPrecision * 100).toFixed(1)}%</span>
          <span className="dv-macro-desc">Qué % de lo detectado era esperado</span>
        </div>
        <div className="dv-macro-card">
          <span className="dv-macro-label">Macro Recall</span>
          <span className="dv-macro-value">{(summary.macroRecall * 100).toFixed(1)}%</span>
          <span className="dv-macro-desc">Qué % de los errores reales se encontró</span>
        </div>
        <div className="dv-macro-card">
          <span className="dv-macro-label">Macro F1</span>
          <span className="dv-macro-value" style={{ color: macroF1Color }}>{(summary.macroF1 * 100).toFixed(1)}%</span>
          <span className="dv-macro-desc">Media armónica de P y R</span>
        </div>
        <div className="dv-macro-card">
          <span className="dv-macro-label">Conteo Global</span>
          <span className="dv-macro-value dv-macro-counts">
            <span style={{ color: 'var(--success)' }}>TP {summary.totalTP}</span>
            {' · '}
            <span style={{ color: 'var(--error)' }}>FP {summary.totalFP}</span>
            {' · '}
            <span style={{ color: 'var(--orange)' }}>FN {summary.totalFN}</span>
          </span>
          <span className="dv-macro-desc">Instancias clasificadas</span>
        </div>
      </div>

      {/* ── Status Summary Pills ── */}
      <div className="dv-status-pills">
        <span className="dv-pill dv-pill--match">
          <CheckCircle2 size={11} /> {summary.rulesMatched} match
        </span>
        {summary.rulesPartial > 0 && (
          <span className="dv-pill dv-pill--partial">
            <AlertTriangle size={11} /> {summary.rulesPartial} parcial
          </span>
        )}
        {summary.rulesMissed > 0 && (
          <span className="dv-pill dv-pill--missed">
            <XCircle size={11} /> {summary.rulesMissed} no detectado
          </span>
        )}
        {summary.rulesUnexpectedFP > 0 && (
          <span className="dv-pill dv-pill--unexpected">
            <AlertTriangle size={11} /> {summary.rulesUnexpectedFP} FP inesperado
          </span>
        )}
      </div>

      {/* ── Toggle Detail ── */}
      <button className="dv-toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Ocultar detalle por regla' : 'Ver detalle por regla'}
        <span className="dv-toggle-arrow" style={{ transform: expanded ? 'rotate(180deg)' : undefined }}>▾</span>
      </button>

      {/* ── Per-Rule Table ── */}
      {expanded && (
        <div className="dv-table-wrapper">
          <table className="dv-table">
            <thead>
              <tr>
                <th>Regla</th>
                <th>Categoría</th>
                <th>Esperado</th>
                <th>Detectado</th>
                <th>TP</th>
                <th>FP</th>
                <th>FN</th>
                <th>Prec.</th>
                <th>Recall</th>
                <th>F1</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {expectedRules.map((row) => (
                <tr key={row.ruleId} className={`dv-row dv-row--${row.status}`}>
                  <td className="dv-cell-rule" title={row.ruleId}>{row.ruleName}</td>
                  <td>
                    <span className="dv-cat-dot" style={{ background: categoryColor(row.category) }} />
                    {row.category === IssueCategory.INTEGRITY ? 'Integridad' :
                     row.category === IssueCategory.HYGIENE ? 'Higiene' :
                     row.category === IssueCategory.TYPES ? 'Tipos' :
                     row.category === IssueCategory.LOGIC ? 'Lógica' : 'Semántica'}
                  </td>
                  <td className="dv-cell-num">{row.expectedTP}</td>
                  <td className="dv-cell-num">{row.actualDetected}</td>
                  <td className="dv-cell-num dv-cell-tp">{row.tp}</td>
                  <td className="dv-cell-num dv-cell-fp">{row.fp}</td>
                  <td className="dv-cell-num dv-cell-fn">{row.fn}</td>
                  <td className="dv-cell-num">{(row.precision * 100).toFixed(0)}%</td>
                  <td className="dv-cell-num">{(row.recall * 100).toFixed(0)}%</td>
                  <td className="dv-cell-num">{(row.f1 * 100).toFixed(0)}%</td>
                  <td className="dv-cell-status">
                    {statusIcon(row.status)}
                    <span>{statusLabel(row.status)}</span>
                  </td>
                </tr>
              ))}
              {unexpectedFPs.map((row) => (
                <tr key={row.ruleId} className="dv-row dv-row--unexpected_fp">
                  <td className="dv-cell-rule" title={row.ruleId} colSpan={2}>{row.ruleName}</td>
                  <td className="dv-cell-num">0</td>
                  <td className="dv-cell-num">{row.actualDetected}</td>
                  <td className="dv-cell-num dv-cell-tp">0</td>
                  <td className="dv-cell-num dv-cell-fp">{row.fp}</td>
                  <td className="dv-cell-num dv-cell-fn">0</td>
                  <td className="dv-cell-num">0%</td>
                  <td className="dv-cell-num">100%</td>
                  <td className="dv-cell-num">0%</td>
                  <td className="dv-cell-status">
                    {statusIcon(row.status)}
                    <span>{statusLabel(row.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default DeterministicValidationPanel;
