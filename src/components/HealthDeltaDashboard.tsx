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
  improved: 'var(--ink)',
  unchanged: 'var(--ink-muted)',
  worsened: 'var(--ink)',
  inconclusive: 'var(--ink2)',
};

const BG: Record<DeltaStatus, string> = {
  improved: 'transparent',
  unchanged: 'transparent',
  worsened: 'transparent',
  inconclusive: 'transparent',
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
  const color = STATUS_COLOR[status] ?? 'var(--ink-muted)';
  const bg = BG[status] ?? 'transparent';
  const label = LABEL[status] ?? status;
  const scoreWidth = 10;

  return (
    <div data-testid="health-delta-dashboard" style={{ background: 'var(--bg)', borderRadius: 0, padding: 20, border: '1px solid var(--line)', fontFamily: 'var(--font-meta)' }}>

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
            borderRadius: 0,
            border: `1px solid ${color}`,
          }}
        >
          {label}
        </span>
      </div>

      {/* ── Score bar ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
          <span>Score</span>
          <span data-testid="score-delta" style={{ fontWeight: 600, color }}>{nfmt(delta)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span data-testid="score-before" style={{ fontSize: 24, fontWeight: 700 }}>{scoreBefore ?? '—'}</span>
          <span style={{ color: 'var(--ink-faint)', fontSize: 20 }}>→</span>
          <span data-testid="score-after" style={{ fontSize: 24, fontWeight: 700, color }}>{scoreAfter ?? '—'}</span>
        </div>
        <div style={{ height: 8, background: 'transparent', boxShadow: 'inset 0 -1px 0 var(--line)', borderRadius: 0, marginTop: 8, overflow: 'hidden' }}>
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
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 2 }}>Issues before</div>
          <div data-testid="issues-before" style={{ fontSize: 20, fontWeight: 700 }}>{beforeIssueCount}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 2 }}>Issues after</div>
          <div data-testid="issues-after" style={{ fontSize: 20, fontWeight: 700, color: afterIssueCount > beforeIssueCount ? 'var(--ink)' : color }}>{afterIssueCount}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 2 }}>Issue delta</div>
          <div data-testid="issue-delta" style={{ fontSize: 20, fontWeight: 700, color: issueDelta === 0 ? 'var(--ink-muted)' : 'var(--ink)' }}>{nfmt(issueDelta)}</div>
        </div>
      </div>

      {/* ── Output dataset ── */}
      {(outputRowCountBefore != null || outputColumnCountBefore != null) && (
        <div data-testid="output-summary" style={{ marginBottom: 16, padding: 12, background: 'transparent', borderRadius: 0, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output Dataset</div>
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
      <div data-testid="delta-summary" style={{ marginBottom: 16, padding: 12, background: bg, borderRadius: 0, fontSize: 14, color: 'var(--ink2)', lineHeight: 1.5 }}>
        {summary}
      </div>

      {/* ── Caveats ── */}
      {caveats.length > 0 && (
        <div data-testid="caveats" style={{ marginBottom: 16, padding: 12, border: '1px solid var(--line)', background: 'transparent', borderRadius: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--ink)' }}>Caveats</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {caveats.map((c, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Limitation notice ── */}
      <div data-testid="limitation-notice" style={{ fontSize: 12, color: 'var(--ink-muted)', borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 8 }}>
        HealthDelta is computed over controlled fixtures using AURA runAudit. It is not independent external validation.
      </div>
    </div>
  );
};

export default HealthDeltaDashboard;
export type { DeltaStatus };
