import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import ImprovementRunExportCard from '../components/ImprovementRunExportCard';

const mockRun = {
  contractId: 'aura.improvement_run.v1' as const,
  contractVersion: '1.0.0' as const,
  runId: 'run:abc123',
  createdAt: '2025-01-01T00:00:00.000Z',
  sourceDatasetFingerprint: 'sha256:abc123',
  sourceEvidenceEnvelopeRef: 'env:ref1',
  scriptContractRef: 'contract:abc',
  scriptHash: 'abc123',
  remediationPlanId: 'plan:abc',
  acceptedActionIds: ['act:1'],
  execution: {
    runtime: 'colab_notebook' as const,
    runtimeVersion: '1.0.0',
    status: 'success' as const,
    startedAt: '2025-01-01T00:00:00.000Z',
    finishedAt: '2025-01-01T00:01:00.000Z',
    durationMs: 60000,
    logs: [],
    error: null,
    sandbox: {
      networkDisabled: true,
      filesystemRestricted: true,
      timeoutMs: 300000,
      memoryLimitMb: null,
      allowedImports: [],
    },
  },
  outputDataset: {
    rowCountBefore: 100,
    rowCountAfter: 100,
    columnCountBefore: 5,
    columnCountAfter: 5,
    outputFingerprint: 'sha256:def456',
    changedCellsEstimate: 6,
    exportedCsvRef: null,
  },
  reaudit: {
    beforeEvidenceEnvelopeRef: 'env:before',
    afterEvidenceEnvelopeRef: 'env:after',
    beforeIssueCount: 10,
    afterIssueCount: 3,
    rulesCompared: ['rule:city_casing'],
  },
  healthDelta: {
    status: 'improved' as const,
    scoreBefore: 0.7,
    scoreAfter: 0.95,
    delta: 0.25,
    issueDelta: -7,
    summary: 'Issues reduced.',
    caveats: [],
  },
  limitations: ['Controlled fixture only.'],
  claims: {
    permitted: ['Export as JSON.'],
    prohibited: ['Real dataset validation.'],
  },
};

function renderHtml(props: Record<string, unknown>): string {
  return renderToString(createElement(ImprovementRunExportCard, props as any));
}

describe('ImprovementRunExportCard', () => {
  it('renders export card with data-testid', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('data-testid="export-card"');
  });

  it('shows run id', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('run:abc123');
  });

  it('renders download button', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('data-testid="download-button"');
  });

  it('renders copy button', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('data-testid="copy-button"');
  });

  it('shows preview toggle', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('data-testid="toggle-preview"');
  });

  it('shows preview collapsed by default for full JSON', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('▶ Show preview');
  });

  it('does not show json-preview when collapsed', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).not.toContain('data-testid="json-preview"');
  });

  it('shows export notice about controlled fixtures', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('data-testid="export-notice"');
    expect(html).toContain('controlled fixture');
  });

  it('renders improved status run', () => {
    const html = renderHtml({ improvementRun: mockRun });
    expect(html).toContain('data-testid="export-card"');
  });

  it('renders export card for unchanged status', () => {
    const unchangedRun = { ...mockRun, healthDelta: { ...mockRun.healthDelta, status: 'unchanged' as const, delta: 0, issueDelta: 0 } };
    const html = renderHtml({ improvementRun: unchangedRun });
    expect(html).toContain('data-testid="export-card"');
  });

  it('renders export card for worsened status', () => {
    const worsenedRun = { ...mockRun, healthDelta: { ...mockRun.healthDelta, status: 'worsened' as const, delta: -0.1, issueDelta: 3 } };
    const html = renderHtml({ improvementRun: worsenedRun });
    expect(html).toContain('data-testid="export-card"');
  });

  it('renders export card for inconclusive status', () => {
    const inconclusiveRun = { ...mockRun, healthDelta: { ...mockRun.healthDelta, status: 'inconclusive' as const } };
    const html = renderHtml({ improvementRun: inconclusiveRun });
    expect(html).toContain('data-testid="export-card"');
  });
});
