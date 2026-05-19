import React from 'react';
import { Cpu } from 'lucide-react';
import { QualityIssue, IssueSeverity, IssueCategory } from '../types';

interface RuleActivationMatrixProps {
  issues: QualityIssue[];
}

const categoryConfig: Record<string, string> = {
  [IssueCategory.INTEGRITY]: 'INTEGRIDAD',
  [IssueCategory.HYGIENE]:   'HIGIENE',
  [IssueCategory.TYPES]:     'TIPOS',
  [IssueCategory.LOGIC]:     'LÓGICA',
  [IssueCategory.SEMANTIC]:  'SEMÁNTICA',
};

const categoryColor = (cat: string): string => {
  switch (cat) {
    case IssueCategory.INTEGRITY: return '#e74c3c';
    case IssueCategory.HYGIENE:   return '#f39c12';
    case IssueCategory.TYPES:     return '#3498db';
    case IssueCategory.LOGIC:     return '#9b59b6';
    case IssueCategory.SEMANTIC:  return '#e67e22';
    default: return 'var(--ink2)';
  }
};

const RULES_ID_MAP: Record<string, string> = {
  'Filas Duplicadas': 'R01',
  'Valores Nulos / Vacíos': 'R02',
  'Columna Constante': 'R03',
  'Tipos Mixtos (Dirty Object)': 'R04',
  'Espacios Fantasma (Trim)': 'R05',
  'Mojibake / Encoding Roto': 'R06',
  'Caos de Capitalización': 'R07',
  'Placeholders Tóxicos': 'R08',
  'Desbordamiento de Texto': 'R09',
  'Números Disfrazados': 'R10',
  'Fechas Ocultas': 'R11',
  'IDs Corruptos (Float)': 'R12',
  'Hora Redundante': 'R13',
  'Negativos Imposibles': 'R14',
  'Outliers Extremos (IQR)': 'R15',
  'Incoherencia Temporal': 'R16',
  'Formato Email Inválido': 'R17',
  'Longitud de Teléfonos': 'R18',
  'Datos Sensibles (PII)': 'R19',
  'Espacios Múltiples': 'R20',
  'URL con Formato Erróneo': 'R21',
  'Símbolos Sospechosos': 'R22',
  'Redundancia Temporal Derivable': 'R23',
};

const getRuleId = (ruleName: string): string => {
  return RULES_ID_MAP[ruleName] || 'R??';
};

const RuleActivationMatrix: React.FC<RuleActivationMatrixProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className="rule-matrix rule-matrix--empty">
        <div className="rule-matrix-empty-icon">
          <Cpu size={24} />
        </div>
        <p className="rule-matrix-empty-title">Sin reglas activadas</p>
        <p className="rule-matrix-empty-desc">
          El motor no encontró hallazgos estructurales en las familias aplicadas.
        </p>
      </div>
    );
  }

  const byCategory = issues.reduce((acc, issue) => {
    const cat = issue.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {} as Record<string, QualityIssue[]>);

  const categoryOrder = [
    IssueCategory.INTEGRITY,
    IssueCategory.HYGIENE,
    IssueCategory.TYPES,
    IssueCategory.LOGIC,
    IssueCategory.SEMANTIC,
  ].filter(cat => byCategory[cat]);

  const totalByCat = categoryOrder.map(cat => ({
    cat,
    count: byCategory[cat].length,
    critical: byCategory[cat].filter(i => i.severity === IssueSeverity.CRITICAL).length,
    warning: byCategory[cat].filter(i => i.severity === IssueSeverity.WARNING).length,
    info: byCategory[cat].filter(i => i.severity === IssueSeverity.INFO).length,
    affectedColumns: new Set(byCategory[cat].map(i => i.column).filter(Boolean)).size,
    rules: Array.from(new Set(byCategory[cat].map(i => `${getRuleId(i.ruleName)} ${i.ruleName}`))).slice(0, 4),
  }));

  const totalCritical = issues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
  const totalAffectedRows = issues.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <div className="rule-matrix">
      <div className="rule-matrix-header">
        <div className="rule-matrix-title">
          <Cpu size={14} />
          <span>COBERTURA DE REGLAS — {issues.length} ACTIVACIONES</span>
        </div>
        <p className="rule-matrix-subtitle">
          La matriz de activación no es otra tabla de hallazgos. Resume qué familias del motor se activaron,
          cuántas reglas dispararon y dónde hay más riesgo. El detalle completo queda en el reporte exportable.
        </p>
      </div>

      <div className="rule-coverage-metrics">
        <div><span>activaciones</span><strong>{issues.length}</strong></div>
        <div><span>críticas</span><strong>{totalCritical}</strong></div>
        <div><span>familias</span><strong>{categoryOrder.length}</strong></div>
        <div><span>matches acumulados</span><strong>{totalAffectedRows.toLocaleString('es-CO')}</strong></div>
      </div>

      <div className="rule-coverage-grid">
        {totalByCat.map(({ cat, count, critical, warning, info, affectedColumns, rules }) => (
          <div key={cat} className="rule-coverage-card" style={{ borderTopColor: categoryColor(cat) }}>
            <div className="rule-coverage-card-head">
              <span style={{ color: categoryColor(cat) }}>{categoryConfig[cat]}</span>
              <strong>{count}</strong>
            </div>
            <div className="rule-coverage-card-stats">
              <span>{critical} crit</span>
              <span>{warning} adv</span>
              <span>{info} info</span>
              <span>{affectedColumns} col</span>
            </div>
            <div className="rule-coverage-rules">
              {rules.map(rule => <code key={rule}>{rule}</code>)}
              {count > rules.length && <small>+{count - rules.length} reglas adicionales en reporte</small>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RuleActivationMatrix;
