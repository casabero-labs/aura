/**
 * Column Registry — Fase 1.
 *
 * Safe, deterministic column references for Contracts v2.
 * - columnId: deterministic SHA-256 based
 * - pythonLiteral: safe Python dict-style access
 * - Detects: duplicates, reserved words, ambiguous names, injection patterns
 */

import { createHash } from 'node:crypto';
import type { ColumnRef } from './types';

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

function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function makeColumnId(name: string, position: number, duplicateOrdinal: number): string {
  const seed = `${name}#${position}#${duplicateOrdinal}`;
  return `col:${sha256hex(seed).slice(0, 8)}`;
}

function makePythonLiteral(name: string, columnId: string): string {
  // Safe wrapper: _c is a dict-like column reference container
  const escaped = JSON.stringify(name);
  return `_c[${escaped}]`;
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
 * Build a column registry from a list of column names (in order).
 * Duplicate names get an incrementing duplicateOrdinal.
 */
export function buildColumnRegistry(columnNames: string[]): ColumnRef[] {
  const nameCounts = new Map<string, number>();
  const registry: ColumnRef[] = [];

  for (let i = 0; i < columnNames.length; i++) {
    const name = columnNames[i];
    const count = (nameCounts.get(name) || 0) + 1;
    nameCounts.set(name, count);

    const duplicateOrdinal = count > 1 ? count - 1 : 0;
    const columnId = makeColumnId(name, i, duplicateOrdinal);
    const pythonLiteral = makePythonLiteral(name, columnId);

    registry.push({
      columnId,
      name,
      position: i,
      duplicateOrdinal,
      pythonLiteral,
      isAmbiguous: isAmbiguous(name),
      isDuplicate: count > 1,
      isReservedWord: isReservedWord(name),
    });
  }

  return registry;
}

/**
 * Look up a column by columnId.
 */
export function getColumnById(registry: ColumnRef[], columnId: string): ColumnRef | undefined {
  return registry.find(c => c.columnId === columnId);
}

/**
 * Look up a column by name (returns ALL matching columns, for duplicate handling).
 */
export function getColumnsByName(registry: ColumnRef[], name: string): ColumnRef[] {
  return registry.filter(c => c.name === name);
}

/**
 * Validate that a columnId exists in the registry.
 */
export function validateColumnId(registry: ColumnRef[], columnId: string): boolean {
  return registry.some(c => c.columnId === columnId);
}

/**
 * Get columns requiring human review (duplicates, ambiguous, reserved words).
 */
export function getColumnsRequiringReview(registry: ColumnRef[]): ColumnRef[] {
  return registry.filter(c => c.isAmbiguous || c.isDuplicate || c.isReservedWord);
}

/**
 * Check for injection risks in column names (quotes, escapes, control chars).
 */
export function getInjectionRiskColumns(registry: ColumnRef[]): ColumnRef[] {
  return registry.filter(c => hasInjectionRisk(c.name));
}

/**
 * Produce the Python-safe _c dict literal for code generation.
 * Example output: _c = {"Name": "col:a1b2c3d4", "Age": "col:e5f6g7h8"}
 */
export function generateSafeColumnDict(registry: ColumnRef[]): string {
  const entries = registry.map(c => `    ${JSON.stringify(c.name)}: ${JSON.stringify(c.columnId)}`);
  return `_c = {\n${entries.join(',\n')}\n}`;
}
