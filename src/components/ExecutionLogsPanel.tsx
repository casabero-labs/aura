import React, { useState } from 'react';
import type { ExecutionSummaryV1 } from '../services/executionService';

interface Props {
  logs: string[];
  execution?: ExecutionSummaryV1;
}

type LogLevel = 'info' | 'warn' | 'error';

function classifyLog(text: string): LogLevel {
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('exception')) return 'error';
  if (lower.includes('warn') || lower.includes('blocked') || lower.includes('gate failed')) return 'warn';
  return 'info';
}

const levelColors: Record<LogLevel, { bg: string; border: string; dot: string }> = {
  info: { bg: 'transparent', border: 'var(--line)', dot: 'var(--ink)' },
  warn: { bg: 'transparent', border: 'var(--line)', dot: 'var(--ink)' },
  error: { bg: 'transparent', border: 'var(--line)', dot: 'var(--ink)' },
};

const ExecutionLogsPanel: React.FC<Props> = ({ logs, execution }) => {
  const [expanded, setExpanded] = useState(false);

  const MAX_VISIBLE = 20;
  const visible = expanded ? logs : logs.slice(0, MAX_VISIBLE);
  const hasMore = logs.length > MAX_VISIBLE;

  const statusColor: Record<string, string> = {
    success: 'var(--ink)',
    failed: 'var(--ink)',
    blocked: 'var(--ink2)',
    timeout: 'var(--ink2)',
  };

  return (
    <div data-testid="execution-logs-panel" style={{ border: '1px solid var(--line)', borderRadius: 0, padding: '16px', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Execution Logs</h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {execution && (
            <>
              <span
                data-testid="runtime-badge"
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'transparent', color: 'var(--ink)', fontFamily: 'monospace' }}
              >
                {execution.runtime}
              </span>
              <span
                data-testid="status-badge"
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'transparent', color: statusColor[execution.status] ?? 'var(--ink-muted)', fontFamily: 'monospace' }}
              >
                {execution.status}
              </span>
              {execution.durationMs != null && (
                <span data-testid="duration" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                  {`${execution.durationMs}ms`}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ maxHeight: expanded ? 'none' : 280, overflow: 'hidden', marginBottom: 12 }}>
        {visible.length === 0 ? (
          <p data-testid="no-logs" style={{ fontSize: 12, color: 'var(--ink-muted)', margin: 0 }}>No logs available.</p>
        ) : (
          <ul data-testid="log-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visible.map((line, i) => {
              const level: LogLevel = classifyLog(line);
              const colors = levelColors[level];
              return (
                <li
                  key={i}
                  data-testid={`log-line-${i}`}
                  data-level={level}
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    background: colors.bg,
                    borderLeft: `3px solid ${colors.dot}`,
                    marginBottom: 2,
                    borderRadius: '0 4px 4px 0',
                    wordBreak: 'break-all',
                  }}
                >
                  <span style={{ color: colors.dot, marginRight: 6, fontSize: 10 }}>●</span>
                  {line}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasMore && (
        <button
          data-testid="toggle-logs"
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ink-muted)', cursor: 'pointer', marginBottom: 12, display: 'block' }}
        >
          {expanded ? '▲ Show less' : `▶ Show ${logs.length - MAX_VISIBLE} more`}
        </button>
      )}

      <p data-testid="logs-notice" style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0, lineHeight: 1.5 }}>
        Logs describe AURA orchestration. Python execution remains external to Colab.
      </p>
    </div>
  );
};

export default ExecutionLogsPanel;
