/**
 * Column Registry — Phase 1C.
 *
 * - columnId+position lookups, NEVER rawName
 * - Duplicate handling via positional selection
 * - generateSafeColumnDict: columnId → positional reference
 * - HITL when duplicate resolution is ambiguous
 */

import { sha256short } from './hash';
import type { ColumnRef, AmbiguousLookupError } from './types';

const PYTHON_RESERVED = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield', 'import', 'exec', 'eval', 'open',
  'print', 'input', '__import__', 'compile', 'type',
]);

const AMBIGUOUS_PATTERNS = [
  /^[il1|]{2,}$/i, /^[0oO]{2,}$/, /^\s*$/, /^\W+$/,
  /^(column|col|field|attr|var|val|key|id|name|value|data|row|item|entry)_?\d*$/i,
];

function makeColumnId(name: string, position: number, duplicateOrdinal: number): string {
  return `col:${sha256short(`${name}#${position}#${duplicateOrdinal}`, 16)}`;
}

function isAmbiguous(name: string): boolean {
  return AMBIGUOUS_PATTERNS.some(p => p.test(name.trim()));
}

function isReservedWord(name: string): boolean {
  return PYTHON_RESERVED.has(name.trim());
}

export function buildColumnRegistry(columnNames: string[]): ColumnRef[] {
  const namePositions = new Map<string, number[]>();
  for (let i = 0; i < columnNames.length; i++) {
    const p = namePositions.get(columnNames[i]) || [];
    p.push(i);
    namePositions.set(columnNames[i], p);
  }

  const registry: ColumnRef[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < columnNames.length; i++) {
    const name = columnNames[i];
    const positions = namePositions.get(name)!;
    const multiple = positions.length > 1;
    const dupOrd = multiple ? positions.indexOf(i) : 0;

    let columnId = makeColumnId(name, i, dupOrd);
    if (seenIds.has(columnId)) {
      let suffix = 0;
      while (seenIds.has(`${columnId}-dup${suffix}`)) suffix++;
      columnId = `${columnId}-dup${suffix}`;
    }
    seenIds.add(columnId);

    registry.push({
      columnId,
      name,
      position: i,
      duplicateOrdinal: dupOrd,
      pythonLiteral: `_c[${JSON.stringify(name)}]`,
      isAmbiguous: isAmbiguous(name),
      isDuplicate: multiple,
      isReservedWord: isReservedWord(name),
    });
  }
  return registry;
}

/** Lookup by columnId (preferred). */
export function getColumnById(registry: ColumnRef[], columnId: string): ColumnRef | undefined {
  return registry.find(c => c.columnId === columnId);
}

/** Lookup by name+position (deterministic). */
export function getColumnByNameAndPosition(registry: ColumnRef[], name: string, position: number): ColumnRef | undefined {
  return registry.find(c => c.name === name && c.position === position);
}

/** Get ALL columns with a given name. */
export function getColumnsByName(registry: ColumnRef[], name: string): ColumnRef[] {
  return registry.filter(c => c.name === name);
}

/**
 * Resolve a column reference deterministically.
 * Prefers columnId, falls back to name+position for duplicates.
 * Returns AmbiguousLookupError when resolution is impossible.
 */
export function resolveColumn(
  registry: ColumnRef[],
  opts: { columnId?: string; name?: string; position?: number },
): ColumnRef | AmbiguousLookupError {
  // columnId takes priority
  if (opts.columnId) {
    const col = registry.find(c => c.columnId === opts.columnId);
    if (col) return col;
    return { columnId: opts.columnId, name: opts.name || opts.columnId, matches: [], reason: 'ambiguous_name' };
  }
  // name+position for duplicates
  if (opts.name && opts.position !== undefined) {
    const col = registry.find(c => c.name === opts.name && c.position === opts.position);
    if (col) return col;
  }
  // name only — ambiguous if multiple
  if (opts.name) {
    const matches = registry.filter(c => c.name === opts.name);
    if (matches.length === 1) return matches[0];
    return { columnId: `col:${opts.name}`, name: opts.name, matches, reason: 'duplicate_name' };
  }
  return { columnId: 'col:unknown', name: '', matches: [], reason: 'ambiguous_name' };
}

export function validateColumnId(registry: ColumnRef[], columnId: string): boolean {
  return registry.some(c => c.columnId === columnId);
}

export function getColumnsRequiringReview(registry: ColumnRef[]): ColumnRef[] {
  return registry.filter(c => c.isAmbiguous || c.isDuplicate || c.isReservedWord);
}

export function getInjectionRiskColumns(registry: ColumnRef[]): ColumnRef[] {
  return registry.filter(c => /['"\\{}\[\]]/.test(c.name) || /[\x00-\x1f\x7f-\x9f]/.test(c.name));
}

/**
 * columnId → positional reference dict.
 * For duplicates: includes position for disambiguation.
 */
export function generateSafeColumnDict(registry: ColumnRef[]): string {
  const entries = registry.map(c => {
    if (c.isDuplicate) {
      return `    ${JSON.stringify(c.columnId)}: {"name": ${JSON.stringify(c.name)}, "position": ${c.position}}`;
    }
    return `    ${JSON.stringify(c.columnId)}: ${JSON.stringify(c.name)}`;
  });
  return `_c = {\n${entries.join(',\n')}\n}`;
}
