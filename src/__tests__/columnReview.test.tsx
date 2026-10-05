// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ColumnReview from '../components/ColumnReview';
import { runAudit } from '../services/auditEngine';

afterEach(cleanup);
const rows = [{ documento: '0011223344', nombre: ' Ana ', monto: '10' }, { documento: '0011223344', nombre: '', monto: '20' }];
const report = runAudit(rows, Object.keys(rows[0]), ',');
const show = (value = report) => render(<ColumnReview report={value} issueName={issue => issue.ruleName} renderEvidence={issue => <p>{issue.description}</p>} />);

describe('columns are explained before statistics', () => {
  it('shows every column with filled records and warning counts before a selection', () => {
    show();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.queryByTestId('profile-column-detail')).toBeNull();
    const name = screen.getByRole('row', { name: /nombre/ });
    expect(within(name).getByText('1 de 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver columna documento' })).toBeTruthy();
    expect(screen.queryByText('IQR')).toBeNull();
  });
  it('opens original examples and actual findings, keeps calculations closed and restores focus', () => {
    show();
    const button = screen.getByRole('button', { name: 'Ver columna documento' });
    fireEvent.click(button);
    const detail = within(screen.getByTestId('profile-column-detail'));
    expect(detail.getByText(/Tipo estimado: Texto/)).toBeTruthy();
    expect(detail.getAllByText('0011223344').length).toBeGreaterThan(0);
    expect(detail.getByText('Identificador repetido')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'documento' })).toBe(document.activeElement);
    expect(detail.getByText('Ver cálculos estadísticos').closest('details')!.hasAttribute('open')).toBe(false);
    fireEvent.click(detail.getByText('Ver cálculos estadísticos'));
    expect(detail.getByText('Ver cálculos estadísticos').closest('details')!.hasAttribute('open')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByTestId('profile-column-detail')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
  it('changes the selected column without accumulating panels or removing warnings', () => {
    show(); fireEvent.click(screen.getByRole('button', { name: 'Ver columna documento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver columna nombre' }));
    expect(screen.getAllByTestId('profile-column-detail')).toHaveLength(1);
    expect(screen.getByTestId('profile-column-detail').textContent).toContain('registros están sin dato');
    expect(screen.getByTestId('profile-column-detail').textContent).toContain('Valores Nulos / Vacíos');
    expect(screen.getByTestId('profile-column-detail').querySelector('.column-review-examples')?.textContent).toContain(' Ana ');
  });
  it('finds columns in a wide file and recovers from an empty search', () => {
    const wide = Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`columna_${index}`, 'abc']));
    show(runAudit([wide, { ...wide }], Object.keys(wide), ','));
    fireEvent.change(screen.getByLabelText('Buscar columna'), { target: { value: 'columna_13' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Buscar columna'), { target: { value: 'no_existe' } });
    expect(screen.getByText('No hay columnas con ese nombre.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todas las columnas' }));
    expect(screen.getAllByRole('row')).toHaveLength(15);
  });
});
