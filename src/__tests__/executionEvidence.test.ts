import { describe, expect, it } from 'vitest';
import { buildAuditEvidence, buildIngestionEvidence, fingerprintDataset } from '../services/executionEvidence';
import { AuditReport, IssueCategory, IssueSeverity } from '../types';

const stubReport: AuditReport = {
  score: 82,
  rowCount: 100,
  colCount: 4,
  duplicateRows: 2,
  delimiterDetected: ',',
  columnStats: {},
  issues: [
    {
      id: 'logic-email-email',
      column: 'email',
      ruleName: 'Formato Email Inválido',
      category: IssueCategory.LOGIC,
      description: 'Desc',
      severity: IssueSeverity.CRITICAL,
      count: 2,
      affectedPercentage: 2,
      sampleValues: ['bad'],
      ruleId: 'rule:test',
    },
  ],
  scoreBreakdown: [],
};

describe('buildIngestionEvidence', () => {
  it('construye evidencia de ingestión válida con todos los campos', () => {
    const evidence = buildIngestionEvidence({
      fileName: 'test.csv',
      fileSize: 2048,
      datasetFingerprint: 'abc12345',
      startedAt: '2026-06-14T00:00:00.000Z',
      completedAt: '2026-06-14T00:00:01.500Z',
      parseDurationMs: 1500,
      rowsProcessed: 500,
      columnsProcessed: 12,
      delimiter: ',',
      truncated: false,
      ingestionStatus: 'success',
    });

    expect(evidence.fileName).toBe('test.csv');
    expect(evidence.fileSize).toBe(2048);
    expect(evidence.datasetFingerprint).toBe('abc12345');
    expect(evidence.parseDurationMs).toBe(1500);
    expect(evidence.rowsProcessed).toBe(500);
    expect(evidence.columnsProcessed).toBe(12);
    expect(evidence.delimiter).toBe(',');
    expect(evidence.truncated).toBe(false);
    expect(evidence.ingestionStatus).toBe('success');
    expect(evidence.ingestionError).toBeUndefined();
    expect(evidence.id).toMatch(/^ingest-/);
  });

  it('construye evidencia de ingestión con error', () => {
    const evidence = buildIngestionEvidence({
      fileName: 'malo.xlsx',
      fileSize: 1024,
      datasetFingerprint: 'error',
      startedAt: '2026-06-14T00:00:00.000Z',
      completedAt: '2026-06-14T00:00:00.050Z',
      parseDurationMs: 50,
      rowsProcessed: 0,
      columnsProcessed: 0,
      delimiter: ',',
      truncated: false,
      ingestionStatus: 'error',
      ingestionError: 'El archivo no es un CSV válido',
    });

    expect(evidence.ingestionStatus).toBe('error');
    expect(evidence.ingestionError).toBe('El archivo no es un CSV válido');
    expect(evidence.rowsProcessed).toBe(0);
    expect(evidence.columnsProcessed).toBe(0);
    expect((evidence as any).auditDurationMs).toBeUndefined();
    expect((evidence as any).score).toBeUndefined();
  });
});

describe('buildAuditEvidence incluye contrato de ingestión', () => {
  it('incluye fileSize, ingestionStatus y resto del contrato', () => {
    const evidence = buildAuditEvidence({
      fileName: 'data.csv',
      fileSize: 4096,
      datasetFingerprint: 'def67890',
      startedAt: '2026-06-14T00:00:00.000Z',
      completedAt: '2026-06-14T00:00:02.000Z',
      parseDurationMs: 800,
      auditDurationMs: 1200,
      rowsProcessed: 1000,
      columnsProcessed: 8,
      delimiter: ';',
      truncated: true,
      ingestionStatus: 'success',
      report: stubReport,
      trace: [],
    });

    expect(evidence.fileSize).toBe(4096);
    expect(evidence.ingestionStatus).toBe('success');
    expect(evidence.ingestionError).toBeUndefined();
    expect(evidence.delimiter).toBe(';');
    expect(evidence.truncated).toBe(true);
    expect(evidence.totalDurationMs).toBe(2000);
    expect(evidence.issueCount).toBe(1);
    expect(evidence.score).toBe(82);
    expect(evidence.id).toMatch(/^audit-/);
  });
});

describe('fingerprintDataset', () => {
  it('genera fingerprint reproducible para el mismo dataset', () => {
    const data = [
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
      { a: 3, b: 'z' },
    ];
    const fields = ['a', 'b'];

    const fp1 = fingerprintDataset(data, fields);
    const fp2 = fingerprintDataset([...data], [...fields]);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(8);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('genera fingerprint distinto para datasets diferentes', () => {
    const data1 = [{ a: 1 }, { a: 2 }];
    const data2 = [{ a: 1 }, { a: 3 }];
    const fields = ['a'];

    expect(fingerprintDataset(data1, fields)).not.toBe(fingerprintDataset(data2, fields));
  });
});
