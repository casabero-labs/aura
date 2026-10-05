import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import dirty from '../../experiments/rule-engine/fixtures/clientes_sucio.json';
import clean from '../../experiments/rule-engine/fixtures/clientes_groundtruth.json';
import iris from '../../experiments/rule-engine/fixtures/iris.json';
import { runAudit } from '../services/auditEngine';
import { checkDate, isIdentifierColumn, parseDatasetRules, type DatasetRules } from '../services/ruleChecks';
import { IssueSeverity, RULE_IDS } from '../types';

const referenceDate = '2026-10-05T00:00:00.000Z';
const fields = Object.keys(dirty[0]);
const clientRules: DatasetRules = {
  documento: { type: 'identifier', unique: true, required: true, length: 10 },
  estado: { allowedValues: ['activo', 'inactivo', 'pendiente'] },
  fecha_alta: { type: 'date', dateFormat: 'ISO' },
  monto_ultima_compra: { type: 'number', min: 0, integer: true },
};
const audit = (data: Record<string, unknown>[], columns?: DatasetRules) =>
  runAudit(data, Object.keys(data[0]), ',', { referenceDate, columns });

describe('client file: reported failures and false alarms', () => {
  const report = audit(dirty);
  it('keeps documents as text with no numeric statistics or coercion', () => {
    expect(report.columnStats.documento.inferredType).toBe('string');
    expect(report.columnStats.documento.mean).toBeUndefined();
    expect(dirty[8].documento).toBe('0011223344');
    expect(report.issues.some(i => i.column === 'documento' && i.ruleId === RULE_IDS.MIXED_TYPES)).toBe(false);
  });
  it('finds all three repeated-document groups without claiming exact equality', () => {
    expect(report.duplicateRows).toBe(0);
    const repeated = report.issues.find(i => i.ruleId === RULE_IDS.DUPLICATE_KEY && i.column === 'documento');
    expect(repeated?.count).toBe(6);
    expect(repeated?.rowNumbers).toEqual([1, 3, 7, 8, 10, 11]);
    expect(repeated?.automaticAuthorization?.authorized).toBe(false);
  });
  it('counts whitespace and the null marker together while preserving their evidence', () => {
    expect(report.columnStats.nombre.nullCount).toBe(2);
    expect(report.issues.find(i => i.column === 'nombre' && i.ruleId === RULE_IDS.NULL_VALUES)?.rowNumbers).toEqual([6, 12]);
    expect(report.issues.find(i => i.ruleId === RULE_IDS.TOXIC_PLACEHOLDERS)?.sampleValues).toContain('null');
  });
  it('finds the impossible month and still reports mixed date formats', () => {
    const invalid = report.issues.find(i => i.ruleId === RULE_IDS.INVALID_DATE);
    expect(invalid?.sampleValues).toEqual(['2024-13-01']);
    expect(invalid?.severity).toBe(IssueSeverity.CRITICAL);
    expect(report.issues.some(i => i.ruleId === RULE_IDS.MIXED_DATE_FORMATS)).toBe(true);
  });
  it('reports accent/case variations without rewriting personal names or cities', () => {
    expect(report.issues.some(i => i.column === 'ciudad' && i.ruleId === RULE_IDS.CAPITALIZATION_CHAOS)).toBe(true);
    expect(report.issues.some(i => i.column === 'nombre' && i.ruleId === RULE_IDS.CAPITALIZATION_CHAOS)).toBe(true);
    expect(dirty[6].nombre).toBe('Sofia Lara');
  });
  it('uses the declared domain and flags integer money, without inventing repairs', () => {
    const specified = audit(dirty, clientRules);
    expect(specified.issues.find(i => i.ruleId === RULE_IDS.DOMAIN_VALUES && i.column === 'estado')?.sampleValues).toEqual(['actvo', 'ACTIVO']);
    expect(specified.issues.find(i => i.ruleId === RULE_IDS.DOMAIN_NUMBER)?.sampleValues).toEqual(['-12000', '17500.5']);
    expect(specified.issues.find(i => i.ruleId === RULE_IDS.IDENTIFIER_FORMAT)?.sampleValues).toEqual(['987654321']);
    expect(specified.auditRules).toEqual(clientRules);
    expect(dirty[4].monto_ultima_compra).toBe('-12000');
  });
  it('does not call valid identifiers mixed in the exercise ground truth', () => {
    expect(audit(clean, clientRules).issues).toEqual([]);
    expect(audit(clean, clientRules).score).toBe(100);
  });
  it('does not mutate any source row or declared rule', () => {
    const before = JSON.stringify(dirty), rulesBefore = JSON.stringify(clientRules);
    audit(dirty, clientRules);
    expect(JSON.stringify(dirty)).toBe(before);
    expect(JSON.stringify(clientRules)).toBe(rulesBefore);
  });
});

describe('calendar validity and dates whose order is unknown', () => {
  it.each(['2024-13-01', '2023-02-29', '2024-02-30', '2024-01-00', '31/04/2024', '2024-01-01junk', '2024-01-01T25:00:00Z', '2024-01-01T12:61:00Z'])('rejects %s', text => {
    expect(checkDate(text).valid).toBe(false);
  });
  it.each(['2024-02-29', '2000-02-29', '15/03/2024', '03/15/2024', '2024-01-01T23:59:59Z'])('accepts %s', text => {
    expect(checkDate(text).valid).toBe(true);
  });
  it('does not guess which date 03/04/2024 represents', () => {
    expect(checkDate('03/04/2024').instant).toBeNull();
    expect(checkDate('03/04/2024', 'DMY').instant?.toISOString()).toBe('2024-04-03T00:00:00.000Z');
    expect(checkDate('03/04/2024', 'MDY').instant?.toISOString()).toBe('2024-03-04T00:00:00.000Z');
  });
  it('detects future dates in ordinary date columns', () => {
    expect(audit([{ fecha_alta: '2099-01-01' }]).issues.some(i => i.ruleId === RULE_IDS.FUTURE_DATES)).toBe(true);
  });
  it('never interprets an empty start date as the Unix epoch', () => {
    const report = audit([{ fecha_inicio: null, fecha_fin: '1960-01-01' }]);
    expect(report.issues.some(i => i.ruleId === RULE_IDS.TEMPORAL_INCONSISTENCY)).toBe(false);
  });
});

describe('known datasets and controlled defects', () => {
  const irisRows = iris.rows.map(row => Object.fromEntries(iris.fields.map((field, index) => [field, row[index]])));
  it('reads the 150 UCI Iris observations, keeps measurements numeric and classes categorical', () => {
    const report = audit(irisRows);
    expect(report.rowCount).toBe(150);
    expect(report.columnStats.sepal_length.inferredType).toBe('number');
    expect(report.columnStats.species.inferredType).toBe('string');
    expect(Object.values(report.columnStats).every(stats => stats.nullCount === 0)).toBe(true);
    expect(report.issues.filter(i => [RULE_IDS.INVALID_DATE, RULE_IDS.MIXED_TYPES, RULE_IDS.DUPLICATE_KEY].includes(i.ruleId as any))).toEqual([]);
    // Equal measurements can represent two flowers. Finding equality must not authorize deletion.
    expect(report.issues.find(i => i.ruleId === RULE_IDS.EXACT_DUPLICATES)?.automaticAuthorization?.authorized).not.toBe(true);
  });
  it('finds injected defects in an Iris copy and leaves the original intact', () => {
    const changed = structuredClone(irisRows);
    changed[0].sepal_length = ' ';
    changed[1].sepal_length = '-1';
    changed[2].species = 'invented-species';
    const columns: DatasetRules = { sepal_length: { type: 'number', min: 0 }, species: { allowedValues: ['Iris-setosa', 'Iris-versicolor', 'Iris-virginica'] } };
    const report = audit(changed, columns);
    expect(report.issues.find(i => i.ruleId === RULE_IDS.NULL_VALUES)?.rowNumbers).toEqual([1]);
    expect(report.issues.find(i => i.ruleId === RULE_IDS.DOMAIN_NUMBER)?.rowNumbers).toEqual([2]);
    expect(report.issues.find(i => i.ruleId === RULE_IDS.DOMAIN_VALUES)?.rowNumbers).toEqual([3]);
    expect(irisRows[0].sepal_length).toBe('5.1');
  });
  it('finds an injected missing age in full Titanic even below 5% of rows', () => {
    const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(path.resolve(__dirname, '../../experiments/datasets/titanic.csv'), 'utf8'), { header: true, dynamicTyping: false, skipEmptyLines: true });
    const changed = parsed.data.map((row, index) => ({ ...row, Age: index === 0 ? '' : '30' }));
    const report = audit(changed);
    expect(report.rowCount).toBe(891);
    expect(report.issues.find(i => i.column === 'Age' && i.ruleId === RULE_IDS.NULL_VALUES)?.count).toBe(1);
  });
});

describe('scoring, admission and source evidence', () => {
  it('all deductions use the severity of the actual finding and reconstruct the score', () => {
    const report = audit(dirty, clientRules);
    for (const deduction of report.scoreBreakdown) {
      const findings = report.issues.filter(issue => issue.ruleId === deduction.ruleId && deduction.reason.includes(`[${issue.column}]`));
      expect(findings.some(issue => issue.severity === deduction.severity)).toBe(true);
    }
    const points = report.scoreBreakdown.reduce((sum, deduction) => sum + deduction.points, 0);
    expect(report.score).toBe(Math.max(0, Math.round(100 - points * report.scoreNormalizationFactor!)));
  });
  it('rejects empty data and invalid rule declarations', () => {
    expect(() => runAudit([], fields, ',')).toThrow();
    expect(() => audit(dirty, { unknown: { required: true } })).toThrow();
    expect(() => audit(dirty, { estado: { min: 4, max: 2 } })).toThrow();
    expect(() => parseDatasetRules('{"estado":{"allowedValues":null}}')).toThrow();
    expect(() => parseDatasetRules('{"estado":{"type":false}}')).toThrow();
    expect(() => parseDatasetRules('{"fecha":{"dateFormat":""}}')).toThrow();
  });
  it('preserves numeric sentinels as possible valid values', () => {
    expect(audit([{ documento: '999' }, { documento: '000' }]).columnStats.documento.nullCount).toBe(0);
  });
  it('honors explicit declarations that identifiers may repeat and UNKNOWN is a valid category', () => {
    const report = audit([{ documento: '001', estado: 'UNKNOWN' }, { documento: '001', estado: 'activo' }], {
      documento: { type: 'identifier', unique: false }, estado: { allowedValues: ['UNKNOWN', 'activo'] },
    });
    expect(report.issues.some(issue => issue.ruleId === RULE_IDS.DUPLICATE_KEY)).toBe(false);
    expect(report.columnStats.estado.nullCount).toBe(0);
    expect(report.issues.some(issue => issue.ruleId === RULE_IDS.TOXIC_PLACEHOLDERS)).toBe(false);
  });
  it('does not silently miss one future date or an unusual phone length below 5%', () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({ fecha: index === 0 ? '2099-01-01' : '2020-01-01', phone: index === 0 ? '+569123456' : '+56912345678' }));
    const report = audit(rows);
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.FUTURE_DATES)?.count).toBe(1);
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.VARIABLE_PHONE_LENGTH)?.count).toBe(1);
  });
  it('uses the same score formula below and above the former 100-row cutoff', () => {
    const small = audit(Array.from({ length: 99 }, (_, index) => ({ value: index === 0 ? '-4' : String(index) })));
    const large = audit(Array.from({ length: 100 }, (_, index) => ({ value: index === 0 ? '-4' : String(index) })));
    expect(small.score).toBe(large.score);
    expect(small.scoreNormalizationFactor).toBe(1);
  });
  it('detects sensitive numeric source values even after statistical conversion', () => {
    expect(audit([{ tarjeta: '4111111111111111' }]).issues.some(i => i.ruleId === RULE_IDS.PII_DETECTED)).toBe(true);
  });
  it('accepts modern web addresses and skips empty email/URL cells', () => {
    const report = audit([{ website: 'https://example.technology/path?q=a#b', email: '' }]);
    expect(report.issues.some(i => i.ruleId === RULE_IDS.MALFORMED_URLS || i.ruleId === RULE_IDS.INVALID_EMAIL)).toBe(false);
  });
  it('handles special column names without touching object prototypes', () => {
    const row = JSON.parse('{"__proto__":"value","constructor":"another"}');
    const report = audit([row]);
    expect(Object.keys(report.columnStats)).toEqual(['__proto__', 'constructor']);
    expect(({} as any).inferredType).toBeUndefined();
  });
  it('does not mistake humidity or city names for identifiers', () => {
    expect(isIdentifierColumn('humidity')).toBe(false);
    expect(isIdentifierColumn('ciudad')).toBe(false);
    expect(isIdentifierColumn('PassengerId')).toBe(true);
  });
  it('accepts ordinary name punctuation and still detects corrupted text', () => {
    const report = audit([{ nombre: "O'Connor, Anne-Marie" }, { nombre: 'MuÃ±oz' }]);
    expect(report.issues.some(issue => issue.ruleId === RULE_IDS.SUSPICIOUS_SYMBOLS)).toBe(false);
    expect(report.issues.find(issue => issue.ruleId === RULE_IDS.MOJIBAKE)?.count).toBe(1);
  });
  it('does not propose converting declared text or leading-zero values into numbers', () => {
    const report = audit([{ etiqueta: '001', codigo_local: '001' }, { etiqueta: '002', codigo_local: '002' }], { etiqueta: { type: 'string' } });
    expect(report.issues.some(issue => issue.ruleId === RULE_IDS.DISGUISED_NUMBERS)).toBe(false);
  });
  it('does not confuse phone prefixes with demographic ranges', () => {
    const report = audit([{ phone: '56-9' }, { phone: '56-8' }]);
    expect(report.issues.some(issue => issue.ruleId === RULE_IDS.BURNED_DEMOGRAPHIC_RANGES)).toBe(false);
  });
});
