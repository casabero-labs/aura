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
 * Este panel es la base del Smart Sample que se envía al LLM.
 */

import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Hash } from 'lucide-react';
import type { ColumnStats } from '../types';

interface ColumnStatsPanelProps {
  columnStats: Record<string, ColumnStats>;
}

const formatNum = (n?: number | string, decimals = 2): string => {
  if (n === undefined || n === null) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return num.toFixed(decimals);
};

const formatPct = (part: number, total: number): string => {
  if (total === 0) return '0%';
  return ((part / total) * 100).toFixed(1) + '%';
};

const semanticLabel: Record<string, { label: string; color: string }> = {
  email:      { label: 'Email', color: '#3498db' },
  phone:      { label: 'Teléfono', color: '#9b59b6' },
  ip:         { label: 'IP', color: '#1abc9c' },
  url:        { label: 'URL', color: '#2980b9' },
  currency:   { label: 'Moneda', color: '#f39c12' },
  percentage: { label: 'Porcentaje', color: '#e67e22' },
  uuid:       { label: 'UUID', color: '#16a085' },
  zip:        { label: 'Código Postal', color: '#8e44ad' },
};

const typeColor = (type: string): string => {
  switch (type) {
    case 'number': return '#3498db';
    case 'string': return '#95a5a6';
    case 'date': return '#27ae60';
    case 'boolean': return '#9b59b6';
    case 'mixed': return '#e74c3c';
    default: return 'var(--ink2)';
  }
};

interface ColumnDetailProps {
  col: ColumnStats;
  totalRows: number;
}

const ColumnDetail: React.FC<ColumnDetailProps> = ({ col, totalRows }) => {
  const [expanded, setExpanded] = useState(false);
  const nonNullCount = totalRows - col.nullCount;
  const hasIQR = col.iqr !== undefined && col.iqr > 0;
  const hasOutliers = (col.outlierCount ?? 0) > 0;
  const sem = col.semanticType;
  const semInfo = sem ? semanticLabel[sem] : null;

  const std = col.mean !== undefined && col.q1 !== undefined && col.q3 !== undefined
    ? Math.sqrt(2 * Math.pow(col.q3! - col.q1!, 2) / 1.35) // aproximación rápida
    : undefined;

  return (
    <div className={`col-detail ${hasOutliers ? 'col-detail--warning' : ''}`}>
      <button className="col-detail-header" onClick={() => setExpanded(e => !e)}>
        <span className="col-detail-chevron">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="col-detail-name" title={`Columna: ${col.name}`}>
          {col.name}
        </span>
        <span className="col-detail-type-badge" style={{ background: typeColor(col.inferredType) + '22', color: typeColor(col.inferredType), borderColor: typeColor(col.inferredType) + '44' }}>
          {col.inferredType}
          {semInfo && (
            <span className="col-detail-sem" title={`Tipo semántico: ${semInfo.label}`}>
              ·{sem}
            </span>
          )}
        </span>
        <span className="col-detail-stats-compact">
          <span title="Valores no nulos">{nonNullCount.toLocaleString('es-CO')} datos</span>
          <span className="col-detail-sep">·</span>
          <span title="Valores únicos">{col.uniqueCount.toLocaleString('es-CO')} únicos</span>
          {col.nullCount > 0 && (
            <>
              <span className="col-detail-sep">·</span>
              <span className="col-detail-nulls" title="Valores nulos">{col.nullCount} nulos</span>
            </>
          )}
          {hasIQR && (
            <>
              <span className="col-detail-sep">·</span>
              <span title={`IQR = ${col.iqr}`}>IQR={formatNum(col.iqr)}</span>
            </>
          )}
          {hasOutliers && (
            <>
              <span className="col-detail-sep">·</span>
              <span className="col-detail-outliers" title="Outliers detectados">
                <AlertTriangle size={10} /> {col.outlierCount}
              </span>
            </>
          )}
          {!hasIQR && !hasOutliers && col.nullCount === 0 && (
            <>
              <span className="col-detail-sep">·</span>
              <span className="col-detail-ok"><CheckCircle size={10} /> OK</span>
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
                    <span className="col-stat-lbl">Min</span>
                    <span className="col-stat-val">{col.min !== undefined ? formatNum(col.min, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Max</span>
                    <span className="col-stat-val">{col.max !== undefined ? formatNum(col.max, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Mean</span>
                    <span className="col-stat-val">{col.mean !== undefined ? formatNum(col.mean, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Std (aprox)</span>
                    <span className="col-stat-val">{std !== undefined ? formatNum(std, 4) : '—'}</span>
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
                    <span className="col-stat-lbl">Lower fence</span>
                    <span className="col-stat-val">{col.lowerFence !== undefined ? formatNum(col.lowerFence, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Upper fence</span>
                    <span className="col-stat-val">{col.upperFence !== undefined ? formatNum(col.upperFence, 4) : '—'}</span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Outliers</span>
                    <span className="col-stat-val" style={{ color: hasOutliers ? 'var(--error)' : 'inherit' }}>
                      {col.outlierCount !== undefined ? col.outlierCount : 0}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">% Outliers</span>
                    <span className="col-stat-val">
                      {nonNullCount > 0 ? formatPct(col.outlierCount ?? 0, nonNullCount) : '—'}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Ceros</span>
                    <span className="col-stat-val">{col.zeros ?? 0} ({formatPct(col.zeros ?? 0, nonNullCount)})</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Min longitud</span>
                    <span className="col-stat-val">
                      {col.sampleValues ? Math.min(...col.sampleValues.map(v => String(v).length)).toString() : '—'}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Max longitud</span>
                    <span className="col-stat-val">
                      {col.sampleValues ? Math.max(...col.sampleValues.map(v => String(v).length)).toString() : '—'}
                    </span>
                  </div>
                  <div className="col-stat-item">
                    <span className="col-stat-lbl">Zeros</span>
                    <span className="col-stat-val">{col.zeros ?? 0}</span>
                  </div>
                </>
              )}

              <div className="col-stat-item">
                <span className="col-stat-lbl">Nulos</span>
                <span className="col-stat-val">{col.nullCount} ({formatPct(col.nullCount, totalRows)})</span>
              </div>
              <div className="col-stat-item">
                <span className="col-stat-lbl">Únicos</span>
                <span className="col-stat-val">{col.uniqueCount}</span>
              </div>
              <div className="col-stat-item">
                <span className="col-stat-lbl">Cardinalidad</span>
                <span className="col-stat-val">
                  {totalRows > 0 ? formatPct(col.uniqueCount, totalRows) : '—'}
                </span>
              </div>
              {semInfo && (
                <div className="col-stat-item">
                  <span className="col-stat-lbl">Tipo semántico</span>
                  <span className="col-stat-val" style={{ color: semInfo.color }}>{semInfo.label}</span>
                </div>
              )}
            </div>
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
                      <span className="col-freq-count">{item.count.toLocaleString('es-CO')}</span>
                      <span className="col-freq-pct">{pct.toFixed(1)}%</span>
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
              <p className="col-detail-section-label">IQR OUTLIER BOUNDS</p>
              <div className="col-iqr-visual">
                <div className="col-iqr-bar">
                  <div className="col-iqr-lower" style={{ left: '0%', width: '15%' }}>
                    <span className="col-iqr-bound-label">lower={formatNum(col.lowerFence, 2)}</span>
                  </div>
                  <div className="col-iqr-q1" style={{ left: '20%', width: '15%' }}>
                    <span className="col-iqr-bound-label">Q1={formatNum(col.q1, 2)}</span>
                  </div>
                  <div className="col-iqr-box" style={{ left: '35%', width: '30%' }}>
                    <span className="col-iqr-iqr-label">IQR={formatNum(col.iqr, 2)}</span>
                  </div>
                  <div className="col-iqr-q3" style={{ left: '65%', width: '15%' }}>
                    <span className="col-iqr-bound-label">Q3={formatNum(col.q3, 2)}</span>
                  </div>
                  <div className="col-iqr-upper" style={{ left: '80%', width: '20%' }}>
                    <span className="col-iqr-bound-label">upper={formatNum(col.upperFence, 2)}</span>
                  </div>
                </div>
                <p className="col-iqr-note">
                  Valores fuera de [{formatNum(col.lowerFence, 2)}, {formatNum(col.upperFence, 2)}] se marcan como outliers
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ColumnStatsPanel: React.FC<ColumnStatsPanelProps> = ({ columnStats }) => {
  const columns = Object.values(columnStats);

  if (columns.length === 0) {
    return <p className="text-muted">Sin estadísticas disponibles.</p>;
  }

  const totalRows = columns.length > 0
    ? columns[0].nullCount + columns.reduce((sum, c) => sum + (columns[0].nullCount - c.nullCount), 0)
    : 0;

  const [showAll, setShowAll] = useState(false);
  const displayedCols = showAll ? columns : columns.slice(0, 10);
  const hiddenCount = columns.length - displayedCols.length;

  return (
    <div className="colstats-full-panel">
      <div className="colstats-full-header">
        <div className="colstats-full-title">
          <BarChart3 size={14} />
          <span>PERFIL ESTADÍSTICO COMPLETO — {columns.length} COLUMNAS</span>
        </div>
        <p className="colstats-full-subtitle">
          Cada columna expandible muestra todas las estadísticas, distribución de frecuencias,
          muestra de valores e IQR. Sin truncamiento.
        </p>
      </div>

      <div className="colstats-full-list">
        {displayedCols.map(col => (
          <ColumnDetail key={col.name} col={col} totalRows={totalRows > 0 ? totalRows : 1000} />
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
