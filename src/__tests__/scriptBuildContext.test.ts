/**
 * Script Build Context Tests — Phase 4 Loop 1.
 */

import { describe, it, expect } from 'vitest';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import type {
  RemediationContextV2,
  ColumnRef,
  ScriptBuildContextV2,
} from '../contracts/llm/types';

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

function makeRemediationContext(columns: {
  columnId: string;
  name: string;
  position: number;
  duplicateOrdinal?: number;
  isAmbiguous?: boolean;
  isDuplicate?: boolean;
}[]): RemediationContextV2 {
  return {
    evidenceEnvelopeRef: 'env:ref',
    datasetFingerprint: 'sha256:fingerprint123',
    columns: columns.map(c => ({
      columnId: c.columnId,
      name: c.name,
      position: c.position,
      duplicateOrdinal: c.duplicateOrdinal ?? 0,
      isAmbiguous: c.isAmbiguous ?? false,
      isDuplicate: c.isDuplicate ?? false,
    })),
    issues: [],
  };
}

describe('buildScriptContext', () => {
  it('builds valid context', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 0 }]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.remediationContext).toBe(ctx);
    expect(result.sourceDatasetFingerprint).toBe('sha256:fingerprint123');
    expect(result.correspondenceEvidence.valid).toBe(true);
  });

  it('fingerprint mismatch', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 0 }]);
    const result = buildScriptContext(ctx, [col], 'sha256:different');
    expect(result.correspondenceEvidence.fingerprintMatch).toBe(false);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('columnId missing in registry', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([
      { columnId: 'col:Name', name: 'Name', position: 0 },
      { columnId: 'col:Age', name: 'Age', position: 1 },
    ]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsMatch).toBe(false);
    expect(result.correspondenceEvidence.missingColumnIds).toContain('col:Age');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('name different', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'DifferentName', position: 0 }]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain('col:Name');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('position different', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 5 }]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain('col:Name');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('ordinal different', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0, duplicateOrdinal: 0 });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 0, duplicateOrdinal: 1 }]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain('col:Name');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('flags different', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0, isAmbiguous: false });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 0, isAmbiguous: true }]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain('col:Name');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('additional columns in registry', () => {
    const cols = [
      makeCol({ columnId: 'col:Name', name: 'Name', position: 0 }),
      makeCol({ columnId: 'col:Age', name: 'Age', position: 1 }),
    ];
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 0 }]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsFromContext).toBe(1);
    expect(result.correspondenceEvidence.columnsInRegistry).toBe(2);
    expect(result.correspondenceEvidence.columnsMatch).toBe(false);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('missing columns in registry', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([
      { columnId: 'col:Name', name: 'Name', position: 0 },
      { columnId: 'col:Age', name: 'Age', position: 1 },
    ]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsFromContext).toBe(2);
    expect(result.correspondenceEvidence.columnsInRegistry).toBe(1);
    expect(result.correspondenceEvidence.columnsMatch).toBe(false);
    expect(result.correspondenceEvidence.missingColumnIds).toContain('col:Age');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('columnRegistry has orderedColumns, byColumnId, byName', () => {
    const col1 = makeCol({ columnId: 'col:A', name: 'A', position: 0 });
    const col2 = makeCol({ columnId: 'col:B', name: 'B', position: 1 });
    const ctx = makeRemediationContext([
      { columnId: 'col:A', name: 'A', position: 0 },
      { columnId: 'col:B', name: 'B', position: 1 },
    ]);
    const result = buildScriptContext(ctx, [col1, col2], 'sha256:fingerprint123');
    expect(result.columnRegistry.orderedColumns.length).toBe(2);
    expect(result.columnRegistry.byColumnId.has('col:A')).toBe(true);
    expect(result.columnRegistry.byColumnId.has('col:B')).toBe(true);
    expect(result.columnRegistry.byName.get('A')?.length).toBe(1);
    expect(result.columnRegistry.byName.get('B')?.length).toBe(1);
  });

  it('correspondenceEvidence has all required fields', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const ctx = makeRemediationContext([{ columnId: 'col:Name', name: 'Name', position: 0 }]);
    const result = buildScriptContext(ctx, [col], 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.fingerprintMatch).toBe(true);
    expect(result.correspondenceEvidence.columnsMatch).toBe(true);
    expect(result.correspondenceEvidence.missingColumnIds).toEqual([]);
    expect(result.correspondenceEvidence.mismatchedColumns).toEqual([]);
    expect(result.correspondenceEvidence.columnsFromContext).toBe(1);
    expect(result.correspondenceEvidence.columnsInRegistry).toBe(1);
    expect(result.correspondenceEvidence.valid).toBe(true);
  });
});
