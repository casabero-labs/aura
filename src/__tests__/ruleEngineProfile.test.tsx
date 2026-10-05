// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import ProfileStep from '../components/ProfileStep';
import FileUpload from '../components/FileUpload';
import { runAudit } from '../services/auditEngine';
import { runReaudit } from '../services/reauditService';
import { parseDatasetRules } from '../services/ruleChecks';
import clients from '../../experiments/rule-engine/fixtures/clientes_sucio.json';
import type { AuditExecutionEvidence } from '../types';

afterEach(cleanup);
describe('all findings remain available to the person reviewing the CSV', () => {
  it('shows every finding, its severity, row references and score explanation', () => {
    const report = runAudit(clients, Object.keys(clients[0]), ',', { referenceDate: '2026-10-05' });
    render(<ProfileStep report={report} auditEvidence={{ ingestionStatus: 'success' } as AuditExecutionEvidence} onContinue={() => {}} />);
    const findings = screen.getByRole('region', { name: 'Todos los hallazgos' });
    expect(within(findings).getAllByRole('row')).toHaveLength(report.issues.length + 1);
    expect(within(findings).getByText('Fecha no válida')).toBeTruthy();
    expect(within(findings).getByText(/Registros: 1, 3, 7, 8, 10, 11/)).toBeTruthy();
    expect(within(findings).getAllByText('informativo').length).toBeGreaterThan(0);
    expect(screen.queryByText('OK')).toBeNull();
    expect(screen.getByText('Cómo se calculó la puntuación')).toBeTruthy();
  });
  it('passes declared rules from the upload control into the audit request', async () => {
    const select = vi.fn();
    render(<FileUpload onFileSelect={select} />);
    const file = new File(['{}'], 'clientes.rules.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{"estado":{"allowedValues":["activo"]}}' });
    fireEvent.change(screen.getByLabelText('Archivo de reglas (.json)'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Reglas listas: clientes.rules.json')).toBeTruthy());
    const csv = new File(['estado\nactvo'], 'clientes.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [csv] } });
    expect(select).toHaveBeenCalledWith(csv, { estado: { allowedValues: ['activo'] } });
  });
  it('blocks malformed rule files until they are removed', async () => {
    const select = vi.fn(); render(<FileUpload onFileSelect={select} />);
    const file = new File(['bad'], 'bad.json');
    Object.defineProperty(file, 'text', { value: async () => 'bad' });
    fireEvent.change(screen.getByLabelText('Archivo de reglas (.json)'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    const csv = new File(['estado\nactvo'], 'clientes.csv');
    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [csv] } });
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retirar reglas' }));
    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [csv] } });
    expect(select).toHaveBeenCalledWith(csv, undefined);
  });
  it('uses the same domain rules and reference date when comparing corrected data', () => {
    const columns = parseDatasetRules('{"estado":{"allowedValues":["activo"]}}');
    const comparison = runReaudit('estado\nactvo\n', 'estado\nactivo\n', 'test', { columns, referenceDate: '2026-10-05T00:00:00Z' });
    expect(comparison.beforeReport.issues.some(issue => issue.ruleId === 'rule:domain-values')).toBe(true);
    expect(comparison.afterReport.issues.some(issue => issue.ruleId === 'rule:domain-values')).toBe(false);
    expect(comparison.beforeReport.auditRules).toEqual(comparison.afterReport.auditRules);
    expect(comparison.beforeReport.auditReferenceDate).toBe(comparison.afterReport.auditReferenceDate);
  });
});
