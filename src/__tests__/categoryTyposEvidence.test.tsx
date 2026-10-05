// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { runAudit } from '../services/auditEngine';
import { findPossibleCategoryTypos } from '../services/categoricalTypos';
import ProfileStep from '../components/ProfileStep';
import { IssueSeverity, RULE_IDS, type AuditExecutionEvidence } from '../types';

afterEach(cleanup);
const load = (name: string) => Papa.parse<Record<string, string>>(readFileSync(
  path.resolve(__dirname, '../../experiments/rule-engine/fixtures', name), 'utf8'),
{ header: true, dynamicTyping: false, skipEmptyLines: true });
const audit = (name: string) => {
  const parsed = load(name);
  expect(parsed.errors).toEqual([]);
  return runAudit(parsed.data, parsed.meta.fields!, ',', { referenceDate: '2026-10-05' });
};

describe('review possible spelling errors without extra configuration', () => {
  it('flags the isolated actvo, identifies its record and never authorizes a change', () => {
    const { data, meta } = load('controlada_limpia.csv');
    data[3].estado = 'actvo';
    const original = structuredClone(data);
    const report = runAudit(data, meta.fields!, ',');
    const issue = report.issues.find(item => item.id === 'semantic-possible-typos-estado')!;
    expect(issue.severity).toBe(IssueSeverity.WARNING);
    expect(issue.count).toBe(1);
    expect(issue.rowNumbers).toEqual([4]);
    expect(issue.rowEvidence).toEqual([{ rowNumber: 4, value: 'actvo' }]);
    expect(issue.sampleValues).toEqual(['actvo', 'activo']);
    expect(issue.automaticAuthorization?.authorized).toBe(false);
    expect(data).toEqual(original);
    expect(report.score).toBeLessThan(100);
  });
  it('leaves the clean file without warnings or deductions', () => {
    expect(audit('controlada_limpia.csv')).toMatchObject({ score: 100, issues: [] });
  });
  it.each(['Name', 'nombre', 'apellido', 'documento', 'codigo', 'ticket', 'observaciones'])
  ('does not treat %s as a vocabulary to consolidate', column => {
    expect(findPossibleCategoryTypos(column, ['activo', 'activo', 'activo', 'actvo'])).toEqual([]);
  });
  it('does not flag well established alternatives, casing, accents or negated categories', () => {
    for (const values of [
      ['activo', 'activo', 'actvo', 'actvo'],
      ['activo', 'activo', 'activo', 'ACTIVO'],
      ['Montería', 'Montería', 'Montería', 'Monteria'],
      ['activo', 'activo', 'activo', 'inactivo'],
    ]) expect(findPossibleCategoryTypos('estado', values)).toEqual([]);
  });
  it.each(['actvio', 'activoo', 'actibo'])('flags a rare spelling variant %s', value => {
    const found = findPossibleCategoryTypos('estado', ['activo', 'activo', 'activo', value]);
    expect(found).toEqual([{ value, similarValue: 'activo', count: 1, rowNumbers: [4] }]);
  });
  it('respects an explicit list of valid categories', () => {
    const rows = ['activo', 'activo', 'activo', 'actvo'].map(estado => ({ estado }));
    const report = runAudit(rows, ['estado'], ',', { columns: { estado: { allowedValues: ['activo', 'actvo'] } } });
    expect(report.issues.some(issue => issue.id === 'semantic-possible-typos-estado')).toBe(false);
  });
  it('bounds evidence even when the file is large', () => {
    const rows = [...Array(300).fill('activo'), ...Array(50).fill('actvo')].map(estado => ({ estado }));
    const issue = runAudit(rows, ['estado'], ',').issues.find(item => item.id === 'semantic-possible-typos-estado')!;
    expect(issue.count).toBe(50);
    expect(issue.rowNumbers).toHaveLength(20);
    expect(issue.rowEvidence).toHaveLength(3);
    expect(issue.rowNumbers![0]).toBe(301);
  });
});

describe('source values and record numbers are available for human review', () => {
  it('locates every finding in the controlled file and preserves source text', () => {
    const report = audit('controlada_sucia.csv');
    for (const issue of report.issues) {
      expect(issue.rowNumbers?.length, issue.ruleName).toBeGreaterThan(0);
      expect(issue.rowEvidence?.length, issue.ruleName).toBeGreaterThan(0);
    }
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.INVALID_EMAIL)?.rowNumbers).toEqual([5, 6]);
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.IMPOSSIBLE_NEGATIVES)?.rowEvidence)
      .toEqual([{ rowNumber: 10, value: '-12000' }]);
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.MIXED_DATE_FORMATS)?.rowNumbers).toEqual([8]);
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.DUPLICATE_KEY)?.rowEvidence)
      .toEqual([{ rowNumber: 1, value: '0011223344' }, { rowNumber: 4, value: '0011223344' }]);
  });
  it('shows the original cells, missing value explanations and the suspected counterpart', () => {
    const report = audit('controlada_sucia.csv');
    render(<ProfileStep report={report} auditEvidence={{ ingestionStatus: 'success' } as AuditExecutionEvidence} onContinue={() => {}} />);
    fireEvent.click(screen.getByTestId('profile-all-disclosure').querySelector('summary')!);
    const findings = within(screen.getByRole('region', { name: 'Todos los hallazgos' }));
    findings.getAllByText('Ver registros y valores').forEach(summary => fireEvent.click(summary));
    expect(findings.getByRole('cell', { name: /Registro 5: "no-es-email"/ })).toBeTruthy();
    expect(findings.getByRole('cell', { name: /Registro 6: "marta@"/ })).toBeTruthy();
    expect(findings.getByRole('cell', { name: /Registro 10: "-12000"/ })).toBeTruthy();
    expect(findings.getByRole('cell', { name: /Registro 12: \(vacío\)/ })).toBeTruthy();
    const missingNames = findings.getByRole('row', { name: /^Valores Nulos \/ Vacíos Name / });
    expect(within(missingNames).getByRole('cell', { name: /Registro 3: \(solo espacios\)/ })).toBeTruthy();
    expect(findings.getByText(/«actvo» se parece a «activo»/)).toBeTruthy();
  });
});
