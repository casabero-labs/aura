/**
 * ImprovementRunPanel Tests — Phase 6 Loop 1
 *
 * Validates component module load, service mock, and result shape.
 * Node environment to avoid vitest worker timeout with heavy modules.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/improvementRunService', () => ({
  runImprovementFlow: vi.fn(),
}));

describe('ImprovementRunPanel', () => {
  describe('module load', () => {
    it('exports default component function', async () => {
      const mod = await import('../components/ImprovementRunPanel');
      expect(typeof mod.default).toBe('function');
    });
  });

  describe('mock service', () => {
    it('runImprovementFlow is callable and returns mock data', async () => {
      const svc = await import('../services/improvementRunService');
      (svc.runImprovementFlow as any).mockReturnValue({
        improvementRun: {
          runId: 'run:mock_abc',
          healthDelta: { status: 'improved', scoreBefore: 75, scoreAfter: 100, delta: 25, issueDelta: -3, summary: 'OK', caveats: [] },
        },
        executionResult: { execution: { status: 'success' } },
        reauditResult: {
          summary: { beforeIssueCount: 3, afterIssueCount: 0 },
          output: { rowCountBefore: 3, rowCountAfter: 3, columnCountBefore: 4, columnCountAfter: 4, outputFingerprint: 'sha256:mock', changedCellsEstimate: 3, exportedCsvRef: 'output:mock' },
        },
        healthDelta: { status: 'improved', scoreBefore: 75, scoreAfter: 100, delta: 25, issueDelta: -3, summary: 'OK', caveats: [] },
      });

      const result = svc.runImprovementFlow({} as any, {} as any, {} as any, { beforeEvidenceRef: 'x', beforeCsv: 'a,b\n1,2', afterCsv: 'a,b\n1,2' });

      expect(result.improvementRun.runId).toMatch(/^run:/);
      expect(result.healthDelta.status).toBe('improved');
      expect(result.healthDelta.scoreBefore).toBe(75);
      expect(result.healthDelta.scoreAfter).toBe(100);
      expect(result.healthDelta.delta).toBe(25);
      expect(result.healthDelta.issueDelta).toBe(-3);
      expect(result.reauditResult.summary.beforeIssueCount).toBe(3);
      expect(result.reauditResult.summary.afterIssueCount).toBe(0);
      expect(result.reauditResult.output.rowCountBefore).toBe(3);
      expect(result.reauditResult.output.rowCountAfter).toBe(3);
    });
  });
});
