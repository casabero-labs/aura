/**
 * Script Column Resolver Tests — Phase 4 Loop 1R.
 * Uses buildColumnRegistry() for real ColumnRef data.
 */

import { describe, it, expect } from 'vitest';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import {
  resolveScriptColumn,
  buildColumnAccessSpec,
  buildColumnReadExpression,
  buildColumnWriteTarget,
  buildColumnRegistryV2,
  isColumnStructurallyRenderable,
} from '../contracts/llm/scriptColumnResolver';
import type { ColumnRef, ScriptBuildContextV2 } from '../contracts/llm/types';

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
      unexpectedColumnIds: [],
      mismatchedColumns: [],
      columnsFromContext: columns.length,
      columnsInRegistry: columns.length,
      valid: true,
    },
  };
}

// ── Integration: buildColumnRegistry → buildColumnRegistryV2 → resolveScriptColumn ──

describe('Integration pipeline (M3)', () => {
  it('resolves unique column: Age', () => {
    const cols = buildColumnRegistry(['Age', 'Fare']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columnRef.name).toBe('Age');
      expect(result.columnRef.pythonLiteral).toBe(`_c[${JSON.stringify(cols[0].columnId)}]`);
    }
  });

  it('resolves reserved word: class', () => {
    const cols = buildColumnRegistry(['class', 'Fare']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columnRef.name).toBe('class');
      expect(result.columnRef.isReservedWord).toBe(true);
    }
  });

  it('resolves column with spaces: Customer Name', () => {
    const cols = buildColumnRegistry(['Customer Name', 'Age']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columnRef.name).toBe('Customer Name');
  });

  it('resolves column with special chars: price (€)', () => {
    const cols = buildColumnRegistry(['price (€)', 'Fare']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(true);
  });

  it('resolves column with quotes: customer\'s note', () => {
    const cols = buildColumnRegistry(["customer's note", 'Age']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(true);
  });

  it('resolves first duplicate (ordinal 0): Passenger', () => {
    const cols = buildColumnRegistry(['Passenger', 'Age', 'Passenger']);
    const ctx = makeContext(cols);
    const first = cols[0]; // ordinal 0
    const result = resolveScriptColumn(first.columnId, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columnRef.duplicateOrdinal).toBe(0);
      expect(result.columnRef.isDuplicate).toBe(true);
    }
  });

  it('resolves second duplicate (ordinal 1): Passenger', () => {
    const cols = buildColumnRegistry(['Passenger', 'Age', 'Passenger']);
    const ctx = makeContext(cols);
    const second = cols[2]; // ordinal 1
    const result = resolveScriptColumn(second.columnId, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columnRef.duplicateOrdinal).toBe(1);
      expect(result.columnRef.isDuplicate).toBe(true);
    }
  });

  it('pythonLiteral always _c["columnId"] format', () => {
    const cols = buildColumnRegistry(['Age', 'Fare', 'Passenger', 'Passenger', 'Score']);
    const ctx = makeContext(cols);
    for (const col of cols) {
      expect(col.pythonLiteral).toBe(`_c[${JSON.stringify(col.columnId)}]`);
      if (!col.isAmbiguous) {
        const result = resolveScriptColumn(col.columnId, ctx);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.columnRef.pythonLiteral).toBe(`_c[${JSON.stringify(col.columnId)}]`);
        }
      }
    }
  });
});

// ── Build Expressions with real ColumnRef ──

describe('buildColumnReadExpression (H1)', () => {
  it('unique column uses label access', () => {
    const cols = buildColumnRegistry(['Age']);
    const expr = buildColumnReadExpression(cols[0]);
    expect(expr).toBe(`df_clean[_c[${JSON.stringify(cols[0].columnId)}]]`);
    expect(expr).not.toContain('"_c');
  });

  it('duplicate column uses iloc positional access', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const expr0 = buildColumnReadExpression(cols[0]);
    const expr1 = buildColumnReadExpression(cols[1]);
    expect(expr0).toBe(`df_clean.iloc[:, _c[${JSON.stringify(cols[0].columnId)}]["position"]]`);
    expect(expr1).toBe(`df_clean.iloc[:, _c[${JSON.stringify(cols[1].columnId)}]["position"]]`);
  });

  it('no expression wraps pythonLiteral in JSON.stringify', () => {
    const cols = buildColumnRegistry(['Age', 'Fare', 'Score', 'Score']);
    for (const col of cols) {
      const expr = buildColumnReadExpression(col);
      expect(expr).not.toContain('"_c');
    }
  });

  it('no expression uses raw column name as authority', () => {
    const cols = buildColumnRegistry(['Age', 'Fare']);
    for (const col of cols) {
      const expr = buildColumnReadExpression(col);
      expect(expr).toContain(`_c[${JSON.stringify(col.columnId)}]`);
    }
  });
});

describe('buildColumnWriteTarget (H1)', () => {
  it('unique column write target matches read expression shape', () => {
    const cols = buildColumnRegistry(['Age']);
    expect(buildColumnWriteTarget(cols[0])).toBe(`df_clean[_c[${JSON.stringify(cols[0].columnId)}]]`);
  });

  it('duplicate column write target uses iloc', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    expect(buildColumnWriteTarget(cols[1])).toBe(`df_clean.iloc[:, _c[${JSON.stringify(cols[1].columnId)}]["position"]]`);
  });
});

// ── ColumnAccessSpec with expressions ──

describe('buildColumnAccessSpec with expressions', () => {
  it('unique column has label accessMode and expressions', () => {
    const cols = buildColumnRegistry(['Age']);
    const spec = buildColumnAccessSpec(cols[0]);
    expect(spec.accessMode).toBe('label');
    expect(spec.readExpression).toBe(`df_clean[_c[${JSON.stringify(cols[0].columnId)}]]`);
    expect(spec.writeTarget).toBe(`df_clean[_c[${JSON.stringify(cols[0].columnId)}]]`);
  });

  it('duplicate column has position accessMode and iloc expressions', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const spec = buildColumnAccessSpec(cols[1]);
    expect(spec.accessMode).toBe('position');
    expect(spec.readExpression).toContain('iloc');
    expect(spec.writeTarget).toContain('iloc');
  });
});

// ── Resolver edge cases ──

describe('resolveScriptColumn edge cases', () => {
  it('returns missing_column for null columnId', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(null, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_column');
  });

  it('returns missing_column for nonexistent columnId', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn('col:nonexistent', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_column');
  });

  it('returns ambiguous_column for ambiguous column', () => {
    const cols = buildColumnRegistry(['col']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ambiguous_column');
  });

  it('returns context_invalid when evidence.valid is false (H4)', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeContext(cols);
    ctx.correspondenceEvidence.valid = false;
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('context_invalid');
  });

  it('does NOT resolve by name', () => {
    const cols = buildColumnRegistry(['Age']);
    const ctx = makeContext(cols);
    const result = resolveScriptColumn(cols[0].columnId, ctx);
    expect(result.ok).toBe(true);
    // The resolver only uses columnId, not name
  });
});

// ── Registry builder validation ──

describe('buildColumnRegistryV2 validation', () => {
  it('rejects duplicate columnId (M1)', () => {
    const col = { columnId: 'col:dup', name: 'A', position: 0, duplicateOrdinal: 0, pythonLiteral: '_c["col:dup"]', isAmbiguous: false, isDuplicate: false, isReservedWord: false };
    expect(() => buildColumnRegistryV2([col, { ...col, name: 'B', position: 1 }])).toThrow(/DUPLICATE_COLUMN_ID|Duplicate columnId/);
  });

  it('rejects duplicate position', () => {
    const c0 = { columnId: 'col:A', name: 'A', position: 0, duplicateOrdinal: 0, pythonLiteral: '_c["col:A"]', isAmbiguous: false, isDuplicate: false, isReservedWord: false };
    const c1 = { columnId: 'col:B', name: 'B', position: 0, duplicateOrdinal: 0, pythonLiteral: '_c["col:B"]', isAmbiguous: false, isDuplicate: false, isReservedWord: false };
    expect(() => buildColumnRegistryV2([c0, c1])).toThrow(/DUPLICATE_POSITION|Duplicate position/);
  });

  it('rejects invalid position (negative)', () => {
    const col: ColumnRef = { columnId: 'col:A', name: 'A', position: -1, duplicateOrdinal: 0, pythonLiteral: '_c["col:A"]', isAmbiguous: false, isDuplicate: false, isReservedWord: false };
    expect(() => buildColumnRegistryV2([col])).toThrow(/INVALID_POSITION|invalid position/);
  });

  it('rejects non-canonical pythonLiteral (H3)', () => {
    const col: ColumnRef = { columnId: 'col:A', name: 'A', position: 0, duplicateOrdinal: 0, pythonLiteral: 'A', isAmbiguous: false, isDuplicate: false, isReservedWord: false };
    expect(() => buildColumnRegistryV2([col])).toThrow(/NON_CANONICAL_PYTHON_LITERAL|pythonLiteral/);
  });

  it('rejects non-canonical pythonLiteral like df[\'class\']', () => {
    const col: ColumnRef = { columnId: 'col:class', name: 'class', position: 0, duplicateOrdinal: 0, pythonLiteral: "df['class']", isAmbiguous: false, isDuplicate: false, isReservedWord: true };
    expect(() => buildColumnRegistryV2([col])).toThrow(/NON_CANONICAL_PYTHON_LITERAL|pythonLiteral/);
  });

  it('accepts valid registry from buildColumnRegistry', () => {
    const cols = buildColumnRegistry(['Age', 'Fare', 'Name']);
    const reg = buildColumnRegistryV2(cols);
    expect(reg.byColumnId.size).toBe(3);
    expect(reg.orderedColumns.length).toBe(3);
  });
});

// ── Immutability (M2) ──

describe('Registry immutability (M2)', () => {
  const cols = buildColumnRegistry(['Age', 'Fare']);
  const reg = buildColumnRegistryV2(cols);

  it('byColumnId has no .set method after cast to any', () => {
    expect('set' in (reg.byColumnId as any)).toBe(false);
  });

  it('byColumnId has no .delete method after cast to any', () => {
    expect('delete' in (reg.byColumnId as any)).toBe(false);
  });

  it('byName has no .set method after cast to any', () => {
    expect('set' in (reg.byName as any)).toBe(false);
  });

  it('byName inner arrays are frozen (push throws)', () => {
    const arr = reg.byName.get('Age')!;
    expect(() => (arr as ColumnRef[]).push(cols[0])).toThrow(TypeError);
  });

  it('ColumnRef name cannot be mutated', () => {
    const col = reg.byColumnId.get(cols[0].columnId)!;
    expect(() => { (col as any).name = 'MUTATED'; }).toThrow(TypeError);
  });

  it('orderedColumns is frozen (push throws)', () => {
    expect(() => (reg.orderedColumns as ColumnRef[]).push(cols[0])).toThrow(TypeError);
  });

  it('byColumnId.get returns frozen ColumnRef', () => {
    const col = reg.byColumnId.get(cols[0].columnId)!;
    expect(Object.isFrozen(col)).toBe(true);
  });
});

// ── isColumnStructurallyRenderable (L2) ──

describe('isColumnStructurallyRenderable', () => {
  it('returns true for non-ambiguous column', () => {
    const cols = buildColumnRegistry(['Age']);
    expect(isColumnStructurallyRenderable(cols[0])).toBe(true);
  });

  it('returns false for ambiguous column', () => {
    const cols = buildColumnRegistry(['col']);
    expect(isColumnStructurallyRenderable(cols[0])).toBe(false);
  });
});
