import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../services/auditEngine';
import { formatNum, formatOutlierCount, formatPct } from '../components/ColumnStatsPanel';
import { RULE_IDS } from '../types';

const TITANIC_PATH = path.resolve(__dirname, '../experiments/datasets/titanic.csv');

const loadTitanic = () => {
  const parsed = Papa.parse(fs.readFileSync(TITANIC_PATH, 'utf-8'), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return { data: parsed.data as Record<string, any>[], fields: parsed.meta.fields as string[] };
};

describe('Perfil estadístico: longitudes de texto', () => {
  it('calcula min/max de longitud sobre todos los valores, no sobre la muestra inicio·medio·fin', () => {
    // 21 filas: el valor largo (índice 5) no cae en inicio (0), medio (10) ni fin (20).
    const names = Array.from({ length: 21 }, (_, i) => `n${String(i).padStart(2, '0')}`);
    names[5] = 'x'.repeat(51);
    names[7] = 'a';
    const data = names.map(name => ({ name }));
    const { columnStats } = runAudit(data, ['name'], ',');

    const sampleLengths = (columnStats.name.sampleValues ?? []).map(v => String(v).length);
    expect(Math.max(...sampleLengths)).toBe(3);
    expect(columnStats.name.maxLength).toBe(51);
    expect(columnStats.name.minLength).toBe(1);
  });

  it('excluye nulos y vacíos del cálculo de longitud', () => {
    const data = [
      { cabin: '' }, { cabin: null }, { cabin: 'A34' }, { cabin: undefined },
      { cabin: 'C123' }, { cabin: '' }, { cabin: 'B57 B59 B63 B66' },
    ];
    const { columnStats } = runAudit(data, ['cabin'], ',');
    expect(columnStats.cabin.minLength).toBe(3);
    expect(columnStats.cabin.maxLength).toBe(15);
    expect(columnStats.cabin.sampleValues).not.toContain('');
  });

  it('no lanza RangeError con columnas grandes', () => {
    const data = Array.from({ length: 200_000 }, (_, i) => ({ v: `id-${i}`, n: i }));
    const { columnStats } = runAudit(data, ['v', 'n'], ',');
    expect(columnStats.v.maxLength).toBe('id-199999'.length);
    expect(columnStats.n.max).toBe(199_999);
  }, 60_000);

  it('Titanic: Name supera los 25 caracteres de la muestra', () => {
    const { data, fields } = loadTitanic();
    const { columnStats } = runAudit(data, fields, ',');
    const expectedMax = Math.max(...data.map(r => String(r.Name).length));
    const sampleMax = Math.max(...(columnStats.Name.sampleValues ?? []).map(v => String(v).length));
    expect(columnStats.Name.maxLength).toBe(expectedMax);
    expect(columnStats.Name.maxLength).toBeGreaterThan(sampleMax);
    expect(columnStats.Cabin.minLength).toBeGreaterThan(0);
  });
});

describe('Perfil estadístico: atípicos IQR coherentes con las reglas', () => {
  it('IQR = 0 no informa atípicos ni cercas', () => {
    const values = [...Array(80).fill(0), 1, 2, 3, 4, 5, 6];
    const data = values.map(parch => ({ parch }));
    const { columnStats, issues } = runAudit(data, ['parch'], ',');
    const stats = columnStats.parch;
    expect(stats.iqr).toBe(0);
    expect(stats.outlierStatus).toBe('iqr_zero');
    expect(stats.outlierCount).toBe(0);
    expect(stats.outlierCountTukey).toBe(0);
    expect(stats.lowerFence).toBeUndefined();
    expect(stats.upperFence).toBeUndefined();
    expect(issues.some(i => i.ruleId === RULE_IDS.EXTREME_OUTLIERS)).toBe(false);
  });

  it('con ≤ 10 valores numéricos no informa atípicos (misma guarda que la regla)', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000].map(v => ({ v }));
    const { columnStats } = runAudit(data, ['v'], ',');
    expect(columnStats.v.outlierStatus).toBe('too_few_values');
    expect(columnStats.v.outlierCount).toBe(0);
  });

  it('cuenta extremos (3×) y leves (1,5×–3×) por separado, igual que las reglas', () => {
    // q1 = 10, q3 = 20, IQR = 10 → leves fuera de [-5, 35], extremos fuera de [-20, 50].
    const values = [...Array(20).fill(10), ...Array(20).fill(20), 40, 45, 100];
    const { columnStats, issues } = runAudit(values.map(v => ({ v })), ['v'], ',');
    expect(columnStats.v.outlierCount).toBe(1);
    expect(columnStats.v.outlierCountTukey).toBe(2);
    expect(issues.find(i => i.ruleId === RULE_IDS.EXTREME_OUTLIERS)?.count).toBe(1);
    expect(issues.find(i => i.ruleId === RULE_IDS.MILD_OUTLIERS)?.count).toBe(2);
  });

  it('Titanic: perfil y reglas coinciden en todas las columnas numéricas', () => {
    const { data, fields } = loadTitanic();
    const { columnStats, issues } = runAudit(data, fields, ',');
    const count = (col: string, ruleId: string) =>
      issues.find(i => i.column === col && i.ruleId === ruleId)?.count ?? 0;

    const numericCols = Object.values(columnStats).filter(c => c.inferredType === 'number').map(c => c.name);
    expect(numericCols.length).toBeGreaterThan(0);
    for (const col of numericCols) {
      expect(columnStats[col].outlierCount, col).toBe(count(col, RULE_IDS.EXTREME_OUTLIERS));
      expect(columnStats[col].outlierCountTukey, col).toBe(count(col, RULE_IDS.MILD_OUTLIERS));
    }
  });
});

describe('ColumnStatsPanel: formato', () => {
  const parch = runAudit([...Array(80).fill(0), 1, 2, 3, 4, 5, 6].map(p => ({ p })), ['p'], ',').columnStats.p;
  const spread = runAudit([...Array(20).fill(10), ...Array(20).fill(20), 40, 45, 100].map(v => ({ v })), ['v'], ',').columnStats.v;

  it('muestra n/a cuando IQR = 0 y el recuento cuando la cerca aplica', () => {
    expect(formatOutlierCount(parch, parch.outlierCount)).toBe('n/a — IQR = 0');
    expect(formatOutlierCount(spread, spread.outlierCountTukey)).toBe('2');
    // Estadísticas antiguas sin outlierStatus: se deduce de iqr.
    const legacy = { ...parch, outlierStatus: undefined, outlierCount: 213 };
    expect(formatOutlierCount(legacy, legacy.outlierCount)).toBe('n/a — IQR = 0');
  });

  it('formatea números y porcentajes con es-ES', () => {
    expect(formatPct(687, 891)).toBe('77,1%');
    expect(formatPct(0, 0)).toBe('0,0%');
    expect(formatNum(29.69911764, 4)).toBe('29,6991');
  });
});
