/**
 * Script Column Resolver — Phase 4 Loop 1.
 *
 * Structural API for column resolution. NOT the renderer.
 * Uses columnId as primary authority. Never falls back to name lookup.
 */

import type {
  ColumnRef,
  ColumnRegistryV2,
  ColumnAccessSpecV2,
  RemediationContextV2,
} from './types';

export type ColumnResolutionResult =
  | { ok: true; columnRef: ColumnRef }
  | { ok: false; reason: 'missing_column' | 'ambiguous_column' };

export function resolveScriptColumn(
  columnId: string | null,
  buildContext: { columnRegistry: ColumnRegistryV2 },
): ColumnResolutionResult {
  if (columnId === null) {
    return { ok: false, reason: 'missing_column' };
  }

  const col = buildContext.columnRegistry.byColumnId.get(columnId);

  if (!col) {
    return { ok: false, reason: 'missing_column' };
  }

  if (col.isAmbiguous) {
    return { ok: false, reason: 'ambiguous_column' };
  }

  return { ok: true, columnRef: col };
}

export function buildColumnAccessSpec(columnRef: ColumnRef): ColumnAccessSpecV2 {
  return {
    columnId: columnRef.columnId,
    pythonLiteral: columnRef.pythonLiteral,
    accessMode: columnRef.isDuplicate ? 'position' : 'label',
    position: columnRef.position,
    duplicateOrdinal: columnRef.duplicateOrdinal,
  };
}

export function accessColumnDf(col: ColumnRef): string {
  return `df_clean[${JSON.stringify(col.pythonLiteral)}]`;
}

export function writeColumnLiteral(col: ColumnRef): string {
  return col.pythonLiteral;
}

export function buildPythonLiteral(
  name: string,
  duplicateOrdinal: number,
  isReservedWord: boolean,
): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (isReservedWord) {
    return `df['${name}']`;
  }
  if (duplicateOrdinal > 0) {
    return `${sanitized}_${duplicateOrdinal}`;
  }
  return sanitized;
}

export function buildColumnRegistryV2(columnRefs: ColumnRef[]): ColumnRegistryV2 {
  const orderedColumns: readonly ColumnRef[] = Object.freeze([...columnRefs]);

  const byColumnId = new Map<string, ColumnRef>();
  for (const col of columnRefs) {
    byColumnId.set(col.columnId, col);
  }

  const byName = new Map<string, ColumnRef[]>();
  for (const col of columnRefs) {
    const existing = byName.get(col.name) || [];
    existing.push(col);
    byName.set(col.name, existing);
  }

  return {
    orderedColumns,
    byColumnId: Object.freeze(byColumnId) as ReadonlyMap<string, ColumnRef>,
    byName: Object.freeze(byName) as ReadonlyMap<string, readonly ColumnRef[]>,
  };
}

export function isColumnRenderizable(col: ColumnRef): boolean {
  return !col.isAmbiguous;
}
