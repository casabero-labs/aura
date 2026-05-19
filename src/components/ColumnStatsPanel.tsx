/**
 * ColumnStatsPanel — Tabla de estadísticas por columna con tipos semánticos e IQR
 * 
 * Reemplaza la tabla básica del diagnóstico con:
 * - Tipo inferido + tipo semántico (email, phone, etc.)
 * - IQR con Q1, Q3, fences y outliers
 * - Indicadores visuales de calidad por columna
 */

import React from 'react';
import { BarChart3, Hash, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ColumnStats } from '../types';

interface ColumnStatsPanelProps {
  columnStats: Record<string, ColumnStats>;
}

const formatNum = (n?: number, decimals = 1): string =>
  n !== undefined ? n.toFixed(decimals) : '—';

const semanticLabel: Record<string, { label: string; emoji: string }> = {
  email:      { label: 'Correo electrónico', emoji: '📧' },
  phone:      { label: 'Teléfono', emoji: '📞' },
  ip:         { label: 'Dirección IP', emoji: '🌐' },
  url:        { label: 'URL / Enlace', emoji: '🔗' },
  currency:   { label: 'Moneda', emoji: '💰' },
  percentage: { label: 'Porcentaje', emoji: '📊' },
  uuid:       { label: 'UUID', emoji: '🆔' },
  zip:        { label: 'Código Postal', emoji: '📮' },
  number:     { label: 'Numérico', emoji: '🔢' },
  string:     { label: 'Texto', emoji: '📝' },
  date:       { label: 'Fecha', emoji: '📅' },
  boolean:    { label: 'Booleano', emoji: '✅' },
  mixed:      { label: 'Mixto ⚠️', emoji: '⚠️' },
};

const ColumnStatsPanel: React.FC<ColumnStatsPanelProps> = ({ columnStats }) => {
  const columns = Object.values(columnStats);

  if (columns.length === 0) {
    return <p className="text-muted">Sin estadísticas disponibles.</p>;
  }

  return (
    <div className="colstats-panel">
      <p className="sec-eye" style={{ marginBottom: 12 }}>
        <BarChart3 size={14} style={{ display: 'inline', marginRight: 6 }} />
        PERFIL DE COLUMNAS — TIPOS E IQR
      </p>

      <div className="colstats-grid">
        {/* Header */}
        <div className="colstats-header">
          <span>Columna</span>
          <span>Tipo</span>
          <span className="hide-mobile">Nulos</span>
          <span className="hide-mobile">Únicos</span>
          <span className="hide-mobile">Min</span>
          <span className="hide-mobile">Q1</span>
          <span className="hide-mobile">Q3</span>
          <span className="hide-mobile">Max</span>
          <span>IQR</span>
          <span>Outliers</span>
        </div>

        {columns.map(col => {
          const sem = col.semanticType;
          const semInfo = sem ? semanticLabel[sem] : semanticLabel[col.inferredType];
          const hasOutliers = (col.outlierCount ?? 0) > 0;
          const hasNulls = col.nullCount > 0;

          return (
            <div key={col.name} className={`colstats-row ${hasOutliers ? 'row-warning' : ''} ${hasNulls ? 'row-nulls' : ''}`}>
              <span className="col-name" title={col.name}>
                {col.name}
              </span>
              <span className="col-type" title={semInfo?.label || col.inferredType}>
                {semInfo?.emoji || ''} {semInfo?.label || col.inferredType}
                {sem && sem !== col.inferredType && (
                  <span className="semantic-badge">{sem}</span>
                )}
              </span>
              <span className="hide-mobile">
                {hasNulls ? (
                  <span className="badge-warn">{col.nullCount}</span>
                ) : (
                  '0'
                )}
              </span>
              <span className="hide-mobile">{col.uniqueCount}</span>
              <span className="hide-mobile">{col.min !== undefined ? formatNum(col.min as number) : '—'}</span>
              <span className="hide-mobile">{col.q1 !== undefined ? formatNum(col.q1) : '—'}</span>
              <span className="hide-mobile">{col.q3 !== undefined ? formatNum(col.q3) : '—'}</span>
              <span className="hide-mobile">{col.max !== undefined ? formatNum(col.max as number) : '—'}</span>
              <span className="col-iqr">
                {col.iqr !== undefined ? (
                  <span title={`Q1=${formatNum(col.q1)} Q3=${formatNum(col.q3)}`}>
                    {formatNum(col.iqr, 2)}
                  </span>
                ) : '—'}
              </span>
              <span className={`col-outliers ${hasOutliers ? 'outlier-warn' : ''}`}>
                {col.outlierCount !== undefined ? (
                  hasOutliers ? (
                    <span className="badge-outlier" title={`Fuera de [${formatNum(col.lowerFence)}, ${formatNum(col.upperFence)}]`}>
                      <AlertTriangle size={12} /> {col.outlierCount}
                    </span>
                  ) : (
                    <span className="badge-ok"><CheckCircle size={12} /> 0</span>
                  )
                ) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="colstats-legend">
        <p className="legend-item"><span className="semantic-badge">semantic</span> Tipo detectado por patrón (email, phone, uuid…)</p>
        <p className="legend-item"><span className="badge-outlier"><AlertTriangle size={10} /> N</span> Valores fuera de [Q1−3×IQR, Q3+3×IQR]</p>
      </div>
    </div>
  );
};

export default ColumnStatsPanel;