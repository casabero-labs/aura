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
    fireEvent.click(screen.getByTestId('profile-all-disclosure').querySelector('summary')!);
    const findings = screen.getByRole('region', { name: 'Todos los hallazgos' });
    within(findings).getAllByText('Ver registros y valores').forEach(summary => fireEvent.click(summary));
    expect(within(findings).getAllByRole('row')).toHaveLength(report.issues.length + 1);
    expect(within(findings).getByText('Fecha no válida')).toBeTruthy();
    expect(within(findings).getByText(/Registros: 1, 3, 7, 8, 10, 11/)).toBeTruthy();
    expect(within(findings).getAllByText('Informativo').length).toBeGreaterThan(0);
    expect(screen.queryByText('OK')).toBeNull();
    expect(screen.getByText('Cómo se calculó la puntuación')).toBeTruthy();
  });
  it('waits for approval, then passes rules selected in plain controls', async () => {
    const select = vi.fn(); render(<FileUpload onFileSelect={select} />);
    const csv = new File(['estado,documento\nactvo,0011223344\nactivo,0011223344'], 'clientes.csv');
    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [csv] } });
    await screen.findByRole('heading', { name: 'Reglas y excepciones' });
    expect(select).not.toHaveBeenCalled();
    const column = screen.getByText('documento', { selector: 'summary > span' }).closest('details')!;
    fireEvent.click(within(column).getByText('documento'));
    fireEvent.change(within(column).getByLabelText('Valores repetidos'), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analizar dataset' }));
    expect(select).toHaveBeenCalledWith(csv, { documento: { unique: false } });
  });
  it('blocks contradictory limits and lets the person correct them', async () => {
    const select = vi.fn(); render(<FileUpload onFileSelect={select} />);
    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [new File(['monto\n5\n10'], 'datos.csv')] } });
    await screen.findByRole('heading', { name: 'Reglas y excepciones' });
    fireEvent.change(screen.getByLabelText('Número mínimo'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Número máximo'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analizar dataset' }));
    expect(screen.getByRole('alert').textContent).toContain('mínimo supera');
    expect(select).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Número máximo'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analizar dataset' }));
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('imports optional rules after the CSV and rejects malformed rules', async () => {
    const select = vi.fn(); render(<FileUpload onFileSelect={select} />);
    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [new File(['estado\nactvo\nactivo'], 'clientes.csv')] } });
    await screen.findByRole('heading', { name: 'Reglas y excepciones' });
    const file = new File(['bad'], 'bad.json');
    Object.defineProperty(file, 'text', { value: async () => 'bad' });
    fireEvent.change(screen.getByLabelText('Archivo de reglas (.json)'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Analizar dataset' }));
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retirar reglas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analizar dataset' }));
    expect(select).toHaveBeenCalledTimes(1);
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

describe('exceptions change checks without changing source data', () => {
  it('allows missing values while preserving their count and other checks', () => {
    const rows = [{ monto: '' }, { monto: '-5' }, { monto: '10' }];
    const before = structuredClone(rows);
    const report = runAudit(rows, ['monto'], ',', { columns: { monto: { required: false, allowNegative: true } } });
    expect(report.columnStats.monto.nullCount).toBe(1);
    expect(report.issues.some(issue => issue.ruleId === 'rule:null-values')).toBe(false);
    expect(report.issues.some(issue => issue.ruleId === 'rule:impossible-negatives')).toBe(false);
    expect(rows).toEqual(before);
    expect(report.auditRules).toEqual({ monto: { required: false, allowNegative: true } });
  });
  it('checks explicitly forbidden negatives on a column with a neutral name', () => {
    const report = runAudit([{ lectura: '-5' }, { lectura: '2' }], ['lectura'], ',', { columns: { lectura: { allowNegative: false } } });
    expect(report.issues.find(issue => issue.ruleId === 'rule:impossible-negatives')?.rowNumbers).toEqual([1]);
  });
});

describe('simple profile separates overview from optional evidence', () => {
  it('shows priorities without exposing the complete tables or certifying suitability', () => {
    const report = runAudit(clients, Object.keys(clients[0]), ',');
    render(<ProfileStep report={report} auditEvidence={{ ingestionStatus: 'success' } as AuditExecutionEvidence} onContinue={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Revisión inicial' })).toBeTruthy();
    expect(screen.getByTestId('profile-all-disclosure').hasAttribute('open')).toBe(false);
    expect(screen.getByTestId('profile-tech-disclosure').hasAttribute('open')).toBe(false);
    expect(screen.getAllByTestId('profile-priority-item')).toHaveLength(3);
    expect(screen.getByText(/Un registro puede aparecer en varios avisos/)).toBeTruthy();
    expect(screen.queryByText('Requiere limpieza')).toBeNull();
    expect(screen.queryByText(/dataset es usable/)).toBeNull();
    expect(screen.getByTestId('profile-continue-diagnosis')).toBeTruthy();
    fireEvent.click(screen.getByTestId('profile-all-disclosure').querySelector('summary')!);
    expect(within(screen.getByRole('region', { name: 'Todos los hallazgos' })).getAllByRole('row')).toHaveLength(report.issues.length + 1);
  });
  it('keeps a fourth priority accessible and reports that the overview is partial', () => {
    const base = runAudit(clients, Object.keys(clients[0]), ',');
    const critical = base.issues.find(issue => issue.severity === 'critical')!;
    const report = { ...base, issues: Array.from({ length: 4 }, (_, index) => ({ ...critical, id: `priority-${index}` })) };
    render(<ProfileStep report={report} auditEvidence={{ ingestionStatus: 'success' } as AuditExecutionEvidence} onContinue={() => {}} />);
    expect(screen.getAllByTestId('profile-priority-item')).toHaveLength(3);
    expect(screen.getByText(/Se muestran 3 de 4 avisos/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('profile-all-disclosure').querySelector('summary')!);
    expect(within(screen.getByRole('region', { name: 'Todos los hallazgos' })).getAllByRole('row')).toHaveLength(5);
  });
  it('shows informational findings even when there are no priority warnings', () => {
    const base = runAudit(clients, Object.keys(clients[0]), ',');
    const report = { ...base, issues: base.issues.filter(issue => issue.severity === 'info') };
    render(<ProfileStep report={report} auditEvidence={{ ingestionStatus: 'success' } as AuditExecutionEvidence} onContinue={() => {}} />);
    expect(screen.getByText('No se encontraron avisos prioritarios.')).toBeTruthy();
    expect(screen.queryByTestId('profile-first-review')).toBeNull();
    fireEvent.click(screen.getByTestId('profile-all-disclosure').querySelector('summary')!);
    expect(within(screen.getByRole('region', { name: 'Todos los hallazgos' })).getAllByRole('row')).toHaveLength(report.issues.length + 1);
  });
});
