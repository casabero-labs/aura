/**
 * Script Column Resolver Tests — Phase 4 Loop 1.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveScriptColumn,
  buildColumnAccessSpec,
  accessColumnDf,
  writeColumnLiteral,
  buildPythonLiteral,
  buildColumnRegistryV2,
  isColumnRenderizable,
} from '../contracts/llm/scriptColumnResolver';
import type { ColumnRef, ScriptBuildContextV2 } from '../contracts/llm/types';

function makeCol(overrides: Partial<ColumnRef> = {}): ColumnRef {
  return {
    columnId: 'col:test',
    name: 'test',
    position: 0,
    duplicateOrdinal: 0,
    pythonLiteral: 'test',
    isAmbiguous: false,
    isDuplicate: false,
    isReservedWord: false,
    ...overrides,
  };
}

function makeContext(columns: ColumnRef[]): ScriptBuildContextV2 {
  return {
    remediationContext: {
      evidenceEnvelopeRef: '',
      datasetFingerprint: 'sha256:test',
      columns: columns.map(c => ({
        columnId: c.columnId,
        name: c.name,
        position: c.position,
        duplicateOrdinal: c.duplicateOrdinal,
        isAmbiguous: c.isAmbiguous,
        isDuplicate: c.isDuplicate,
      })),
      issues: [],
    },
    sourceDatasetFingerprint: 'sha256:test',
    columnRegistry: buildColumnRegistryV2(columns),
    correspondenceEvidence: {
      fingerprintMatch: true,
      columnsMatch: true,
      missingColumnIds: [],
      mismatchedColumns: [],
      columnsFromContext: columns.length,
      columnsInRegistry: columns.length,
      valid: true,
    },
  };
}

describe('resolveScriptColumn', () => {
  it('resolves unique column by columnId', () => {
    const col = makeCol({ columnId: 'col:A', name: 'A', position: 0 });
    const ctx = makeContext([col]);
    const result = resolveScriptColumn('col:A', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columnRef.columnId).toBe('col:A');
  });

  it('returns missing_column for null columnId', () => {
    const col = makeCol({ columnId: 'col:A' });
    const ctx = makeContext([col]);
    const result = resolveScriptColumn(null, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_column');
  });

  it('returns missing_column for nonexistent columnId', () => {
    const col = makeCol({ columnId: 'col:A' });
    const ctx = makeContext([col]);
    const result = resolveScriptColumn('col:nonexistent', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_column');
  });

  it('returns ambiguous_column for isAmbiguous=true', () => {
    const col = makeCol({ columnId: 'col:ambiguous', isAmbiguous: true });
    const ctx = makeContext([col]);
    const result = resolveScriptColumn('col:ambiguous', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ambiguous_column');
  });

  it('does NOT resolve by name when columnId matches', () => {
    const col = makeCol({ columnId: 'col:foo', name: 'bar' });
    const ctx = makeContext([col]);
    const result = resolveScriptColumn('col:foo', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columnRef.name).toBe('bar');
  });

  it('first duplicate with duplicateOrdinal=0', () => {
    const col0 = makeCol({ columnId: 'col:Name_0', name: 'Name', position: 0, duplicateOrdinal: 0, isDuplicate: true });
    const col1 = makeCol({ columnId: 'col:Name_1', name: 'Name', position: 1, duplicateOrdinal: 1, isDuplicate: true });
    const ctx = makeContext([col0, col1]);
    const result = resolveScriptColumn('col:Name_0', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columnRef.duplicateOrdinal).toBe(0);
  });

  it('second duplicate with duplicateOrdinal=1', () => {
    const col0 = makeCol({ columnId: 'col:Name_0', name: 'Name', position: 0, duplicateOrdinal: 0, isDuplicate: true });
    const col1 = makeCol({ columnId: 'col:Name_1', name: 'Name', position: 1, duplicateOrdinal: 1, isDuplicate: true });
    const ctx = makeContext([col0, col1]);
    const result = resolveScriptColumn('col:Name_1', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columnRef.duplicateOrdinal).toBe(1);
  });

  it('reserved word column is still resolvable', () => {
    const col = makeCol({ columnId: 'col:class', name: 'class', isReservedWord: true });
    const ctx = makeContext([col]);
    const result = resolveScriptColumn('col:class', ctx);
    expect(result.ok).toBe(true);
  });
});

describe('buildColumnAccessSpec', () => {
  it('unique column uses label accessMode', () => {
    const col = makeCol({ columnId: 'col:A', isDuplicate: false });
    const spec = buildColumnAccessSpec(col);
    expect(spec.accessMode).toBe('label');
  });

  it('duplicate column uses position accessMode', () => {
    const col = makeCol({ columnId: 'col:Name_0', isDuplicate: true, duplicateOrdinal: 0 });
    const spec = buildColumnAccessSpec(col);
    expect(spec.accessMode).toBe('position');
  });

  it('includes all required fields', () => {
    const col = makeCol({
      columnId: 'col:A',
      pythonLiteral: 'A',
      position: 2,
      duplicateOrdinal: 0,
    });
    const spec = buildColumnAccessSpec(col);
    expect(spec.columnId).toBe('col:A');
    expect(spec.pythonLiteral).toBe('A');
    expect(spec.position).toBe(2);
    expect(spec.duplicateOrdinal).toBe(0);
  });
});

describe('accessColumnDf', () => {
  it('produces df_clean access expression', () => {
    const col = makeCol({ pythonLiteral: 'Name' });
    expect(accessColumnDf(col)).toBe('df_clean["Name"]');
  });

  it('handles reserved word pythonLiteral', () => {
    const col = makeCol({ pythonLiteral: "df['class']" });
    expect(accessColumnDf(col)).toBe('df_clean["df[\'class\']"]');
  });
});

describe('writeColumnLiteral', () => {
  it('returns pythonLiteral', () => {
    const col = makeCol({ pythonLiteral: 'Age' });
    expect(writeColumnLiteral(col)).toBe('Age');
  });
});

describe('buildPythonLiteral', () => {
  it('sanitizes name', () => {
    expect(buildPythonLiteral('my column', 0, false)).toBe('my_column');
  });

  it('adds ordinal suffix for duplicates', () => {
    expect(buildPythonLiteral('Name', 1, false)).toBe('Name_1');
    expect(buildPythonLiteral('Name', 0, false)).toBe('Name');
  });

  it('uses df[] notation for reserved words', () => {
    expect(buildPythonLiteral('class', 0, true)).toBe("df['class']");
  });
});

describe('buildColumnRegistryV2', () => {
  it('byColumnId lookup works', () => {
    const cols = [
      makeCol({ columnId: 'col:A', name: 'A' }),
      makeCol({ columnId: 'col:B', name: 'B' }),
    ];
    const registry = buildColumnRegistryV2(cols);
    expect(registry.byColumnId.get('col:A')?.name).toBe('A');
    expect(registry.byColumnId.get('col:B')?.name).toBe('B');
  });

  it('byName groups duplicates', () => {
    const cols = [
      makeCol({ columnId: 'col:X_0', name: 'X', position: 0 }),
      makeCol({ columnId: 'col:X_1', name: 'X', position: 1 }),
    ];
    const registry = buildColumnRegistryV2(cols);
    expect(registry.byName.get('X')?.length).toBe(2);
  });

  it('orderedColumns preserves order', () => {
    const cols = [
      makeCol({ columnId: 'col:C', name: 'C', position: 2 }),
      makeCol({ columnId: 'col:A', name: 'A', position: 0 }),
      makeCol({ columnId: 'col:B', name: 'B', position: 1 }),
    ];
    const registry = buildColumnRegistryV2(cols);
    expect(registry.orderedColumns.map(c => c.columnId)).toEqual(['col:C', 'col:A', 'col:B']);
  });
});

describe('isColumnRenderizable', () => {
  it('returns true for non-ambiguous column', () => {
    expect(isColumnRenderizable(makeCol({ isAmbiguous: false }))).toBe(true);
  });

  it('returns false for ambiguous column', () => {
    expect(isColumnRenderizable(makeCol({ isAmbiguous: true }))).toBe(false);
  });
});
