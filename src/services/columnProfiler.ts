import type { ColumnStats } from '../types';

export type Cardinality = 'constant' | 'low' | 'medium' | 'high' | 'unique';
export type PruneRecommendation = 'keep' | 'review' | 'drop';

export interface ColumnProfile {
  name: string;
  cardinality: Cardinality;
  uniqueRatio: number;
  sparsity: number;
  inferredType: ColumnStats['inferredType'];
  semanticType?: ColumnStats['semanticType'];
  isCandidateForCoalescence: boolean;
  coalescencePartner?: string;
  pruneRecommendation: PruneRecommendation;
}

export interface DatasetProfile {
  totalRows: number;
  totalColumns: number;
  columns: ColumnProfile[];
  coalescencePairs: Array<[string, string]>;
  pruningCandidates: string[];
  generatedAt: string;
}

/**
 * Classify a single column by cardinality and decide pruning.
 * Exported for unit testing.
 */
export function classifyColumn(
  name: string,
  columnStats: ColumnStats,
  rowCount: number
): ColumnProfile {
  const uniqueCount = columnStats.uniqueCount ?? 0;
  const nullCount = columnStats.nullCount ?? 0;
  const uniqueRatio = rowCount > 0 ? uniqueCount / rowCount : 0;
  const sparsity = rowCount > 0 ? nullCount / rowCount : 0;

  let cardinality: Cardinality;
  let pruneRecommendation: PruneRecommendation;

  if (rowCount > 10 && uniqueCount === 1) {
    cardinality = 'constant';
    pruneRecommendation = 'drop';
  } else if (uniqueRatio < 0.05) {
    cardinality = 'low';
    pruneRecommendation = sparsity > 0.6 ? 'review' : 'keep';
  } else if (uniqueRatio <= 0.5) {
    cardinality = 'medium';
    pruneRecommendation = 'keep';
  } else if (uniqueRatio <= 0.95) {
    cardinality = 'high';
    pruneRecommendation = 'keep';
  } else {
    cardinality = 'unique';
    pruneRecommendation = 'keep';
  }

  return {
    name,
    cardinality,
    uniqueRatio,
    sparsity,
    inferredType: columnStats.inferredType,
    semanticType: columnStats.semanticType,
    isCandidateForCoalescence: false,
    pruneRecommendation,
  };
}

/**
 * Build a profile of the dataset. Pairing (coalescence) detection is
 * implemented in a later cycle — this version returns empty pairs.
 */
export function profileColumns(
  data: Record<string, any>[],
  fields: string[],
  columnStats: Record<string, ColumnStats>
): DatasetProfile {
  const rowCount = data.length;
  const columns = fields.map(name => {
    const stats = columnStats[name] ?? {
      name,
      inferredType: 'string' as const,
      nullCount: 0,
      uniqueCount: 0,
      sampleValues: [],
    };
    return classifyColumn(name, stats, rowCount);
  });

  const pruningCandidates = columns
    .filter(c => c.pruneRecommendation !== 'keep')
    .map(c => c.name);

  const coalescencePairs = detectCoalescencePairs(data, fields, columnStats);
  const partnerByName = new Map<string, string>();
  coalescencePairs.forEach(([a, b]) => {
    partnerByName.set(a, b);
    partnerByName.set(b, a);
  });
  const columnsWithCoalescence = columns.map(c =>
    partnerByName.has(c.name)
      ? { ...c, isCandidateForCoalescence: true, coalescencePartner: partnerByName.get(c.name) }
      : c
  );

  return {
    totalRows: rowCount,
    totalColumns: fields.length,
    columns: columnsWithCoalescence,
    coalescencePairs,
    pruningCandidates,
    generatedAt: new Date().toISOString(),
  };
}

// --- Coalescence detection ---

const NAME_TOKEN_HINTS: Array<{ tokens: string[]; partner: string[] }> = [
  // date-like + time-like name pairs
  { tokens: ['fecha', 'date', 'dia'], partner: ['hora', 'time', 'hora_'] },
  { tokens: ['start', 'inicio'], partner: ['end', 'fin', 'final'] },
  { tokens: ['created'], partner: ['updated', 'modified'] },
];

/** Normalize a date string to YYYY-MM-DD if it looks like a date, else null. */
export function normalizeDateKey(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();

  // ISO YYYY-MM-DD or YYYY-MM-DD(...)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DMY dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    // Heuristic: if first part > 12, treat as day-first.
    if (parseInt(dmy[1], 10) > 12) return `${y}-${m}-${d}`;
    // Ambiguous (e.g. 03/04/2024) — assume day-first (DMY, common in es).
    return `${y}-${m}-${d}`;
  }

  return null;
}

/** Detect pairs of columns that should be coalesced into one. */
export function detectCoalescencePairs(
  data: Record<string, any>[],
  fields: string[],
  columnStats: Record<string, ColumnStats>
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  // 1) Name-token based pairing (date + time, start + end, etc.)
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const a = fields[i].toLowerCase();
      const b = fields[j].toLowerCase();
      const matched = NAME_TOKEN_HINTS.some(hint => {
        const aHasA = hint.tokens.some(t => a.includes(t));
        const aHasB = hint.partner.some(t => a.includes(t));
        const bHasA = hint.tokens.some(t => b.includes(t));
        const bHasB = hint.partner.some(t => b.includes(t));
        return (aHasA && bHasB) || (aHasB && bHasA);
      });
      if (matched) pairs.push([fields[i], fields[j]]);
    }
  }

  // 2) Value-overlap based pairing (two date columns, possibly different formats)
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      if (pairs.some(p => (p[0] === fields[i] && p[1] === fields[j]))) continue;
      const statsA = columnStats[fields[i]];
      const statsB = columnStats[fields[j]];
      if (statsA?.inferredType !== 'date' || statsB?.inferredType !== 'date') continue;
      if (fields[i].toLowerCase() === fields[j].toLowerCase()) continue;

      const aValues = data.map(r => normalizeDateKey(r[fields[i]])).filter((v): v is string => v !== null);
      const bValues = data.map(r => normalizeDateKey(r[fields[j]])).filter((v): v is string => v !== null);
      if (aValues.length === 0 || bValues.length === 0) continue;

      const aSet = new Set(aValues);
      const overlap = bValues.filter(v => aSet.has(v)).length;
      const ratio = overlap / Math.min(aValues.length, bValues.length);
      if (ratio >= 0.8) pairs.push([fields[i], fields[j]]);
    }
  }

  return pairs;
}
