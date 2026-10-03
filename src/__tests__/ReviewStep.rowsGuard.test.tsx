// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AuditReport } from '../types';

const createImprovementRun = vi.fn();
vi.mock('../services/improvementService', () => ({
  createImprovementRun: (...args: unknown[]) => createImprovementRun(...args),
}));

import ReviewStep from '../components/ReviewStep';

const report = {
  score: 80, rowCount: 3, colCount: 2, duplicateRows: 0, issues: [],
  columnStats: {}, scoreBreakdown: [], delimiterDetected: ',',
} as unknown as AuditReport;

const renderReview = (props: Partial<React.ComponentProps<typeof ReviewStep>> = {}) =>
  render(
    <ReviewStep
      report={report}
      rawData={[]}
      csvFields={['Name', 'Age']}
      csvDelimiter=","
      cleaningScript={'import pandas as pd\n'}
      approvedScript=""
      scriptContractV2={null}
      {...props}
    />,
  );

describe('ReviewStep — sesión restaurada sin filas', () => {
  beforeEach(() => createImprovementRun.mockReset());

  it('blocks the simulation and asks for the same file instead of running on []', () => {
    const onScriptApproved = vi.fn();
    renderReview({ onScriptApproved, onReimportSource: vi.fn() });

    expect(screen.getByTestId('review-rows-missing').textContent).toContain('vuelve a seleccionar el mismo archivo');
    fireEvent.click(screen.getByRole('button', { name: /Aprobar script/ }));

    expect(createImprovementRun).not.toHaveBeenCalled();
    expect(onScriptApproved).not.toHaveBeenCalled();
  });

  it('reimports through the hash-checked callback and surfaces a mismatch', async () => {
    const onReimportSource = vi.fn().mockResolvedValue('El archivo seleccionado no es el mismo que se auditó (SHA-256 distinto).');
    renderReview({ onReimportSource });

    const file = new File(['Name,Age\nOtro,1\n'], 'otro.csv', { type: 'text/csv' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('review-reimport-source'), { target: { files: [file] } });
    });

    expect(onReimportSource).toHaveBeenCalledWith(file);
    expect(screen.getByTestId('review-reimport-error').textContent).toContain('SHA-256 distinto');
  });

  it('does not show the guard when rows are in memory', () => {
    renderReview({ rawData: [{ Name: 'Ana', Age: '30' }] });
    expect(screen.queryByTestId('review-rows-missing')).toBeNull();
  });
});
