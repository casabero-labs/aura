/**
 * ColumnStatsPanel — Perfil estadístico COMPLETO por columna
 *
 * Muestra TODAS las columnas con TODAS las estadísticas.
 * No oculta nada. Cada columna se expande para mostrar:
 * - Tipo inferido + tipo semántico
 * - Recuento de nulos, únicos, ceros
 * - Min, max, mean, median, std, q1, q3, iqr, fences, outliers
 * - Top 5 valores más frecuentes con frecuencias y porcentajes
 * - Muestra de valores (inicio, medio, fin)
 * - IQR outlier fence bounds
 *
 * Este panel resume la caracterización estadística por columna.
 */

import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Hash } from 'lucide-react';
import type { ColumnStats, QualityIssue } from '../types';

interface ColumnStatsPanelProps {
  columnStats: Record<string, ColumnStats>;
  totalRows?: number;
  issues?: QualityIssue[];
  initiallyExpanded?: boolean;
  compact?: boolean;
}

const LOCALE = 'es-ES';

export const formatNum = (n?: number | string, decimals = 2): string => {
  if (n === undefined || n === null) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return num.toLocaleString(LOCALE, { maximumFractionDigits: decimals });
};

const formatInt = (n: number): string => n.toLocaleString(LOCALE);

export const formatPct = (part: number, total: number): string => {
  const value = total === 0 ? 0 : (part / total) * 100;
  return value.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
};

type OutlierStatus = NonNullable<ColumnStats['outlierStatus']>;

/** Estado del recuento IQR; para estadísticas antiguas sin `outlierStatus` se deduce de `iqr`. */
export const resolveOutlierStatus = (col: ColumnStats): OutlierStatus | undefined => {
  if (col.outlierStatus) return col.outlierStatus;
  if (col.iqr === undefined) return undefined;
  return col.iqr > 0 ? 'computed' : 'iqr_zero';
};

/** Texto del recuento de atípicos: «n/a» cuando la cerca IQR no aplica. */
export const formatOutlierCount = (col: ColumnStats, count: number | undefined): string => {
  const status = resolveOutlierStatus(col);
  if (status === 'iqr_zero') return 'n/a — IQR = 0';
  if (status === 'too_few_values') return 'n/a — ≤ 10 valores';
  if (status === undefined || count === undefined) return '—';
  return formatInt(count);
};

const semanticLabel: Record<string, { label: string }> = {
  email:      { label: 'Email' },
  phone:      { label: 'Teléfono' },
  ip:         { label: 'IP' },
  url:        { label: 'URL' },
  currency:   { label: 'Moneda' },
  percentage: { label: 'Porcentaje' },
  uuid:       { label: 'UUID' },
  zip:        { label: 'Código Postal' },
};

interface ColumnDetailProps {
  col: ColumnStats;
  totalRows: number;
  findings?: QualityIssue[];
  initiallyExpanded?: boolean;
}

const ColumnDetail: React.FC<ColumnDetailProps> = ({ col, totalRows, findings, initiallyExpanded = false }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const nonNullCount = totalRows - col.nullCount;
  const outlierStatus = resolveOutlierStatus(col);
  const hasIQR = outlierStatus === 'computed';
  const hasOutliers = hasIQR && (col.outlierCount ?? 0) > 0;
  const sem = col.semanticType;
  const semInfo = sem ? semanticLabel[sem] : null;

  return (
    <div className={`col-detail ${hasOutliers ? 'col-detail--warning' : ''}`}>
      <button type="button" aria-expanded={expanded} className="col-detail-header" onClick={() => setExpanded(e => !e)}>
        <span className="col-detail-chevron">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="col-detail-name" title={`Columna: ${col.name}`}>
          {col.name}
        </span>
        <span className="col-detail-type-badge">
          {col.inferredType}
          {semInfo && (
            <span className="col-detail-sem" title={`Tipo semántico: ${semInfo.label}`}>
              ·{sem}
            </span>
          )}
        </span>
        <span className="col-detail-stats-compact">
          <span title="Valores no nulos">{formatInt(nonNullCount)} datos</span>
          <span className="col-detail-sep">·</span>
          <span title="Valores únicos">{formatInt(col.uniqueCount)} únicos</span>
          {col.nullCount > 0 && (
            <>
              <span className="col-detail-sep">·</span>
              <span className="col-detail-nulls" title="Valores nulos">{formatInt(col.nullCount)} nulos</span>
            </>
          )}
          {hasIQR && (
            <>
              <span className="col-detail-sep">·</span>
              <span title={`IQR = ${formatNum(col.iqr, 4)}`}>IQR = {formatNum(col.iqr)}</span>
            </>
          )}
          {hasOutliers && (
            <>
              <span className="col-detail-sep">·</span>
              <span className="col-detail-outliers" title="Atípicos extremos (IQR 3×)">
                <AlertTriangle size={10} /> {formatInt(col.outlierCount ?? 0)}
              </span>
            </>
          )}
          {findings !== undefined && (
            <>
              <span className="col-detail-sep">·</span>
              <span className={findings.length ? 'col-detail-outliers' : 'col-detail-ok'}>
                {findings.length ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                {' '}{findings.length ? `${findings.length} hallazgos` : 'Sin hallazgos en las reglas evaluadas'}
              </span>
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="col-detail-body">
          {/* ── Stats Grid ── */}
          <div className="col-detail-section">
            <p className="col-detail-section-label">ESTADÍSTICAS</p>
            <div className="col-detail-stats-grid">

              {col.inferredType === 'number' ? (
                <>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Mínimo</span>
                    <span className="col-stat-val">{col.min !== undefined ? formatNum(col.min, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Máximo</span>
                    <span className="col-stat-val">{col.max !== undefined ? formatNum(col.max, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Media</span>
                    <span className="col-stat-val">{col.mean !== undefined ? formatNum(col.mean, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Mediana</span>
                    <span className="col-stat-val">{col.median !== undefined ? formatNum(col.median, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Atípicos extremos (IQR 3×)</span>
                    <span className="col-stat-val" style={{ fontWeight: hasOutliers ? 700 : undefined }}>
                      {formatOutlierCount(col, col.outlierCount)}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Atípicos leves (IQR 1,5×)</span>
                    <span className="col-stat-val">
                      {formatOutlierCount(col, col.outlierCountTukey)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Longitud mínima</span>
                    <span className="col-stat-val">
                      {col.minLength !== undefined ? formatInt(col.minLength) : '—'}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Longitud máxima</span>
                    <span className="col-stat-val">
                      {col.maxLength !== undefined ? formatInt(col.maxLength) : '—'}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Ceros</span>
                    <span className="col-stat-val">{formatInt(col.zeros ?? 0)}</span>
                  </div>
                </>
              )}

              <div className="col-stat-item">
                <span className="col-stat-lbl">Nulos</span>
                <span className="col-stat-val">{formatInt(col.nullCount)} ({formatPct(col.nullCount, totalRows)})</span>
              </div>
              <div className="col-stat-item">
                <span className="col-stat-lbl">Únicos</span>
                <span className="col-stat-val">{formatInt(col.uniqueCount)}</span>
              </div>
            </div>

            {showAdvanced && (
              <div className="col-detail-stats-grid col-detail-stats-grid--advanced">
                {col.inferredType === 'number' && (
                  <>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Desv. estándar</span>
                      <span className="col-stat-val">{col.std !== undefined ? formatNum(col.std, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">CV</span>
                      <span className="col-stat-val">{col.cv !== undefined ? formatNum(col.cv, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Asimetría</span>
                      <span className="col-stat-val">{col.skewness !== undefined ? formatNum(col.skewness, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Q1 (25%)</span>
                      <span className="col-stat-val">{col.q1 !== undefined ? formatNum(col.q1, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Q3 (75%)</span>
                      <span className="col-stat-val">{col.q3 !== undefined ? formatNum(col.q3, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">IQR</span>
                      <span className="col-stat-val">{col.iqr !== undefined ? formatNum(col.iqr, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Límite inferior (3×)</span>
                      <span className="col-stat-val">{col.lowerFence !== undefined ? formatNum(col.lowerFence, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Límite superior (3×)</span>
                      <span className="col-stat-val">{col.upperFence !== undefined ? formatNum(col.upperFence, 4) : '—'}</span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">% atípicos extremos</span>
                      <span className="col-stat-val">
                        {hasIQR && nonNullCount > 0 ? formatPct(col.outlierCount ?? 0, nonNullCount) : formatOutlierCount(col, undefined)}
                      </span>
                    </div>
                    <div className="col-stat-item">
                      <span className="col-stat-lbl">Ceros</span>
                      <span className="col-stat-val">{formatInt(col.zeros ?? 0)} ({formatPct(col.zeros ?? 0, nonNullCount)})</span>
                    </div>
                  </>
                )}
                <div className="col-stat-item">
                  <span className="col-stat-lbl">Cardinalidad</span>
                  <span className="col-stat-val">
                    {totalRows > 0 ? formatPct(col.uniqueCount, totalRows) : '—'}
                  </span>
                </div>
                {semInfo && (
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Tipo semántico</span>
                    <span className="col-stat-val">{semInfo.label}</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="col-detail-advanced-toggle"
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? 'Ocultar estadísticas avanzadas' : 'Ver estadísticas avanzadas'}
            </button>
          </div>

          {/* ── Top Values Frequency ── */}
          {col.topFreq && col.topFreq.length > 0 && (
            <div className="col-detail-section">
              <p className="col-detail-section-label">TOP {col.topFreq.length} VALORES MÁS FRECUENTES</p>
              <div className="col-freq-table">
                <div className="col-freq-header">
                  <span>Valor</span>
                  <span>Conteo</span>
                  <span>%</span>
                  <span>Barra</span>
                </div>
                {col.topFreq.map((item, idx) => {
                  const pct = nonNullCount > 0 ? (item.count / nonNullCount) * 100 : 0;
                  return (
                    <div key={idx} className="col-freq-row">
                      <code className="col-freq-value" title={String(item.value)}>
                        {String(item.value).substring(0, 40)}
                        {String(item.value).length > 40 ? '…' : ''}
                      </code>
                      <span className="col-freq-count">{formatInt(item.count)}</span>
                      <span className="col-freq-pct">{formatPct(item.count, nonNullCount)}</span>
                      <div className="col-freq-bar-bg">
                        <div
                          className="col-freq-bar-fill"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Sample Values ── */}
          {col.sampleValues && col.sampleValues.length > 0 && (
            <div className="col-detail-section">
              <p className="col-detail-section-label">MUESTRA DE VALORES (inicio · medio · fin)</p>
              <div className="col-sample-chips">
                {col.sampleValues.map((val, idx) => (
                  <code key={idx} className="col-sample-chip" title={String(val)}>
                    {String(val).substring(0, 50)}
                    {String(val).length > 50 ? '…' : ''}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* ── IQR Bounds Detail ── */}
          {hasIQR && (
            <div className="col-detail-section">
              <p className="col-detail-section-label">LÍMITES DE ATÍPICOS (IQR 3×)</p>
              <div className="col-iqr-visual">
                <div className="col-iqr-bar">
                  <div className="col-iqr-lower" style={{ left: '0%', width: '15%' }}>
                    <span className="col-iqr-bound-label">inferior = {formatNum(col.lowerFence, 2)}</span>
                  </div>
                  <div className="col-iqr-q1" style={{ left: '20%', width: '15%' }}>
                    <span className="col-iqr-bound-label">Q1 = {formatNum(col.q1, 2)}</span>
                  </div>
                  <div className="col-iqr-box" style={{ left: '35%', width: '30%' }}>
                    <span className="col-iqr-iqr-label">IQR = {formatNum(col.iqr, 2)}</span>
                  </div>
                  <div className="col-iqr-q3" style={{ left: '65%', width: '15%' }}>
                    <span className="col-iqr-bound-label">Q3 = {formatNum(col.q3, 2)}</span>
                  </div>
                  <div className="col-iqr-upper" style={{ left: '80%', width: '20%' }}>
                    <span className="col-iqr-bound-label">superior = {formatNum(col.upperFence, 2)}</span>
                  </div>
                </div>
                <p className="col-iqr-note">
                  Valores fuera de [{formatNum(col.lowerFence, 2)}; {formatNum(col.upperFence, 2)}] se marcan como atípicos extremos
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ColumnStatsPanel: React.FC<ColumnStatsPanelProps> = ({ columnStats, totalRows, issues, initiallyExpanded = false, compact = false }) => {
  const columns = Object.values(columnStats);
  const [showAll, setShowAll] = useState(false);

  if (columns.length === 0) {
    return <p className="text-muted">Sin estadísticas disponibles.</p>;
  }

  const rowCount = totalRows ?? Math.max(
    ...columns.map((column) => column.nullCount + Math.max(column.uniqueCount, 0)),
    0,
  );

  const displayedCols = showAll ? columns : columns.slice(0, 10);
  const hiddenCount = columns.length - displayedCols.length;

  return (
    <div className="colstats-full-panel">
      {!compact && <div className="colstats-full-header">
        <div className="colstats-full-title">
          <BarChart3 size={14} />
          <span>PERFIL ESTADÍSTICO COMPLETO — {columns.length} COLUMNAS</span>
        </div>
        <p className="colstats-full-subtitle">
          Cada columna expandible muestra todas las estadísticas, distribución de frecuencias,
          muestra de valores e IQR. Las frecuencias muestran los cinco valores más comunes.
        </p>
      </div>}

      <div className="colstats-full-list">
        {displayedCols.map(col => (
          <ColumnDetail key={col.name} initiallyExpanded={initiallyExpanded} col={col} totalRows={rowCount > 0 ? rowCount : 0} findings={issues?.filter(issue => issue.column === col.name)} />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button className="colstats-show-more" onClick={() => setShowAll(true)}>
          <Hash size={12} />
          Mostrar {hiddenCount} columnas más
        </button>
      )}
    </div>
  );
};

export default ColumnStatsPanel;
