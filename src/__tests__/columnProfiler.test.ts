import { describe, it, expect } from 'vitest';
import { profileColumns } from '../services/columnProfiler';
import { IssueCategory, IssueSeverity, type ColumnStats } from '../types';

// Helper: build a minimal ColumnStats object for a single field.
function mkStats(name: string, overrides: Partial<ColumnStats> = {}): ColumnStats {
  return {
    name,
    inferredType: 'string',
    nullCount: 0,
    uniqueCount: 1,
    sampleValues: [],
    ...overrides,
  };
}

describe('columnProfiler — Fase 1', () => {
  it('Test 1: a column with a single unique value is classified as constant and recommended for drop', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ always_same: 'X', id: i }));
    const fields = ['always_same', 'id'];
    const columnStats: Record<string, ColumnStats> = {
      always_same: mkStats('always_same', { uniqueCount: 1 }),
      id: mkStats('id', { uniqueCount: 20 }),
    };

    const profile = profileColumns(data, fields, columnStats);

    const col = profile.columns.find(c => c.name === 'always_same')!;
    expect(col.cardinality).toBe('constant');
    expect(col.pruneRecommendation).toBe('drop');
    expect(profile.pruningCandidates).toContain('always_same');
  });

  it('Test 2: a sparse column (>60% nulls) with low cardinality is marked for review', () => {
    // 50 rows total. sparse has 10 non-null values across 2 distinct values.
    // 10/50 = 20% non-null → 80% sparsity. 2 uniques on 10 non-nulls = 0.2 ratio.
    // uniqueRatio (vs rowCount) = 2/50 = 0.04 < 0.05 → 'low'
    // sparsity = 40/50 = 0.8 > 0.6 → 'review'
    const values = ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'];
    const data = Array.from({ length: 50 }, (_, i) => ({
      sparse: i < 10 ? values[i] : null,
      id: i,
    }));
    const fields = ['sparse', 'id'];
    const columnStats: Record<string, ColumnStats> = {
      sparse: mkStats('sparse', { uniqueCount: 2, nullCount: 40 }),
      id: mkStats('id', { uniqueCount: 50, nullCount: 0 }),
    };

    const profile = profileColumns(data, fields, columnStats);

    const col = profile.columns.find(c => c.name === 'sparse')!;
    expect(col.sparsity).toBeCloseTo(0.8, 2);
    expect(col.cardinality).toBe('low');
    expect(col.pruneRecommendation).toBe('review');
    expect(profile.pruningCandidates).toContain('sparse');
  });

  it('Test 3: a column where almost every value is unique is classified as unique and kept', () => {
    // 100 rows, 98 unique → ratio 0.98 → 'unique'
    const data = Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}` }));
    const fields = ['id'];
    const columnStats: Record<string, ColumnStats> = {
      id: mkStats('id', { uniqueCount: 98, nullCount: 0 }),
    };

    const profile = profileColumns(data, fields, columnStats);

    const col = profile.columns.find(c => c.name === 'id')!;
    expect(col.cardinality).toBe('unique');
    expect(col.pruneRecommendation).toBe('keep');
    expect(profile.pruningCandidates).not.toContain('id');
  });

  it('Test 4: a date column and a time column with complementary names are detected as a coalescence pair', () => {
    // Same row, distinct date and time strings — typical "fecha" + "hora" split.
    const data = Array.from({ length: 20 }, (_, i) => ({
      fecha: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      hora: `${String(i % 24).padStart(2, '0')}:00`,
    }));
    const fields = ['fecha', 'hora'];
    const columnStats: Record<string, ColumnStats> = {
      fecha: mkStats('fecha', { inferredType: 'date', uniqueCount: 20 }),
      hora: mkStats('hora', { inferredType: 'string', uniqueCount: 8 }),
    };

    const profile = profileColumns(data, fields, columnStats);

    const fechaCol = profile.columns.find(c => c.name === 'fecha')!;
    const horaCol = profile.columns.find(c => c.name === 'hora')!;
    expect(fechaCol.isCandidateForCoalescence).toBe(true);
    expect(fechaCol.coalescencePartner).toBe('hora');
    expect(horaCol.isCandidateForCoalescence).toBe(true);
    expect(horaCol.coalescencePartner).toBe('fecha');
    expect(profile.coalescencePairs).toContainEqual(['fecha', 'hora']);
  });

  it('Test 5: two date columns storing the same date in different formats are detected as a coalescence pair', () => {
    // Same date, two formats. Values overlap after normalization.
    const data = Array.from({ length: 15 }, (_, i) => ({
      fecha_iso: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`,
      fecha_dmy: `${String((i % 28) + 1).padStart(2, '0')}/03/2024`,
    }));
    const fields = ['fecha_iso', 'fecha_dmy'];
    const columnStats: Record<string, ColumnStats> = {
      fecha_iso: mkStats('fecha_iso', { inferredType: 'date', uniqueCount: 15 }),
      fecha_dmy: mkStats('fecha_dmy', { inferredType: 'date', uniqueCount: 15 }),
    };

    const profile = profileColumns(data, fields, columnStats);

    const a = profile.columns.find(c => c.name === 'fecha_iso')!;
    const b = profile.columns.find(c => c.name === 'fecha_dmy')!;
    expect(a.isCandidateForCoalescence).toBe(true);
    expect(a.coalescencePartner).toBe('fecha_dmy');
    expect(profile.coalescencePairs).toContainEqual(['fecha_iso', 'fecha_dmy']);
  });

  it('Test 6: when no pair of columns is a candidate, coalescencePairs is empty', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      customer_name: `Customer ${i}`,
      total_amount: i * 10,
    }));
    const fields = ['customer_name', 'total_amount'];
    const columnStats: Record<string, ColumnStats> = {
      customer_name: mkStats('customer_name', { inferredType: 'string', uniqueCount: 20 }),
      total_amount: mkStats('total_amount', { inferredType: 'number', uniqueCount: 20 }),
    };

    const profile = profileColumns(data, fields, columnStats);

    expect(profile.coalescencePairs).toEqual([]);
    profile.columns.forEach(c => {
      expect(c.isCandidateForCoalescence).toBe(false);
      expect(c.coalescencePartner).toBeUndefined();
    });
  });
});
