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

const ExecutionLogsPanel: React.FC<Props> = ({ logs, execution }) => {
  const [expanded, setExpanded] = useState(false);

  const MAX_VISIBLE = 20;
  const visible = expanded ? logs : logs.slice(0, MAX_VISIBLE);
  const hasMore = logs.length > MAX_VISIBLE;

  return (
    <section className="execution-logs-panel editorial-surface" data-testid="execution-logs-panel" aria-labelledby="execution-logs-title">
      <div className="execution-logs-header">
        <h3 id="execution-logs-title">Registro de ejecución <span className="sr-only">Execution Logs</span></h3>
        <div className="execution-logs-meta">
          {execution && (
            <>
              <span
                data-testid="runtime-badge"
                className="execution-logs-badge execution-logs-runtime"
              >
                {execution.runtime}
              </span>
              <span
                data-testid="status-badge"
                className="execution-logs-badge execution-logs-status"
                data-status={execution.status}
              >
                {execution.status}
              </span>
              {execution.durationMs != null && (
                <span data-testid="duration" className="execution-logs-duration">
                  {`${execution.durationMs}ms`}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`execution-logs-list-wrap${expanded ? ' is-expanded' : ''}`}>
        {visible.length === 0 ? (
          <p data-testid="no-logs" className="execution-logs-empty">
            No hay registros disponibles. <span className="sr-only">No logs available.</span>
          </p>
        ) : (
          <ul data-testid="log-list" className="execution-logs-list">
            {visible.map((line, i) => {
              const level: LogLevel = classifyLog(line);
              return (
                <li
                  key={i}
                  data-testid={`log-line-${i}`}
                  data-level={level}
                  className={`execution-log-line execution-log-line--${level}`}
                >
                  <span className="execution-log-marker" aria-hidden="true">●</span>
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
          className="execution-logs-toggle"
          aria-expanded={expanded}
        >
          {expanded ? '▲ Mostrar menos' : `▶ Mostrar ${logs.length - MAX_VISIBLE} más`}
          <span className="sr-only">{expanded ? 'Show less' : `Show ${logs.length - MAX_VISIBLE} more`}</span>
        </button>
      )}

      <p data-testid="logs-notice" className="execution-logs-notice">
        El registro describe la orquestación de AURA. La ejecución Python permanece fuera de Colab.
        <span className="sr-only">Logs describe AURA orchestration. Python execution remains external to Colab.</span>
      </p>
    </section>
  );
};

export default ExecutionLogsPanel;
