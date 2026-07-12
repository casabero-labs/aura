import { describe, expect, it } from 'vitest';
import { buildExportArtifactIdentity } from '../services/exportArtifactIdentity';
import type { AuditReport } from '../types';

const report = {
  score: 91,
  rowCount: 2,
  colCount: 1,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [],
  columnStats: {},
} as unknown as AuditReport;

describe('buildExportArtifactIdentity', () => {
  it('is deterministic and links the run, dataset and diagnosis receipt', () => {
    const input = {
      report,
      auditEvidence: {
        id: 'run-001',
        datasetSha256: 'a'.repeat(64),
      } as any,
      diagnosisReceiptHash: 'b'.repeat(64),
    };

    const first = buildExportArtifactIdentity(input);
    const second = buildExportArtifactIdentity(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      runId: 'run-001',
      datasetSha256: 'a'.repeat(64),
      diagnosisReceiptHash: 'b'.repeat(64),
    });
    expect(first.reportContentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes the report identity when canonical report content changes', () => {
    const first = buildExportArtifactIdentity({ report });
    const second = buildExportArtifactIdentity({ report: { ...report, score: 90 } });

    expect(second.reportContentHash).not.toBe(first.reportContentHash);
    expect(second.reportId).not.toBe(first.reportId);
  });
});
