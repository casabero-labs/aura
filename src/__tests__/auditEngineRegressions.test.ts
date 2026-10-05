/**
 * Regressions found auditing the full 891-row titanic.csv:
 *  1. numeric coercion merged distinct texts ("120" / "120.00") and leaked
 *     coerced numbers into samples;
 *  2. «Cola Larga Categórica» on a one-value-per-row column (Name) and IQR
 *     outliers on a mixed code column (Ticket);
 *  3. privacy masking turned numbers into misleading "1***8" strings while
 *     person names travelled in clear;
 *  4. the future-date rule read the wall clock, so the same file scored
 *     differently over time.
 */
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { runAudit, FUTURE_DATE_GRACE_DAYS } from '../services/auditEngine';
import { auditValue } from '../services/auditValue';
import { RULE_IDS, IssueSeverity } from '../types';
import { _buildEvidenceEnvelopeV2, type AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import { isPII, isPersonNameColumn, minimizeEvidenceValue } from '../contracts/llm/privacyPolicy';

// Full dataset at the repository root (src/experiments/datasets has only 20 rows).
const TITANIC_FULL_PATH = path.resolve(__dirname, '../../experiments/datasets/titanic.csv');
const FIXED_REFERENCE = '2026-10-05T00:00:00.000Z';

const loadTitanicFull = () => {
  // Same parsing as the app (csvService): text preserved, no dynamic typing.
  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(TITANIC_FULL_PATH, 'utf-8'), {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  return { data: parsed.data, fields: parsed.meta.fields as string[] };
};

const OUTLIER_RULES: string[] = [RULE_IDS.EXTREME_OUTLIERS, RULE_IDS.MILD_OUTLIERS];

describe('runAudit on the full 891-row titanic.csv', () => {
  const { data, fields } = loadTitanicFull();
  const report = runAudit(data, fields, ',', { referenceDate: FIXED_REFERENCE });

  it('reads all 891 rows', () => {
    expect(report.rowCount).toBe(891);
  });

  it('does not report a categorical long tail on Name (891/891 distinct)', () => {
    expect(report.columnStats.Name.uniqueCount).toBe(891);
    expect(report.issues.filter(i => i.column === 'Name' && i.ruleId === RULE_IDS.LONG_TAIL_CATEGORICAL)).toHaveLength(0);
  });

  it('does not run numeric outlier rules on Ticket (mixed codes)', () => {
    expect(report.columnStats.Ticket.inferredType).toBe('mixed');
    expect(report.issues.filter(i => i.column === 'Ticket' && OUTLIER_RULES.includes(i.ruleId))).toHaveLength(0);
  });

  it('still reports outliers on genuinely numeric columns (Fare) with the file text as samples', () => {
    const fare = report.issues.find(i => i.column === 'Fare' && i.ruleId === RULE_IDS.EXTREME_OUTLIERS);
    expect(fare).toBeDefined();
    for (const sample of fare!.sampleValues) expect(typeof sample).toBe('string');
  });

  it('reports Cabin nulls as critical with 687 missing values', () => {
    const cabin = report.issues.find(i => i.column === 'Cabin' && i.ruleId === RULE_IDS.NULL_VALUES);
    expect(cabin?.severity).toBe(IssueSeverity.CRITICAL);
    expect(cabin?.count).toBe(687);
  });

  it('records the reference date and is reproducible with it', () => {
    expect(report.auditReferenceDate).toBe(FIXED_REFERENCE);
    const again = runAudit(data, fields, ',', { referenceDate: new Date(FIXED_REFERENCE) });
    expect(again.score).toBe(report.score);
    expect(again.issues.map(i => i.id)).toEqual(report.issues.map(i => i.id));
  });
});

describe('original text vs statistical view', () => {
  const rows = (values: string[]) => values.map(v => ({ v }));

  it('keeps "120" and "120.00" as two distinct values', () => {
    const report = runAudit(rows([...Array(6).fill('120'), ...Array(6).fill('120.00')]), ['v'], ',');
    expect(report.columnStats.v.uniqueCount).toBe(2);
    expect(report.columnStats.v.topFreq?.map(t => t.value).sort()).toEqual(['120', '120.00']);
    expect(report.issues.some(i => i.ruleId === RULE_IDS.CONSTANT_COLUMN)).toBe(false);
    // Numeric statistics still use the coerced view.
    expect(report.columnStats.v.inferredType).toBe('number');
    expect(report.columnStats.v.mean).toBe(120);
    expect(report.columnStats.v.maxLength).toBe('120.00'.length);
  });

  it('keeps "1.2e2", "-0" and "001" as written', () => {
    const report = runAudit(rows(['1.2e2', '120', '-0', '0', '001', '1']), ['v'], ',');
    expect(report.columnStats.v.uniqueCount).toBe(6);
    expect(report.columnStats.v.topFreq?.map(t => t.value)).toEqual(expect.arrayContaining(['1.2e2', '-0', '001']));
    expect(auditValue('001')).toBe('001');
  });

  it('still detects a truly constant column', () => {
    const report = runAudit(rows(Array(12).fill('120')), ['v'], ',');
    expect(report.issues.some(i => i.ruleId === RULE_IDS.CONSTANT_COLUMN)).toBe(true);
  });

  it('issue samples and column samples carry the file text, not the coerced number', () => {
    const values = [...Array(30).fill('10.00'), '-5.50', '9999.00'];
    const report = runAudit(rows(values), ['v'], ',');
    const negative = report.issues.find(i => i.ruleId === RULE_IDS.IMPOSSIBLE_NEGATIVES);
    expect(negative?.sampleValues).toEqual(['-5.50']);
    const outlier = report.issues.find(i => i.ruleId === RULE_IDS.EXTREME_OUTLIERS);
    // IQR is 0 here, so no outliers; sample text is checked through the column profile.
    expect(outlier).toBeUndefined();
    expect(report.columnStats.v.sampleValues).toEqual(['10.00', '10.00', '9999.00']);
  });
});

describe('rule scope', () => {
  it('outlier rules ignore the numeric subset of a mixed column', () => {
    const codes = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? `A/5 ${2000 + i}` : String(300 + i)));
    codes.push('3101295', '3101298');
    const report = runAudit(codes.map(code => ({ code_ref: code })), ['code_ref'], ',');
    expect(report.columnStats.code_ref.inferredType).toBe('mixed');
    expect(report.issues.some(i => OUTLIER_RULES.includes(i.ruleId))).toBe(false);
  });

  it('the same values in a numeric column do report outliers', () => {
    const values = [...Array.from({ length: 40 }, (_, i) => String(300 + i)), '3101295', '3101298'];
    const report = runAudit(values.map(v => ({ v })), ['v'], ',');
    const outlier = report.issues.find(i => i.ruleId === RULE_IDS.EXTREME_OUTLIERS);
    expect(outlier?.sampleValues).toEqual(['3101295', '3101298']);
  });
});

describe('future dates use the reference date, not the wall clock', () => {
  const data = Array.from({ length: 20 }, (_, i) => ({
    fecha_hora: i < 10 ? '2027-06-01 10:00:00' : '2020-01-01 10:00:00',
  }));

  it('flags dates after referenceDate + grace', () => {
    const report = runAudit(data, ['fecha_hora'], ',', { referenceDate: '2026-01-01T00:00:00.000Z' });
    const issue = report.issues.find(i => i.ruleId === RULE_IDS.FUTURE_DATES);
    expect(issue?.count).toBe(10);
    expect(issue?.description).toContain('2026-01-01');
    expect(issue?.description).toContain(`${FUTURE_DATE_GRACE_DAYS} días`);
  });

  it('does not flag them once the reference date has passed them', () => {
    const report = runAudit(data, ['fecha_hora'], ',', { referenceDate: '2030-01-01T00:00:00.000Z' });
    expect(report.issues.some(i => i.ruleId === RULE_IDS.FUTURE_DATES)).toBe(false);
    expect(report.auditReferenceDate).toBe('2030-01-01T00:00:00.000Z');
  });

  it('defaults to now and records it', () => {
    const before = Date.now();
    const report = runAudit(data, ['fecha_hora'], ',');
    const recorded = Date.parse(report.auditReferenceDate!);
    expect(recorded).toBeGreaterThanOrEqual(before);
    expect(recorded).toBeLessThanOrEqual(Date.now());
  });

  it('rejects an invalid reference date instead of silently using the clock', () => {
    expect(() => runAudit(data, ['fecha_hora'], ',', { referenceDate: 'not a date' })).toThrow(RangeError);
  });
});

describe('privacy: numbers are not PII by digit count', () => {
  it('a number or numeric literal in a numeric column is not a phone or an ID', () => {
    expect(isPII(512.3292)).toBe(false);
    expect(isPII(146.5208)).toBe(false);
    expect(isPII('146.5208', undefined, { inferredType: 'number' })).toBe(false);
    expect(isPII('3101295', undefined, { inferredType: 'number' })).toBe(false);
    expect(isPII('123456789', undefined, { inferredType: 'number' })).toBe(false);
  });

  it('a plain decimal literal is never a phone, even in a text column', () => {
    expect(isPII('512.3292')).toBe(false);
  });

  it('keeps real PII shapes', () => {
    expect(isPII(4111111111111111)).toBe(true);
    expect(isPII('4111111111111111', undefined, { inferredType: 'number' })).toBe(true);
    expect(isPII(3001234567, undefined, { inferredType: 'number', semanticType: 'phone' })).toBe(true);
    expect(isPII('+57 300 123 4567')).toBe(true);
    expect(isPII('a@b.com', undefined, { inferredType: 'number' })).toBe(true);
  });

  it('recognises person-name columns generically', () => {
    for (const name of ['Name', 'name', 'nombre', 'Apellidos', 'first_name', 'LastName', 'PassengerName', 'nombre_cliente', 'Full Name']) {
      expect(isPersonNameColumn(name)).toBe(true);
    }
    for (const name of ['product_name', 'file_name', 'Ticket', 'Fare', 'Cabin', 'username_count']) {
      expect(isPersonNameColumn(name)).toBe(false);
    }
  });

  it('a redacted value is marked as such', () => {
    const minimized = minimizeEvidenceValue('a@b.com', { hashColumn: false });
    expect(minimized.redacted).toBe(true);
    expect(String(minimized.value)).toContain('***');
  });
});

describe('privacy: envelope masking is consistent across levels', () => {
  const report: AuditReportInput = {
    score: 64, rowCount: 891, colCount: 4, duplicateRows: 0, delimiterDetected: ',',
    issues: [
      { id: 'hygiene-ghost-Name', column: 'Name', ruleName: 'Espacios Fantasma (Trim)', ruleId: 'rule:trim-whitespace', category: 'Higiene de Texto', description: '', severity: 'info', count: 1, affectedPercentage: 0.1, sampleValues: ['Braund, Mr. Owen Harris '] },
      { id: 'logic-outlier-Fare', column: 'Fare', ruleName: 'Outliers Extremos (IQR 3×)', ruleId: 'rule:extreme-outliers', category: 'Lógica', description: '', severity: 'warning', count: 3, affectedPercentage: 0.3, sampleValues: ['146.5208', '512.3292', 263] },
      { id: 'hygiene-toxic-Contact', column: 'Contact', ruleName: 'Placeholders Tóxicos', ruleId: 'rule:toxic-placeholders', category: 'Higiene de Texto', description: '', severity: 'warning', count: 1, affectedPercentage: 0.1, sampleValues: ['owen@example.com'] },
    ],
    columnStats: {
      Name: { inferredType: 'string', uniqueCount: 891, nullCount: 0, topFreq: [{ value: 'Braund, Mr. Owen Harris', count: 1 }] },
      Fare: { inferredType: 'number', uniqueCount: 248, nullCount: 0, topFreq: [{ value: '8.05', count: 43 }, { value: '13.00', count: 42 }] },
      Ticket: { inferredType: 'mixed', uniqueCount: 681, nullCount: 0, topFreq: [{ value: '347082', count: 7 }] },
      Contact: { inferredType: 'string', uniqueCount: 2, nullCount: 0, topFreq: [{ value: 'owen@example.com', count: 1 }] },
    },
    datasetProfile: { columns: [{ name: 'Name', inferredType: 'string' }, { name: 'Fare', inferredType: 'number' }, { name: 'Ticket', inferredType: 'mixed' }, { name: 'Contact', inferredType: 'string' }] },
  };

  for (const privacyLevel of ['local_full', 'cloud_minimized'] as const) {
    describe(privacyLevel, () => {
      const envelope = _buildEvidenceEnvelopeV2(report, { privacyLevel, datasetSha256: 'abc', delimiter: ',' });
      const samplesOf = (issueId: string) => envelope.evidence.samples.filter(s => s.issueId === issueId);
      const statsOf = (name: string) => envelope.evidence.columnStats[envelope.columns.find(c => c.name === name)!.columnId];

      it('hashes person names (samples and top values)', () => {
        const names = samplesOf('hygiene-ghost-Name');
        expect(names).toHaveLength(1);
        expect(String(names[0].values[0])).toMatch(/^sha256:[a-f0-9]{64}$/);
        expect(names[0].metadata.hashed).toBe(true);
        expect(statsOf('Name').topValues[0].value).toMatch(/^sha256:/);
      });

      it('never turns a number into a masked string', () => {
        const fares = samplesOf('logic-outlier-Fare');
        expect(fares.map(s => s.values[0])).toEqual(['146.5208', '512.3292', 263]);
        for (const s of fares) expect(s.metadata).toMatchObject({ hashed: false, redacted: false });
        expect(statsOf('Fare').topValues.map(t => t.value)).toEqual(['8.05', '13.00']);
        expect(JSON.stringify(envelope.evidence)).not.toMatch(/"\d\*\*\*\d"/);
      });

      it('redacts PII-shaped values with a visible marker', () => {
        const contact = samplesOf('hygiene-toxic-Contact');
        expect(String(contact[0].values[0])).toContain('***@');
        expect(contact[0].metadata.redacted).toBe(true);
      });
    });
  }
});
