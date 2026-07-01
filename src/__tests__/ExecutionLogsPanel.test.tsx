import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import ExecutionLogsPanel from '../components/ExecutionLogsPanel';

function renderHtml(props: Record<string, unknown>): string {
  return renderToString(createElement(ExecutionLogsPanel, props as any));
}

describe('ExecutionLogsPanel', () => {
  it('renders logs panel with data-testid', () => {
    const html = renderHtml({ logs: [] });
    expect(html).toContain('data-testid="execution-logs-panel"');
  });

  it('shows no logs message when empty', () => {
    const html = renderHtml({ logs: [] });
    expect(html).toContain('data-testid="no-logs"');
  });

  it('renders log list', () => {
    const html = renderHtml({ logs: ['[INFO] step 1: starting', '[INFO] step 2: done'] });
    expect(html).toContain('data-testid="log-list"');
  });

  it('renders individual log lines', () => {
    const html = renderHtml({ logs: ['[INFO] test log line'] });
    expect(html).toContain('data-testid="log-line-0"');
  });

  it('classifies error logs', () => {
    const html = renderHtml({ logs: ['[ERROR] something failed'] });
    expect(html).toContain('data-level="error"');
  });

  it('classifies warn logs', () => {
    const html = renderHtml({ logs: ['[WARN] gate blocked'] });
    expect(html).toContain('data-level="warn"');
  });

  it('classifies info logs', () => {
    const html = renderHtml({ logs: ['[INFO] all good'] });
    expect(html).toContain('data-level="info"');
  });

  it('shows toggle when logs exceed max visible', () => {
    const logs = Array.from({ length: 25 }, (_, i) => `log entry ${i}`);
    const html = renderHtml({ logs });
    expect(html).toContain('data-testid="toggle-logs"');
    expect(html).toContain('Show 5 more');
  });

  it('does not show toggle when logs within limit', () => {
    const html = renderHtml({ logs: ['log 1', 'log 2'] });
    expect(html).not.toContain('data-testid="toggle-logs"');
  });

  it('shows logs notice about AURA orchestration', () => {
    const html = renderHtml({ logs: [] });
    expect(html).toContain('data-testid="logs-notice"');
    expect(html).toContain('AURA orchestration');
  });

  it('renders runtime badge when execution provided', () => {
    const execution = {
      runtime: 'colab_notebook' as const,
      runtimeVersion: '1.0.0',
      status: 'success' as const,
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      durationMs: 60000,
      logs: [],
      error: null,
      sandbox: { networkDisabled: true, filesystemRestricted: true, timeoutMs: 300000, memoryLimitMb: null, allowedImports: [] },
    };
    const html = renderHtml({ logs: [], execution });
    expect(html).toContain('data-testid="runtime-badge"');
    expect(html).toContain('colab_notebook');
  });

  it('shows status badge with correct status', () => {
    const execution = {
      runtime: 'colab_notebook' as const,
      runtimeVersion: '1.0.0',
      status: 'failed' as const,
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: null,
      durationMs: null,
      logs: [],
      error: 'execution failed',
      sandbox: { networkDisabled: true, filesystemRestricted: true, timeoutMs: 300000, memoryLimitMb: null, allowedImports: [] },
    };
    const html = renderHtml({ logs: [], execution });
    expect(html).toContain('data-testid="status-badge"');
    expect(html).toContain('failed');
  });

  it('shows duration when available', () => {
    const execution = {
      runtime: 'colab_notebook' as const,
      runtimeVersion: '1.0.0',
      status: 'success' as const,
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      durationMs: 60000,
      logs: [],
      error: null,
      sandbox: { networkDisabled: true, filesystemRestricted: true, timeoutMs: 300000, memoryLimitMb: null, allowedImports: [] },
    };
    const html = renderHtml({ logs: [], execution });
    expect(html).toContain('data-testid="duration"');
    expect(html).toContain('60000ms');
  });

  it('omits duration when null', () => {
    const execution = {
      runtime: 'colab_notebook' as const,
      runtimeVersion: '1.0.0',
      status: 'blocked' as const,
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: null,
      durationMs: null,
      logs: [],
      error: 'blocked',
      sandbox: { networkDisabled: true, filesystemRestricted: true, timeoutMs: 300000, memoryLimitMb: null, allowedImports: [] },
    };
    const html = renderHtml({ logs: [], execution });
    expect(html).not.toContain('data-testid="duration"');
  });

  it('renders panel without execution prop', () => {
    const html = renderHtml({ logs: ['[INFO] test'] });
    expect(html).toContain('data-testid="execution-logs-panel"');
  });

  it('renders panel with empty execution logs', () => {
    const html = renderHtml({ logs: [] });
    expect(html).toContain('Execution Logs');
  });

  it('classifies failed log as error', () => {
    const html = renderHtml({ logs: ['execution failed'] });
    expect(html).toContain('data-level="error"');
  });

  it('classifies blocked log as warn', () => {
    const html = renderHtml({ logs: ['gate blocked'] });
    expect(html).toContain('data-level="warn"');
  });

  it('classifies plain info log as info', () => {
    const html = renderHtml({ logs: ['plain log message'] });
    expect(html).toContain('data-level="info"');
  });
});
