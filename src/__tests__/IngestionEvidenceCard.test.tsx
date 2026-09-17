// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import IngestionEvidenceCard from '../components/IngestionEvidenceCard';
import { AuditExecutionEvidence } from '../types';

const baseEvidence: AuditExecutionEvidence = {
  id: 'ing-001',
  fileName: 'titanic-mini.csv',
  fileSize: 1234,
  datasetFingerprint: 'fp-abc123',
  datasetSha256: '0123456789abcdef0123456789abcdef',
  startedAt: '2026-09-17T00:00:00.000Z',
  completedAt: '2026-09-17T00:00:01.000Z',
  parseDurationMs: 12,
  auditDurationMs: 30,
  totalDurationMs: 42,
  rowsProcessed: 10,
  columnsProcessed: 12,
  delimiter: ',',
  truncated: false,
  ingestionStatus: 'success',
  issueCount: 3,
  score: 75,
  trace: [],
};

describe('IngestionEvidenceCard (identidad + detalle)', () => {
  it('muestra identidad y hechos sin tarjetas de métricas', () => {
    render(<IngestionEvidenceCard evidence={baseEvidence} />);
    expect(screen.getByRole('heading', { name: 'titanic-mini.csv' })).toBeTruthy();
    expect(screen.getByText(/10 filas · 12 columnas/)).toBeTruthy();
    expect(screen.queryByText('CONTRATO DE INGESTIÓN')).toBeNull();
  });

  it('declara el error de ingesta en la misma sección con causa', () => {
    render(
      <IngestionEvidenceCard
        evidence={{ ...baseEvidence, ingestionStatus: 'error', ingestionError: 'CSV vacío' }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('CSV vacío');
    expect(screen.getByText(/ingestión fallida/)).toBeTruthy();
  });
});
