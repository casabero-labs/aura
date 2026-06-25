/**
 * Script Column Resolver — Phase 4 Loop 1R.
 *
 * Structural API for column resolution. NOT the renderer.
 * Uses columnId as primary authority. Never falls back to name lookup.
 *
 * Canonical pythonLiteral: _c["columnId"] (from buildColumnRegistry).
 * No second dialect of Python references is allowed.
 */

import type {
  ColumnRef,
  ColumnRegistryV2,
  ColumnAccessSpecV2,
  ColumnResolutionFailureReasonV2,
} from './types';

// ── Column Resolution ──

export type ColumnResolutionResult =
  | { ok: true; columnRef: ColumnRef }
  | { ok: false; reason: ColumnResolutionFailureReasonV2 };

export function resolveScriptColumn(
  columnId: string | null,
  buildContext: { columnRegistry: ColumnRegistryV2; correspondenceEvidence?: { valid: boolean } },
): ColumnResolutionResult {
  if (buildContext.correspondenceEvidence && !buildContext.correspondenceEvidence.valid) {
    return { ok: false, reason: 'context_invalid' };
  }

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

// ── Canonical Python Expressions ──

export function buildColumnReadExpression(col: ColumnRef): string {
  if (col.isDuplicate) {
    return `df_clean.iloc[:, ${col.pythonLiteral}["position"]]`;
  }
  return `df_clean[${col.pythonLiteral}]`;
}

export function buildColumnWriteTarget(col: ColumnRef): string {
  if (col.isDuplicate) {
    return `df_clean.iloc[:, ${col.pythonLiteral}["position"]]`;
  }
  return `df_clean[${col.pythonLiteral}]`;
}

// ── Column Access Spec ──

export function buildColumnAccessSpec(columnRef: ColumnRef): ColumnAccessSpecV2 {
  return {
    columnId: columnRef.columnId,
    pythonLiteral: columnRef.pythonLiteral,
    accessMode: columnRef.isDuplicate ? 'position' : 'label',
    position: columnRef.position,
    duplicateOrdinal: columnRef.duplicateOrdinal,
    readExpression: buildColumnReadExpression(columnRef),
    writeTarget: buildColumnWriteTarget(columnRef),
  };
}

// ── Structural Renderability ──

export function isColumnStructurallyRenderable(col: ColumnRef): boolean {
  return !col.isAmbiguous;
}

// ── Readonly Map View (runtime-immutable proxy) ──

class ReadonlyMapView<K, V> implements Omit<Map<K, V>, 'set' | 'delete' | 'clear'> {
  private _map: Map<K, V>;

  constructor(map: Map<K, V>) {
    this._map = map;
  }

  get(key: K): V | undefined { return this._map.get(key); }
  has(key: K): boolean { return this._map.has(key); }
  get size(): number { return this._map.size; }
  keys(): MapIterator<K> { return this._map.keys(); }
  values(): MapIterator<V> { return this._map.values(); }
  entries(): MapIterator<[K, V]> { return this._map.entries(); }
  forEach(cb: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
    this._map.forEach(cb, thisArg);
  }
  [Symbol.iterator](): MapIterator<[K, V]> { return this._map[Symbol.iterator](); }

  // Explicitly omit mutable methods so cast to any still reveals no set/delete/clear
}

// Helper to check the canonical pythonLiteral format
function makeCanonicalLiteral(columnId: string): string {
  return `_c[${JSON.stringify(columnId)}]`;
}

function isCanonicalLiteral(col: ColumnRef): boolean {
  return col.pythonLiteral === makeCanonicalLiteral(col.columnId);
}

// ── Registry Build Error ──

export interface RegistryBuildError {
  code: string;
  message: string;
}

export type RegistryBuildResult =
  | { ok: true; registry: ColumnRegistryV2 }
  | { ok: false; errors: RegistryBuildError[] };

// ── Registry Builder (with validation) ──

export function buildColumnRegistryV2(columnRefs: ColumnRef[]): ColumnRegistryV2 {
  const errors: RegistryBuildError[] = [];

  // Validate each ColumnRef
  const seenIds = new Set<string>();
  const seenPositions = new Set<number>();

  for (let i = 0; i < columnRefs.length; i++) {
    const col = columnRefs[i];

    if (!col.columnId) {
      errors.push({ code: 'INVALID_COLUMN_ID', message: `Column at index ${i} has empty columnId` });
      continue;
    }

    if (!Number.isInteger(col.position) || col.position < 0) {
      errors.push({ code: 'INVALID_POSITION', message: `Column ${col.columnId} has invalid position ${col.position}` });
    }

    if (!Number.isInteger(col.duplicateOrdinal) || col.duplicateOrdinal < 0) {
      errors.push({ code: 'INVALID_DUPLICATE_ORDINAL', message: `Column ${col.columnId} has invalid duplicateOrdinal ${col.duplicateOrdinal}` });
    }

    if (!isCanonicalLiteral(col)) {
      errors.push({
        code: 'NON_CANONICAL_PYTHON_LITERAL',
        message: `Column ${col.columnId} has pythonLiteral "${col.pythonLiteral}", expected "${makeCanonicalLiteral(col.columnId)}"`,
      });
    }

    if (seenIds.has(col.columnId)) {
      errors.push({ code: 'DUPLICATE_COLUMN_ID', message: `Duplicate columnId ${col.columnId}` });
    }
    seenIds.add(col.columnId);

    if (seenPositions.has(col.position)) {
      errors.push({ code: 'DUPLICATE_POSITION', message: `Duplicate position ${col.position} for columnId ${col.columnId}` });
    }
    seenPositions.add(col.position);
  }

  // Validate positions form 0..n-1
  const expectedPositions = new Set(Array.from({ length: columnRefs.length }, (_, i) => i));
  for (const pos of expectedPositions) {
    if (!seenPositions.has(pos)) {
      errors.push({ code: 'MISSING_POSITION', message: `Position ${pos} is missing from registry` });
    }
  }

  if (errors.length > 0) {
    throw new Error(`buildColumnRegistryV2 validation failed: ${errors.map(e => e.message).join('; ')}`);
  }

  // Build ordered columns with frozen copies
  const orderedColumns: readonly ColumnRef[] = Object.freeze(
    columnRefs.map(col => Object.freeze({ ...col })),
  );

  // Build byColumnId with frozen ColumnRef copies
  const byColumnIdRaw = new Map<string, ColumnRef>();
  for (const col of columnRefs) {
    byColumnIdRaw.set(col.columnId, Object.freeze({ ...col }));
  }

  // Build byName with frozen inner arrays
  const byNameRaw = new Map<string, ColumnRef[]>();
  for (const col of columnRefs) {
    const existing = byNameRaw.get(col.name) || [];
    existing.push(Object.freeze({ ...col }));
    byNameRaw.set(col.name, existing);
  }
  // Freeze each inner array
  for (const [, arr] of byNameRaw) {
    Object.freeze(arr);
  }

  return {
    orderedColumns,
    byColumnId: new ReadonlyMapView(byColumnIdRaw) as ReadonlyMap<string, ColumnRef>,
    byName: new ReadonlyMapView(byNameRaw) as ReadonlyMap<string, readonly ColumnRef[]>,
  };
}
