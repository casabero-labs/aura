/**
 * Column Registry — Phase 1B.
 *
 * - Determinist columnId: col:sha256(name#pos#dupOrd)
 * - All same-name columns marked isDuplicate=true
 * - Ambiguous lookup returns error, not first match
 * - excludeColumns works with columnId
 * - Collision detection with fallback
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
  /^[il1|]{2,}$/i,
  /^[0oO]{2,}$/,
  /^\s*$/,
  /^\W+$/,
  /^(column|col|field|attr|var|val|key|id|name|value|data|row|item|entry)_?\d*$/i,
];

function makeColumnId(name: string, position: number, duplicateOrdinal: number): string {
  return `col:${sha256short(`${name}#${position}#${duplicateOrdinal}`, 16)}`;
}

function makePythonLiteral(name: string): string {
  return `_c[${JSON.stringify(name)}]`;
}

function isReservedWord(name: string): boolean {
  return PYTHON_RESERVED.has(name.trim());
}

function isAmbiguous(name: string): boolean {
  return AMBIGUOUS_PATTERNS.some(p => p.test(name.trim()));
}

function hasInjectionRisk(name: string): boolean {
  return /['"\\{}\[\]]/.test(name) || /[\x00-\x1f\x7f-\x9f]/.test(name);
}

/**
 * Build column registry from ordered name list.
 * All columns sharing a name get `isDuplicate: true`.
 * COLLISION DETECTION: if two distinct columns produce the same columnId,
 * append "-dupN" suffix until unique.
 */
export function buildColumnRegistry(columnNames: string[]): ColumnRef[] {
  const namePositions = new Map<string, number[]>();
  for (let i = 0; i < columnNames.length; i++) {
    const positions = namePositions.get(columnNames[i]) || [];
    positions.push(i);
    namePositions.set(columnNames[i], positions);
  }

  const registry: ColumnRef[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < columnNames.length; i++) {
    const name = columnNames[i];
    const positions = namePositions.get(name)!;
    const multiple = positions.length > 1;
    const dupOrd = multiple ? positions.indexOf(i) : 0;

    let columnId = makeColumnId(name, i, dupOrd);
    // Collision resolution: if columnId already used, append suffix
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
      pythonLiteral: makePythonLiteral(name),
      isAmbiguous: isAmbiguous(name),
      isDuplicate: multiple,
      isReservedWord: isReservedWord(name),
    });
  }

  return registry;
}

export function getColumnById(registry: ColumnRef[], columnId: string): ColumnRef | undefined {
  return registry.find(c => c.columnId === columnId);
}

export function getColumnsByName(registry: ColumnRef[], name: string): ColumnRef[] {
  return registry.filter(c => c.name === name);
}

/**
 * Lookup a single column by name. Returns error if ambiguous.
 */
export function resolveColumnByName(registry: ColumnRef[], name: string): ColumnRef | AmbiguousLookupError {
  const matches = registry.filter(c => c.name === name);
  if (matches.length === 0) {
    return {
      columnId: 'col:unknown',
      name,
      matches: [],
      reason: 'ambiguous_name',
    };
  }
  if (matches.length > 1) {
    return {
      columnId: matches[0].columnId,
      name,
      matches,
      reason: 'duplicate_name',
    };
  }
  return matches[0];
}

export function validateColumnId(registry: ColumnRef[], columnId: string): boolean {
  return registry.some(c => c.columnId === columnId);
}

export function getColumnsRequiringReview(registry: ColumnRef[]): ColumnRef[] {
  return registry.filter(c => c.isAmbiguous || c.isDuplicate || c.isReservedWord);
}

export function getInjectionRiskColumns(registry: ColumnRef[]): ColumnRef[] {
  return registry.filter(c => hasInjectionRisk(c.name));
}

export function generateSafeColumnDict(registry: ColumnRef[]): string {
  const entries = registry.map(c => `    ${JSON.stringify(c.name)}: ${JSON.stringify(c.columnId)}`);
  return `_c = {\n${entries.join(',\n')}\n}`;
}
