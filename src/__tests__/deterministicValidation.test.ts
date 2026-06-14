import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../services/auditEngine';
import {
  buildDeterministicValidationReport,
  computePerRuleMetrics,
  matchGroundTruth,
  SYNTHETIC_GROUND_TRUTH,
  TITANIC_GROUND_TRUTH,
} from '../services/deterministicValidation';
import { AuditReport, IssueCategory, IssueSeverity } from '../types';

const SYNTHETIC_PATH = path.resolve(process.cwd(), '..', 'experiments/datasets/synthetic_ground_truth.csv');
const TITANIC_PATH = path.resolve(process.cwd(), '..', 'experiments/datasets/titanic.csv');

function parseCsv(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(content, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return {
    data: parsed.data as Record<string, any>[],
    fields: parsed.meta.fields as string[],
    delimiter: parsed.meta.delimiter || ',',
  };
}

describe('deterministicValidation service', () => {
  describe('matchGroundTruth', () => {
    it('matches synthetic_ground_truth dataset by field set', () => {
      const { fields } = parseCsv(SYNTHETIC_PATH);
      const gt = matchGroundTruth(fields);
      expect(gt).not.toBeNull();
      expect(gt!.datasetName).toBe('synthetic_ground_truth.csv');
    });

    it('matches titanic dataset by field set', () => {
      const { fields } = parseCsv(TITANIC_PATH);
      const gt = matchGroundTruth(fields);
      expect(gt).not.toBeNull();
      expect(gt!.datasetName).toBe('titanic.csv');
    });

    it('returns null for unknown field sets', () => {
      const gt = matchGroundTruth(['col_a', 'col_b', 'col_c']);
      expect(gt).toBeNull();
    });
  });

  describe('computePerRuleMetrics with synthetic ground truth', () => {
    it('achieves match on all rules expected to be detected', () => {
      const { data, fields, delimiter } = parseCsv(SYNTHETIC_PATH);
      const report = runAudit(data, fields, delimiter);
      const metrics = computePerRuleMetrics(report, SYNTHETIC_GROUND_TRUTH);

      // Exclude documented FPs (expected_fp status) — those are known false positives
      const expectedDetections = metrics.filter((m) => m.status !== 'unexpected_fp' && m.status !== 'expected_fp');
      for (const m of expectedDetections) {
        expect(m.status, `${m.ruleName}: expected match, got ${m.status}`).toBe('match');
      }

      // Verify the documented FP is correctly marked
      const documentedFPs = metrics.filter((m) => m.status === 'expected_fp');
      expect(documentedFPs.length).toBe(1);
    });

    it('reports correct detection for each synthetic rule', () => {
      const { data, fields, delimiter } = parseCsv(SYNTHETIC_PATH);
      const report = runAudit(data, fields, delimiter);
      const metrics = computePerRuleMetrics(report, SYNTHETIC_GROUND_TRUTH);

      const byId = new Map(metrics.map((m) => [m.ruleId, m]));

      // R01: 1 duplicate row detected
      expect(byId.get('integrity-dupes')?.tp).toBe(1);
      // R02: null in nombre detected
      expect(byId.get('integrity-null-nombre')?.tp).toBe(1);
      // R06: 1 mojibake detected
      expect(byId.get('hygiene-moji-nombre')?.tp).toBe(1);
      // R08: toxic placeholders detected across 3 columns
      expect(byId.get('hygiene-toxic-')?.tp).toBe(1);
      expect(byId.get('hygiene-toxic-')?.actualDetected).toBe(3);
      // R14: 1 negative salary detected
      expect(byId.get('logic-neg-salario')?.tp).toBe(1);
      // R19: PII detected
      expect(byId.get('sec-pii-ip_acceso')?.tp).toBe(1);
      expect(byId.get('sec-pii-ip_acceso')?.actualDetected).toBe(15);
      // R12: mixed date detected
      expect(byId.get('logic-mixed-date-fecha_ingreso')?.tp).toBe(1);
      // R24 burned range FP: known false positive
      const burned = byId.get('semantic-burned-range-fecha_ingreso');
      expect(burned?.tp).toBe(0);
      expect(burned?.fp).toBe(1);
      expect(burned?.actualDetected).toBe(14);
    });

    it('reports only documented FPs on synthetic dataset', () => {
      const { data, fields, delimiter } = parseCsv(SYNTHETIC_PATH);
      const report = runAudit(data, fields, delimiter);
      const metrics = computePerRuleMetrics(report, SYNTHETIC_GROUND_TRUTH);

      const unexpectedFPs = metrics.filter((m) => m.status === 'unexpected_fp');
      expect(unexpectedFPs.length).toBe(0);

      // Verify the known FP is correctly marked
      const burnedRange = metrics.find((m) => m.ruleId === 'semantic-burned-range-fecha_ingreso');
      expect(burnedRange).toBeDefined();
      expect(burnedRange!.status).toBe('expected_fp');
      expect(burnedRange!.fp).toBe(1);
      expect(burnedRange!.tp).toBe(0);
    });

    it('produces macro F1 >= 0.9 on synthetic dataset', () => {
      const { data, fields, delimiter } = parseCsv(SYNTHETIC_PATH);
      const report = runAudit(data, fields, delimiter);
      const validation = buildDeterministicValidationReport(report, SYNTHETIC_GROUND_TRUTH);

      expect(validation.groundTruthMatched).toBe(true);
      expect(validation.summary.macroF1).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('computePerRuleMetrics with Titanic', () => {
    it('detects null values in Age and Cabin', () => {
      const { data, fields, delimiter } = parseCsv(TITANIC_PATH);
      const report = runAudit(data, fields, delimiter);
      const metrics = computePerRuleMetrics(report, TITANIC_GROUND_TRUTH);

      const ageMetrics = metrics.find((m) => m.ruleId === 'integrity-null-Age');
      const cabinMetrics = metrics.find((m) => m.ruleId === 'integrity-null-Cabin');

      expect(ageMetrics).toBeDefined();
      expect(ageMetrics!.status).toBe('match');

      expect(cabinMetrics).toBeDefined();
      expect(cabinMetrics!.status).toBe('match');
    });

    it('reports macro F1 >= 0.9 on Titanic', () => {
      const { data, fields, delimiter } = parseCsv(TITANIC_PATH);
      const report = runAudit(data, fields, delimiter);
      const validation = buildDeterministicValidationReport(report, TITANIC_GROUND_TRUTH);

      expect(validation.groundTruthMatched).toBe(true);
      expect(validation.summary.macroF1).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('controlled FP/FN scenarios', () => {
    it('reports FN when a rule is expected but not detected (age column without nulls)', () => {
      const data = [
        { nombre: 'A', edad: '25' },
        { nombre: 'B', edad: '30' },
      ];
      const report = runAudit(data, ['nombre', 'edad'], ',');

      const groundTruth = {
        ...SYNTHETIC_GROUND_TRUTH,
        rulesExpected: [{
          ruleIdPrefix: 'integrity-null-edad',
          ruleName: 'R02 — Nulls en edad',
          category: IssueCategory.INTEGRITY,
          expectedTP: 1,
          expectedFP: 0,
          column: 'edad',
          description: 'Esperamos nulos en edad pero no hay',
        }],
      };

      const metrics = computePerRuleMetrics(report, groundTruth);
      const rule = metrics[0];
      expect(rule.status).toBe('missed');
      expect(rule.fn).toBe(1);
      expect(rule.tp).toBe(0);
    });

    it('reports FP when a non-expected rule fires', () => {
      const data = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        nombre: `name_${i}`,
        edad: i,
      }));
      const report = runAudit(data, ['id', 'nombre', 'edad'], ',');

      const groundTruth = {
        ...SYNTHETIC_GROUND_TRUTH,
        rulesExpected: [], // no rules expected at all
      };

      const metrics = computePerRuleMetrics(report, groundTruth);
      const unexpectedFPs = metrics.filter((m) => m.status === 'unexpected_fp');

      // Some rules fire naturally (like constant column check, etc.) — that's expected behavior
      // The key is they get marked as unexpected_fp
      for (const fp of unexpectedFPs) {
        expect(fp.fp).toBeGreaterThan(0);
        expect(fp.tp).toBe(0);
      }
    });

    it('detects match even when count differs (binary detection model)', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        email: i === 0 ? 'bad-email' : `user${i}@test.com`,
      }));
      const report = runAudit(data, ['email'], ',');

      const groundTruth = {
        ...SYNTHETIC_GROUND_TRUTH,
        rulesExpected: [{
          ruleIdPrefix: 'logic-email-email',
          ruleName: 'R03 — Email Inválido',
          category: IssueCategory.LOGIC,
          expectedTP: 3, // ground truth says 3 expected, but only 1 exists
          expectedFP: 0,
          column: 'email',
          description: 'Binary detection: rule fired = match, count is metadata',
        }],
      };

      const metrics = computePerRuleMetrics(report, groundTruth);
      const rule = metrics[0];
      // Binary detection: rule fired (detected=1), expected (expectedTP>0 → expected=1)
      expect(rule.status).toBe('match');
      expect(rule.tp).toBe(1);
      expect(rule.fn).toBe(0);
      // The actual count is preserved in actualDetected for UI display
      expect(rule.actualDetected).toBe(1);
    });
  });
});
