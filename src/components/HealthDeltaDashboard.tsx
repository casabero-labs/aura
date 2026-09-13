// ── Phase 6 Loop 2: HealthDeltaDashboard ──
// Pure presentational component. Receives props, renders health delta.
// No service calls. No Python execution. Controlled fixtures only.

import React from 'react';

type DeltaStatus = 'improved' | 'unchanged' | 'worsened' | 'inconclusive';

interface Props {
  status: DeltaStatus;
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
  issueDelta: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  summary: string;
  caveats: string[];
  outputRowCountBefore?: number;
  outputRowCountAfter?: number;
  outputColumnCountBefore?: number;
  outputColumnCountAfter?: number;
  changedCellsEstimate?: number | null;
}

const LABEL: Record<DeltaStatus, string> = {
  improved: 'Mejora observada',
  unchanged: 'Sin cambio observado',
  worsened: 'Deterioro observado',
  inconclusive: 'Resultado inconcluso',
};

const LEGACY_LABEL: Record<DeltaStatus, string> = {
  improved: 'Improved',
  unchanged: 'Unchanged',
  worsened: 'Worsened',
  inconclusive: 'Inconclusive',
};

const pct = (v: number | null, total: number): string => {
  if (v == null || total <= 0) return '';
  return `(${Math.round((v / total) * 100)}%)`;
};

const nfmt = (n: number | null): string => (n == null ? '—' : n > 0 ? `+${n}` : String(n));

const HealthDeltaDashboard: React.FC<Props> = ({
  status,
  scoreBefore = null,
  scoreAfter = null,
  delta = null,
  issueDelta = 0,
  beforeIssueCount = 0,
  afterIssueCount = 0,
  summary = '',
  caveats = [],
  outputRowCountBefore,
  outputRowCountAfter,
  outputColumnCountBefore,
  outputColumnCountAfter,
  changedCellsEstimate,
}) => {
  const label = LABEL[status] ?? status;
  const scoreWidth = 10;
  const issueTrend = issueDelta > 0 ? 'increased' : issueDelta < 0 ? 'decreased' : 'unchanged';
  const afterTrend = afterIssueCount > beforeIssueCount ? 'increased' : 'not-increased';

  return (
    <section
      className="health-delta-dashboard editorial-surface"
      data-testid="health-delta-dashboard"
      data-status={status}
      aria-labelledby="health-delta-title"
    >

      {/* ── Status badge ── */}
      <div className="health-delta-status-row">
        <span
          data-testid="status-badge"
          className="health-delta-status"
          data-status={status}
          role="status"
        >
          {label}
          <span className="sr-only">{LEGACY_LABEL[status]}</span>
        </span>
      </div>

      {/* ── Score bar ── */}
      <div className="health-delta-score" id="health-delta-title">
        <div className="health-delta-score-heading">
          <span>Calidad observada</span>
          <span data-testid="score-delta" data-trend={issueTrend}>{nfmt(delta)} puntos</span>
        </div>
        <div className="health-delta-score-values" aria-label="Comparación de calidad antes y después">
          <span data-testid="score-before">{scoreBefore ?? '—'}</span>
          <span aria-hidden="true">→</span>
          <span data-testid="score-after">{scoreAfter ?? '—'}</span>
        </div>
        <div className="health-delta-score-track" aria-hidden="true">
          <div
            data-testid="score-bar"
            className="health-delta-score-fill"
            style={{
              width: `${Math.max(scoreWidth, Math.min(100, ((scoreAfter ?? 0) / 100) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* ── Issues ── */}
      <div className="health-delta-issues" aria-label="Comparación de hallazgos">
        <div className="health-delta-issue">
          <div className="health-delta-issue-label">Hallazgos antes</div>
          <div data-testid="issues-before">{beforeIssueCount}</div>
        </div>
        <div className="health-delta-issue" data-trend={afterTrend}>
          <div className="health-delta-issue-label">Hallazgos después</div>
          <div data-testid="issues-after">{afterIssueCount}</div>
        </div>
        <div className="health-delta-issue" data-trend={issueTrend}>
          <div className="health-delta-issue-label">Diferencia de hallazgos</div>
          <div data-testid="issue-delta">{nfmt(issueDelta)}</div>
        </div>
      </div>

      {/* ── Output dataset ── */}
      {(outputRowCountBefore != null || outputColumnCountBefore != null) && (
        <section data-testid="output-summary" className="health-delta-output" aria-labelledby="health-delta-output-title">
          <h3 id="health-delta-output-title">Dataset de salida <span className="sr-only">Output Dataset</span></h3>
          {outputRowCountBefore != null && (
            <div>Filas: <strong data-testid="output-rows">{outputRowCountBefore}</strong> → <strong>{outputRowCountAfter ?? '—'}</strong></div>
          )}
          {outputColumnCountBefore != null && (
            <div>Columnas: <strong data-testid="output-cols">{outputColumnCountBefore}</strong> → <strong>{outputColumnCountAfter ?? '—'}</strong></div>
          )}
          {changedCellsEstimate != null && (
            <div data-testid="changed-cells">Celdas modificadas: <strong>{changedCellsEstimate}</strong> {outputRowCountBefore != null ? pct(changedCellsEstimate, outputRowCountBefore * (outputColumnCountBefore ?? 1)) : ''}</div>
          )}
        </section>
      )}

      {/* ── Summary ── */}
      <p data-testid="delta-summary" className="health-delta-summary">
        {summary}
      </p>

      {/* ── Caveats ── */}
      {caveats.length > 0 && (
        <section data-testid="caveats" className="health-delta-caveats" aria-labelledby="health-delta-caveats-title">
          <h3 id="health-delta-caveats-title">Límites y cautelas <span className="sr-only">Caveats</span></h3>
          <ul>
            {caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Limitation notice ── */}
      <p data-testid="limitation-notice" className="health-delta-limitation">
        Este resultado se calcula con fixtures controlados mediante la auditoría determinista de AURA; no es una validación externa independiente.
        <span className="sr-only">HealthDelta is computed over controlled fixtures using AURA runAudit. It is not independent external validation.</span>
      </p>
    </section>
  );
};

export default HealthDeltaDashboard;
export type { DeltaStatus };
