/**
 * DatasetProfile — Estadísticas completas del dataset en Step 1
 *
 * Muestra TODAS las métricas del dataset sin truncamiento.
 * Este panel es la primera sección visible del perfil del dataset.
 *
 * Incluye:
 * - Dimensiones (filas, columnas)
 * - Delimitador y encoding
 * - Distribución de tipos por columna
 * - Distribución de severidad de issues
 * - Score global + breakdown por categoría
 * - Fingerprint del dataset
 * - Memoria aproximada del CSV
 * - Distribución de nulos total
 */

import React from 'react';
import { Database, Columns3, FileSpreadsheet, Hash, AlertTriangle, CheckCircle, Info, AlertCircle, Fingerprint, Clock, Zap, Cpu } from 'lucide-react';
import { AuditReport, IssueCategory, IssueSeverity } from '../types';

interface DatasetProfileProps {
  report: AuditReport;
  fileName?: string;
  fileSize?: number;
  parseDurationMs: number;
  auditDurationMs: number;
  datasetFingerprint: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const countByCategory = (report: AuditReport) => {
  const cats = {} as Record<string, number>;
  report.issues.forEach(i => {
    cats[i.category] = (cats[i.category] || 0) + 1;
  });
  return cats;
};

const countBySeverity = (report: AuditReport) => ({
  critical: report.issues.filter(i => i.severity === IssueSeverity.CRITICAL).length,
  warning: report.issues.filter(i => i.severity === IssueSeverity.WARNING).length,
  info: report.issues.filter(i => i.severity === IssueSeverity.INFO).length,
});

const severityIcon = (sev: 'critical' | 'warning' | 'info') => {
  switch (sev) {
    case 'critical': return <AlertCircle size={12} />;
    case 'warning': return <AlertTriangle size={12} />;
    case 'info': return <Info size={12} />;
  }
};

const severityColor = (sev: 'critical' | 'warning' | 'info') => {
  switch (sev) {
    case 'critical': return 'var(--error)';
    case 'warning': return 'var(--orange)';
    case 'info': return 'var(--blue)';
  }
};

const categoryColor = (cat: string) => {
  switch (cat) {
    case IssueCategory.INTEGRITY: return '#e74c3c';
    case IssueCategory.HYGIENE: return '#f39c12';
    case IssueCategory.TYPES: return '#3498db';
    case IssueCategory.LOGIC: return '#9b59b6';
    case IssueCategory.SEMANTIC: return '#e67e22';
    default: return 'var(--ink2)';
  }
};

const DatasetProfile: React.FC<DatasetProfileProps> = ({
  report,
  fileName,
  fileSize,
  parseDurationMs,
  auditDurationMs,
  datasetFingerprint,
}) => {
  const bySeverity = countBySeverity(report);
  const byCategory = countByCategory(report);
  const totalIssues = report.issues.length;
  const colCount = Object.keys(report.columnStats).length;

  const nullCounts = Object.values(report.columnStats).map(c => c.nullCount);
  const totalNulls = nullCounts.reduce((a, b) => a + b, 0);
  const totalCells = report.rowCount * report.colCount;
  const nullPercentage = ((totalNulls / totalCells) * 100).toFixed(2);

  const numericCols = Object.values(report.columnStats).filter(c => c.inferredType === 'number');
  const stringCols = Object.values(report.columnStats).filter(c => c.inferredType === 'string');
  const dateCols = Object.values(report.columnStats).filter(c => c.inferredType === 'date');
  const boolCols = Object.values(report.columnStats).filter(c => c.inferredType === 'boolean');
  const mixedCols = Object.values(report.columnStats).filter(c => c.inferredType === 'mixed');

  const semanticTypes = Object.values(report.columnStats).filter(c => c.semanticType);
  const colsWithIQR = Object.values(report.columnStats).filter(c => c.iqr !== undefined && c.iqr > 0);

  const scoreColor = report.score >= 80 ? 'var(--success)' : report.score >= 60 ? 'var(--orange)' : 'var(--error)';

  return (
    <div className="dataset-profile">
      {/* ── Header ── */}
      <div className="dataset-profile-header">
        <div className="profile-title-row">
          <Database size={16} />
          <span className="profile-title">PERFIL COMPLETO DEL DATASET</span>
          {fileName && <code className="profile-filename">{fileName}</code>}
        </div>
        <code className="profile-fingerprint" title="Fingerprint del dataset">
          <Fingerprint size={10} /> {datasetFingerprint}
        </code>
      </div>

      {/* ── Grid principal ── */}
      <div className="profile-grid">

        {/* Dimensiones */}
        <div className="profile-card profile-card--dimensions">
          <div className="profile-card-label">
            <FileSpreadsheet size={12} />
            DIMENSIONES
          </div>
          <div className="profile-stats-row">
            <div className="profile-stat">
              <span className="profile-stat-val">{report.rowCount.toLocaleString('es-CO')}</span>
              <span className="profile-stat-lbl">filas</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">{colCount}</span>
              <span className="profile-stat-lbl">columnas</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">{totalCells.toLocaleString('es-CO')}</span>
              <span className="profile-stat-lbl">celdas total</span>
            </div>
          </div>
          <div className="profile-meta-row">
            {fileSize && <span>csv: {formatBytes(fileSize)}</span>}
            <span>delimiter: <code>{report.delimiterDetected === ',' ? 'coma (,)' : `"${report.delimiterDetected}"`}</code></span>
          </div>
        </div>

        {/* Score Global */}
        <div className="profile-card profile-card--score" style={{ '--score-color': scoreColor } as React.CSSProperties}>
          <div className="profile-card-label">
            <Zap size={12} />
            SCORE DE CALIDAD
          </div>
          <div className="profile-score-display">
            <span className="profile-score-num" style={{ color: scoreColor }}>{report.score}</span>
            <span className="profile-score-pct">%</span>
          </div>
          <div className="profile-score-bar">
            <div className="profile-score-fill" style={{ width: `${report.score}%`, background: scoreColor }} />
          </div>
          <p className="profile-score-note">
            {report.score >= 80 ? 'Dataset consistente para análisis.' :
             report.score >= 60 ? 'Requiere limpieza antes de usar.' :
             'Dataset con problemas críticos. Limpieza necesaria.'}
          </p>
        </div>

        {/* Issues por Severidad */}
        <div className="profile-card">
          <div className="profile-card-label">
            <AlertTriangle size={12} />
            ISSUES POR SEVERIDAD
          </div>
          <div className="profile-severity-bars">
            {(['critical', 'warning', 'info'] as const).map(sev => (
              <div key={sev} className="profile-severity-row">
                <span className="profile-sev-icon" style={{ color: severityColor(sev) }}>
                  {severityIcon(sev)}
                </span>
                <span className="profile-sev-label">{sev}</span>
                <span className="profile-sev-count" style={{ color: severityColor(sev) }}>
                  {bySeverity[sev]}
                </span>
                <div className="profile-sev-bar-bg">
                  <div
                    className="profile-sev-bar-fill"
                    style={{
                      width: totalIssues > 0 ? `${(bySeverity[sev] / totalIssues) * 100}%` : '0%',
                      background: severityColor(sev)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issues por Categoría */}
        <div className="profile-card">
          <div className="profile-card-label">
            <Cpu size={12} />
            ISSUES POR CATEGORÍA
          </div>
          <div className="profile-category-list">
            {Object.entries(byCategory).map(([cat, count]) => (
              <div key={cat} className="profile-category-row">
                <span className="profile-cat-dot" style={{ background: categoryColor(cat) }} />
                <span className="profile-cat-label">{cat}</span>
                <span className="profile-cat-count">{count}</span>
              </div>
            ))}
            {totalIssues === 0 && (
              <p className="profile-empty">Sin anomalías detectadas</p>
            )}
          </div>
        </div>

        {/* Tipos de Columnas */}
        <div className="profile-card">
          <div className="profile-card-label">
            <Columns3 size={12} />
            DISTRIBUCIÓN DE TIPOS
          </div>
          <div className="profile-type-grid">
            {numericCols.length > 0 && (
              <div className="profile-type-chip profile-type-chip--number">
                <span className="chip-val">{numericCols.length}</span>
                <span className="chip-lbl">numéricas</span>
              </div>
            )}
            {stringCols.length > 0 && (
              <div className="profile-type-chip profile-type-chip--string">
                <span className="chip-val">{stringCols.length}</span>
                <span className="chip-lbl">texto</span>
              </div>
            )}
            {dateCols.length > 0 && (
              <div className="profile-type-chip profile-type-chip--date">
                <span className="chip-val">{dateCols.length}</span>
                <span className="chip-lbl">fecha</span>
              </div>
            )}
            {boolCols.length > 0 && (
              <div className="profile-type-chip profile-type-chip--bool">
                <span className="chip-val">{boolCols.length}</span>
                <span className="chip-lbl">booleano</span>
              </div>
            )}
            {mixedCols.length > 0 && (
              <div className="profile-type-chip profile-type-chip--mixed">
                <span className="chip-val">{mixedCols.length}</span>
                <span className="chip-lbl">mixto</span>
              </div>
            )}
            {semanticTypes.length > 0 && (
              <div className="profile-type-chip profile-type-chip--semantic">
                <span className="chip-val">{semanticTypes.length}</span>
                <span className="chip-lbl">semánticos</span>
              </div>
            )}
          </div>
          <p className="profile-type-note">
            {colsWithIQR.length} columnas con IQR calculado
          </p>
        </div>

        {/* Nulos y Duplicados */}
        <div className="profile-card">
          <div className="profile-card-label">
            <Hash size={12} />
            NULOS Y DUPLICADOS
          </div>
          <div className="profile-nulls-grid">
            <div className="profile-nulls-row">
              <span>Nulos totales</span>
              <span className="profile-nulls-val">{totalNulls.toLocaleString('es-CO')}</span>
            </div>
            <div className="profile-nulls-row">
              <span>% Nulos</span>
              <span className="profile-nulls-val">{nullPercentage}%</span>
            </div>
            <div className="profile-nulls-row">
              <span>Duplicados exactos</span>
              <span className="profile-nulls-val">{report.duplicateRows.toLocaleString('es-CO')}</span>
            </div>
            <div className="profile-nulls-row">
              <span>% Duplicados</span>
              <span className="profile-nulls-val">
                {report.rowCount > 0 ? ((report.duplicateRows / report.rowCount) * 100).toFixed(2) : '0.00'}%
              </span>
            </div>
          </div>
        </div>

        {/* Tiempos de ejecución */}
        <div className="profile-card">
          <div className="profile-card-label">
            <Clock size={12} />
            RENDIMIENTO
          </div>
          <div className="profile-timing-grid">
            <div className="profile-timing-row">
              <span>CSV parsing</span>
              <code className="profile-timing-val">{parseDurationMs}ms</code>
            </div>
            <div className="profile-timing-row">
              <span>Auditoría reglas</span>
              <code className="profile-timing-val">{auditDurationMs}ms</code>
            </div>
            <div className="profile-timing-row">
              <span>Total proceso</span>
              <code className="profile-timing-val">{parseDurationMs + auditDurationMs}ms</code>
            </div>
            <div className="profile-timing-row">
              <span>Rendimiento</span>
              <code className="profile-timing-val">
                {report.rowCount > 0 ? Math.round(report.rowCount / ((parseDurationMs + auditDurationMs) / 1000)).toLocaleString('es-CO') : 0} filas/s
              </code>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DatasetProfile;
