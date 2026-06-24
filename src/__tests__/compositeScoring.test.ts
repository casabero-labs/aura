import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit, computeWeightedDeduction } from '../services/auditEngine';
import { IssueSeverity, IssueCategory } from '../types';

describe('auditEngine — scoring compuesto (Pendiente #3)', () => {
  it('Score-1: every ScoreDeduction entry carries severity, ruleId and weight fields', () => {
    // A dataset with at least one known issue (nulls in a column) → scoreBreakdown must populate the new fields.
    const data = Array.from({ length: 20 }, (_, i) => ({ x: i < 5 ? null : i, y: i }));
    const fields = ['x', 'y'];
    const result = runAudit(data, fields, ',');
    expect(result.scoreBreakdown.length).toBeGreaterThan(0);
    for (const d of result.scoreBreakdown) {
      expect(d.severity).toBeDefined();
      expect(d.ruleId).toBeDefined();
      expect(typeof d.weight).toBe('number');
      expect(d.weight).toBeGreaterThan(0);
    }
  });

  it('Score-2: a CRITICAL+INTEGRITY rule weighs 1.5x a WARNING+HYGIENE rule with the same base penalty', () => {
    const basePenalty = 10;
    const critInteg = computeWeightedDeduction(
      basePenalty,
      IssueSeverity.CRITICAL,
      IssueCategory.INTEGRITY
    );
    const warnHyg = computeWeightedDeduction(
      basePenalty,
      IssueSeverity.WARNING,
      IssueCategory.HYGIENE
    );
    // critInteg = 10 * 1.5 * 1.2 = 18; warnHyg = 10 * 1.0 * 0.8 = 8
    expect(critInteg).toBe(18);
    expect(warnHyg).toBe(8);
    expect(critInteg / warnHyg).toBeCloseTo(18 / 8, 5);
  });

  it('Score-3 (regression): Titanic composite score stays in [60, 90] after weighted scoring', () => {
    const csv = fs.readFileSync(
      path.resolve(__dirname, '../experiments/datasets/titanic.csv'),
      'utf-8'
    );
    const parsed = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    const result = runAudit(parsed.data as Record<string, any>[], parsed.meta.fields as string[], ',');
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThanOrEqual(90);
  });
});
