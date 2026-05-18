import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../services/auditEngine';
import { IssueSeverity, IssueCategory } from '../types';

const TITANIC_PATH = path.resolve(process.cwd(), 'experiments/datasets/titanic.csv');

function loadTitanic() {
  const csvData = fs.readFileSync(TITANIC_PATH, 'utf-8');
  const parsed = Papa.parse(csvData, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return { data: parsed.data as Record<string, any>[], fields: parsed.meta.fields as string[] };
}

describe('AuditEngine - Deterministic Rules', () => {
  describe('R4 Fix: Mixed Types Skip for Code Columns', () => {
    it('should NOT report integrity-mixed-Ticket on Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');
      const mixedTicketIssues = result.issues.filter(i => i.id === 'integrity-mixed-Ticket');
      expect(mixedTicketIssues).toHaveLength(0);
    });

    it('should still detect null values in Age column on Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');
      const ageNullIssues = result.issues.filter(i => i.id === 'integrity-null-Age');
      expect(ageNullIssues).toHaveLength(1);
      expect(ageNullIssues[0].ruleName).toBe('Valores Nulos / Vacíos');
    });
  });

  describe('Null Detection', () => {
    it('should report Age column with nulls on Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');

      const ageNullIssue = result.issues.find(i => i.id === 'integrity-null-Age');
      expect(ageNullIssue).toBeDefined();
      expect(ageNullIssue!.affectedPercentage).toBeGreaterThan(0);
      expect(ageNullIssue!.affectedPercentage).toBeLessThan(100);
    });
  });

  describe('Constant Column', () => {
    it('should detect a column where all values are identical', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        constant: 'same_value',
        name: `name_${i}`,
      }));
      const fields = ['id', 'constant', 'name'];

      const result = runAudit(data, fields, ',');

      const constIssue = result.issues.find(i => i.id === 'integrity-constant-constant');
      expect(constIssue).toBeDefined();
      expect(constIssue!.ruleName).toBe('Columna Constante');
      expect(constIssue!.severity).toBe(IssueSeverity.WARNING);
    });
  });

  describe('Score Range', () => {
    it('should return a score between 0 and 100 for Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Future Dates (Freshness)', () => {
    it('should detect future dates beyond threshold in datetime columns', () => {
      const futureDate = '2099-12-31 00:00:00';
      const validDate = '2023-01-15 00:00:00';
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        fecha_hora: i < 10 ? futureDate : validDate,
      }));
      const fields = ['id', 'fecha_hora'];

      const result = runAudit(data, fields, ',');

      const freshnessIssue = result.issues.find(i => i.id === 'logic-freshness-fecha_hora');
      expect(freshnessIssue).toBeDefined();
      expect(freshnessIssue!.ruleName).toBe('Fechas Futuras (Freshness)');
      expect(freshnessIssue!.severity).toBe(IssueSeverity.CRITICAL);
    });
  });
});
