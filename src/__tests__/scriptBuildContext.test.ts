/**
 * Script Build Context Tests — Phase 4 Loop 1R.
 * Uses buildColumnRegistry() for real ColumnRef data.
 */

import { describe, it, expect } from 'vitest';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import type {
  RemediationContextV2,
  ColumnRef,
} from '../contracts/llm/types';

function makeRemediationContext(
  columns: { columnId: string; name: string; position: number; duplicateOrdinal?: number; isAmbiguous?: boolean; isDuplicate?: boolean }[],
  fingerprint?: string,
): RemediationContextV2 {
  return {
    evidenceEnvelopeRef: 'env:ref',
    datasetFingerprint: fingerprint ?? 'sha256:fingerprint123',
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

describe('buildScriptContext with real registry', () => {
  it('builds valid context', () => {
    const cols = buildColumnRegistry(['Age', 'Fare']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
      { columnId: cols[1].columnId, name: 'Fare', position: 1 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.valid).toBe(true);
    expect(result.correspondenceEvidence.fingerprintMatch).toBe(true);
    expect(result.correspondenceEvidence.columnsMatch).toBe(true);
  });

  it('fingerprint mismatch', () => {
    const cols = buildColumnRegistry(['Age', 'Fare']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
      { columnId: cols[1].columnId, name: 'Fare', position: 1 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:different');
    expect(result.correspondenceEvidence.fingerprintMatch).toBe(false);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('columnId missing in registry', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
      { columnId: 'col:nonexistent', name: 'Fare', position: 1 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsMatch).toBe(false);
    expect(result.correspondenceEvidence.missingColumnIds).toContain('col:nonexistent');
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('unexpected column in registry (H3 fix)', () => {
    const cols = buildColumnRegistry(['Age', 'Fare', 'Name']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsMatch).toBe(false);
    expect(result.correspondenceEvidence.unexpectedColumnIds.length).toBe(2);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('name different', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'DifferentName', position: 0 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain(cols[0].columnId);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('position different', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 5 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain(cols[0].columnId);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('ordinal different', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Score', position: 0, duplicateOrdinal: 99 },
      { columnId: cols[1].columnId, name: 'Score', position: 1, duplicateOrdinal: 0 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain(cols[0].columnId);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('flags different', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0, isAmbiguous: true },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.mismatchedColumns).toContain(cols[0].columnId);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('additional columns in registry', () => {
    const cols = buildColumnRegistry(['Age', 'Fare']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsFromContext).toBe(1);
    expect(result.correspondenceEvidence.columnsInRegistry).toBe(2);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('missing columns in registry', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
      { columnId: 'col:extra', name: 'Extra', position: 1 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.columnsFromContext).toBe(2);
    expect(result.correspondenceEvidence.columnsInRegistry).toBe(1);
    expect(result.correspondenceEvidence.valid).toBe(false);
  });

  it('correspondenceEvidence has all required fields', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect(result.correspondenceEvidence.fingerprintMatch).toBe(true);
    expect(result.correspondenceEvidence.columnsMatch).toBe(true);
    expect(result.correspondenceEvidence.missingColumnIds).toEqual([]);
    expect(result.correspondenceEvidence.unexpectedColumnIds).toEqual([]);
    expect(result.correspondenceEvidence.mismatchedColumns).toEqual([]);
    expect(result.correspondenceEvidence.columnsFromContext).toBe(1);
    expect(result.correspondenceEvidence.columnsInRegistry).toBe(1);
    expect(result.correspondenceEvidence.valid).toBe(true);
  });

  it('lists are sorted deterministically', () => {
    const cols = buildColumnRegistry(['A']);
    const ctx = makeRemediationContext([
      { columnId: 'col:z', name: 'z', position: 0 },
      { columnId: 'col:a', name: 'a', position: 1 },
      { columnId: cols[0].columnId, name: 'A', position: 2 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    const missing = result.correspondenceEvidence.missingColumnIds;
    expect(missing[0] < missing[1]).toBe(true);
  });

  it('columnRegistry uses ReadonlyMapView with no set method', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeRemediationContext([
      { columnId: cols[0].columnId, name: 'Age', position: 0 },
    ]);
    const result = buildScriptContext(ctx, cols, 'sha256:fingerprint123');
    expect('set' in (result.columnRegistry.byColumnId as any)).toBe(false);
    expect('delete' in (result.columnRegistry.byColumnId as any)).toBe(false);
  });
});
