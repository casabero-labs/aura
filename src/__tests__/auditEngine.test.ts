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

// Per-rule TP/FP/FN tracker
interface RuleResult { tp: number; fp: number; fn: number; }

function scoreRule(label: string, tp: number, fp: number, fn: number): RuleResult {
  const p = tp + fp > 0 ? tp / (tp + fp) : 1;
  const r = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = p + r > 0 ? 2 * p * r / (p + r) : 0;
  console.log(`  ${label}: TP=${tp} FP=${fp} FN=${fn}  P=${p.toFixed(3)} R=${r.toFixed(3)} F1=${f1.toFixed(3)}`);
  return { tp, fp, fn };
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

describe('Per-Rule TP/FP/FN on Titanic dataset', () => {
  it('R01–R23: all rules fired on Titanic with known ground truth', () => {
    const { data, fields } = loadTitanic();
    const result = runAudit(data, fields, ',');

    const groundTruth: Array<{ ruleId: string; etp: number; efp: number; efn: number; label: string }> = [
      { ruleId: 'integrity-duplicates',    etp: 0, efp: 0, efn: 0, label: 'R01 Duplicated Rows' },
      { ruleId: 'integrity-null-Age',      etp: 1, efp: 0, efn: 0, label: 'R02 Age nulls' },
      { ruleId: 'integrity-null-Cabin',    etp: 1, efp: 0, efn: 0, label: 'R02 Cabin nulls' },
      { ruleId: 'integrity-constant-',     etp: 0, efp: 0, efn: 0, label: 'R03 Constant Column' },
      { ruleId: 'integrity-mixed-Ticket',  etp: 0, efp: 0, efn: 0, label: 'R04 Ticket mixed (skipped)' },
      { ruleId: 'hygiene-ghost-',          etp: 0, efp: 0, efn: 0, label: 'R05 Ghost Spaces' },
      { ruleId: 'hygiene-moji-',           etp: 0, efp: 0, efn: 0, label: 'R06 Mojibake' },
      { ruleId: 'hygiene-case-',           etp: 0, efp: 0, efn: 0, label: 'R07 Cap Chaos' },
      { ruleId: 'hygiene-toxic-',          etp: 0, efp: 0, efn: 0, label: 'R08 Toxic Placeholders' },
      { ruleId: 'logic-mixed-date-',       etp: 0, efp: 0, efn: 0, label: 'R09 Mixed Date Formats' },
      { ruleId: 'hygiene-space-',          etp: 0, efp: 0, efn: 0, label: 'R10 Double Spaces' },
      { ruleId: 'logic-url-',              etp: 0, efp: 0, efn: 0, label: 'R12 URL Format' },
      { ruleId: 'hygiene-over-',           etp: 0, efp: 0, efn: 0, label: 'R13 Text Overflow' },
      { ruleId: 'type-disguised-',         etp: 0, efp: 0, efn: 0, label: 'R14 Disguised Numbers' },
      { ruleId: 'type-date-',              etp: 0, efp: 0, efn: 0, label: 'R15 Hidden Dates' },
      { ruleId: 'type-corrupt-',           etp: 0, efp: 0, efn: 0, label: 'R16 Corrupt IDs' },
      { ruleId: 'type-time-',               etp: 0, efp: 0, efn: 0, label: 'R17 Redundant Time' },
      { ruleId: 'logic-neg-',              etp: 0, efp: 0, efn: 0, label: 'R18 Negative Values' },
      { ruleId: 'logic-email-',            etp: 0, efp: 0, efn: 0, label: 'R20 Invalid Email' },
      { ruleId: 'logic-phone-',            etp: 0, efp: 0, efn: 0, label: 'R21 Phone Variance' },
      { ruleId: 'sec-pii-',                 etp: 0, efp: 0, efn: 0, label: 'R22 PII Detection' },
      { ruleId: 'logic-freshness-',        etp: 0, efp: 0, efn: 0, label: 'R23 Future Dates' },
      { ruleId: 'logic-outlier-tukey-',   etp: 1, efp: 0, efn: 0, label: 'R-Tukey Mild Outliers (Fare has mild outliers)' },
    ];

    console.log('\n=== Per-Rule Evaluation on Titanic ===');
    for (const gt of groundTruth) {
      const issues = result.issues.filter(i => i.id.startsWith(gt.ruleId));
      const actualTP = issues.length > 0 ? 1 : 0;
      const fp = actualTP > gt.etp ? actualTP - gt.etp : 0;
      const fn = gt.etp > actualTP ? gt.etp - actualTP : 0;
      scoreRule(gt.label, gt.etp, fp, fn);
      expect(fp, `${gt.label}: unexpected FP`).toBe(0);
    }

    const ageNullIssue = result.issues.find(i => i.id === 'integrity-null-Age');
    expect(ageNullIssue).toBeDefined();
    const cabinNullIssue = result.issues.find(i => i.id === 'integrity-null-Cabin');
    expect(cabinNullIssue).toBeDefined();
  });
});
