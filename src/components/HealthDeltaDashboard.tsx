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
  improved: 'Improved',
  unchanged: 'Unchanged',
  worsened: 'Worsened',
  inconclusive: 'Inconclusive',
};

const STATUS_COLOR: Record<DeltaStatus, string> = {
  improved: '#10b981',
  unchanged: '#9ca3af',
  worsened: '#ef4444',
  inconclusive: '#f97316',
};

const BG: Record<DeltaStatus, string> = {
  improved: '#ecfdf5',
  unchanged: '#f9fafb',
  worsened: '#fef2f2',
  inconclusive: '#fff7ed',
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
  const color = STATUS_COLOR[status] ?? '#6b7280';
  const bg = BG[status] ?? '#f9fafb';
  const label = LABEL[status] ?? status;
  const scoreWidth = 10;

  return (
    <div data-testid="health-delta-dashboard" style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Status badge ── */}
      <div style={{ marginBottom: 16 }}>
        <span
          data-testid="status-badge"
          style={{
            display: 'inline-block',
            background: bg,
            color,
            fontWeight: 700,
            fontSize: 14,
            padding: '4px 12px',
            borderRadius: 999,
            border: `1px solid ${color}`,
          }}
        >
          {label}
        </span>
      </div>

      {/* ── Score bar ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
          <span>Score</span>
          <span data-testid="score-delta" style={{ fontWeight: 600, color }}>{nfmt(delta)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span data-testid="score-before" style={{ fontSize: 24, fontWeight: 700 }}>{scoreBefore ?? '—'}</span>
          <span style={{ color: '#d1d5db', fontSize: 20 }}>→</span>
          <span data-testid="score-after" style={{ fontSize: 24, fontWeight: 700, color }}>{scoreAfter ?? '—'}</span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
          <div
            data-testid="score-bar"
            style={{
              width: `${Math.max(scoreWidth, Math.min(100, ((scoreAfter ?? 0) / 100) * 100))}%`,
              height: '100%',
              background: color,
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* ── Issues ── */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>Issues before</div>
          <div data-testid="issues-before" style={{ fontSize: 20, fontWeight: 700 }}>{beforeIssueCount}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>Issues after</div>
          <div data-testid="issues-after" style={{ fontSize: 20, fontWeight: 700, color: afterIssueCount > beforeIssueCount ? '#ef4444' : color }}>{afterIssueCount}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>Issue delta</div>
          <div data-testid="issue-delta" style={{ fontSize: 20, fontWeight: 700, color: issueDelta > 0 ? '#ef4444' : issueDelta < 0 ? '#10b981' : '#9ca3af' }}>{nfmt(issueDelta)}</div>
        </div>
      </div>

      {/* ── Output dataset ── */}
      {(outputRowCountBefore != null || outputColumnCountBefore != null) && (
        <div data-testid="output-summary" style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output Dataset</div>
          {outputRowCountBefore != null && (
            <div>Rows: <strong data-testid="output-rows">{outputRowCountBefore}</strong> → <strong>{outputRowCountAfter ?? '—'}</strong></div>
          )}
          {outputColumnCountBefore != null && (
            <div>Columns: <strong data-testid="output-cols">{outputColumnCountBefore}</strong> → <strong>{outputColumnCountAfter ?? '—'}</strong></div>
          )}
          {changedCellsEstimate != null && (
            <div data-testid="changed-cells">Changed cells: <strong>{changedCellsEstimate}</strong> {outputRowCountBefore != null ? pct(changedCellsEstimate, outputRowCountBefore * (outputColumnCountBefore ?? 1)) : ''}</div>
          )}
        </div>
      )}

      {/* ── Summary ── */}
      <div data-testid="delta-summary" style={{ marginBottom: 16, padding: 12, background: bg, borderRadius: 8, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
        {summary}
      </div>

      {/* ── Caveats ── */}
      {caveats.length > 0 && (
        <div data-testid="caveats" style={{ marginBottom: 16, padding: 12, border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#92400e' }}>Caveats</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {caveats.map((c, i) => (
              <li key={i} style={{ fontSize: 13, color: '#78350f', marginBottom: 4 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Limitation notice ── */}
      <div data-testid="limitation-notice" style={{ fontSize: 12, color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8 }}>
        HealthDelta is computed over controlled fixtures using AURA runAudit. It is not independent external validation.
      </div>
    </div>
  );
};

export default HealthDeltaDashboard;
export type { DeltaStatus };
