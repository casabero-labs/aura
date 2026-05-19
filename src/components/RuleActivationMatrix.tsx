/**
 * RuleActivationMatrix — Matriz completa de activación de reglas
 *
 * Muestra cada regla que se activó con:
 * - ID de regla (R01, R02, etc.) + nombre
 * - Categoría (Integridad, Higiene, Tipos, Lógica, Semántica)
 * - Severidad (CRITICAL, WARNING, INFO)
 * - Columna afectada
 * - Conteo de matches
 * - Porcentaje afectado
 * - Muestra de valores problemáticos (completa, sin truncar)
 * - Descripción de la anomalía
 *
 * Esta matriz es el output central del auditEngine.ts y es la base
 * para auditar qué reglas se activaron sobre el dataset.
 */

import React, { useState } from 'react';
import { Cpu, AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { QualityIssue, IssueSeverity, IssueCategory } from '../types';

interface RuleActivationMatrixProps {
  issues: QualityIssue[];
  rowCount: number;
}

const severityConfig = {
  [IssueSeverity.CRITICAL]: { color: 'var(--error)', bg: 'rgba(212,90,74,0.12)', icon: AlertCircle, label: 'CRIT' },
  [IssueSeverity.WARNING]:  { color: 'var(--orange)', bg: 'rgba(245,158,11,0.12)', icon: AlertTriangle, label: 'WARN' },
  [IssueSeverity.INFO]:     { color: 'var(--blue)', bg: 'rgba(96,165,250,0.12)', icon: Info, label: 'INFO' },
};

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

interface IssueDetailProps {
  issue: QualityIssue;
  rowCount: number;
  index: number;
}

const IssueDetail: React.FC<IssueDetailProps> = ({ issue, rowCount, index }) => {
  const [expanded, setExpanded] = useState(index < 3);
  const sev = severityConfig[issue.severity];
  const SevIcon = sev.icon;
  const pct = issue.affectedPercentage;

  return (
    <div
      className="rule-issue"
      style={{
        borderLeft: `3px solid ${sev.color}`,
        background: expanded ? sev.bg : 'transparent',
      }}
    >
      <button className="rule-issue-header" onClick={() => setExpanded(e => !e)}>
        <span className="rule-issue-chevron">
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <span className="rule-issue-id">{getRuleId(issue.ruleName)}</span>
        <span className="rule-issue-name">{issue.ruleName}</span>
        {issue.column && (
          <code className="rule-issue-col" title="Columna afectada">
            {issue.column}
          </code>
        )}
        <span
          className="rule-issue-sev"
          style={{ color: sev.color, background: sev.bg }}
          title={`Severidad: ${issue.severity}`}
        >
          <SevIcon size={10} /> {sev.label}
        </span>
        <span
          className="rule-issue-cat"
          style={{ color: categoryColor(issue.category) }}
          title={`Categoría: ${issue.category}`}
        >
          {categoryConfig[issue.category] || issue.category}
        </span>
        <span className="rule-issue-count">
          <span className="rule-issue-count-num">{issue.count.toLocaleString('es-CO')}</span>
          <span className="rule-issue-count-lbl">regs</span>
        </span>
        <span className="rule-issue-pct" style={{ color: pct > 50 ? sev.color : 'var(--ink2)' }}>
          {pct.toFixed(1)}%
        </span>
      </button>

      {expanded && (
        <div className="rule-issue-body">
          <p className="rule-issue-desc">{issue.description}</p>

          {issue.sampleValues && issue.sampleValues.length > 0 && (
            <div className="rule-issue-samples">
              <p className="rule-issue-samples-label">Muestra de valores problemáticos:</p>
              <div className="rule-issue-samples-grid">
                {issue.sampleValues.map((val, idx) => (
                  <code key={idx} className="rule-issue-sample-chip" title={String(val)}>
                    "{String(val)}"
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="rule-issue-meta">
            <span>Filas afectadas: <strong>{issue.count.toLocaleString('es-CO')}</strong></span>
            <span>Porcentaje: <strong>{pct.toFixed(2)}%</strong></span>
            <span>Categoría: <strong>{categoryConfig[issue.category] || issue.category}</strong></span>
            <span>Severidad: <strong style={{ color: sev.color }}>{issue.severity}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

const RuleActivationMatrix: React.FC<RuleActivationMatrixProps> = ({ issues, rowCount }) => {
  if (issues.length === 0) {
    return (
      <div className="rule-matrix rule-matrix--empty">
        <div className="rule-matrix-empty-icon">
          <Cpu size={24} />
        </div>
        <p className="rule-matrix-empty-title">Sin activación de reglas</p>
        <p className="rule-matrix-empty-desc">
          Ninguna anomalía estructural detectada. El dataset pasó todas las 23 reglas
          del motor determinista.
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
  }));

  const totalCritical = issues.filter(i => i.severity === IssueSeverity.CRITICAL).length;

  return (
    <div className="rule-matrix">
      <div className="rule-matrix-header">
        <div className="rule-matrix-title">
          <Cpu size={14} />
          <span>MATRIZ DE ACTIVACIÓN — {issues.length} REGLAS DISPARADAS</span>
        </div>
        <div className="rule-matrix-summary">
          {totalByCat.map(({ cat, count, critical }) => (
            <span
              key={cat}
              className="rule-matrix-cat-chip"
              style={{ borderColor: categoryColor(cat) }}
            >
              <span style={{ color: categoryColor(cat) }}>{categoryConfig[cat]}</span>
              <span>{count}</span>
              {critical > 0 && <span className="rule-matrix-crit-count">{critical} CRIT</span>}
            </span>
          ))}
        </div>
        <p className="rule-matrix-subtitle">
          Cada rule-issue expandible muestra: ID, nombre, columna, severidad, conteo,
          muestra de valores problemáticos y descripción completa. Sin truncamiento.
        </p>
      </div>

      <div className="rule-matrix-categories">
        {categoryOrder.map(cat => {
          const catIssues = byCategory[cat];
          return (
            <div key={cat} className="rule-matrix-category">
              <div className="rule-matrix-cat-header" style={{ borderLeftColor: categoryColor(cat) }}>
                <span className="rule-matrix-cat-name" style={{ color: categoryColor(cat) }}>
                  {categoryConfig[cat]}
                </span>
                <span className="rule-matrix-cat-count">{catIssues.length} reglas</span>
              </div>
              <div className="rule-matrix-cat-issues">
                {catIssues.map((issue, idx) => (
                  <IssueDetail
                    key={issue.id}
                    issue={issue}
                    rowCount={rowCount}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RuleActivationMatrix;
