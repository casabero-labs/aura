/**
 * Script Renderer v2 Tests — Phase 4 Loop 2.
 *
 * Comprehensive tests for deterministic Python/Pandas script renderer.
 * Coverage: header, footer, all actionType templates, security, determinism.
 */

import { describe, it, expect } from 'vitest';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildColumnRegistryV2 } from '../contracts/llm/scriptColumnResolver';
import { PLACEHOLDER_VOCABULARY_V2, PLACEHOLDER_COUNT } from '../contracts/llm/placeholderVocabulary';
import {
  SCRIPT_RENDERER_VERSION,
  renderActionV2,
  buildScriptHeader,
  buildScriptFooter,
  buildScriptText,
  RenderableScriptActionV2,
  ScriptRendererError,
} from '../contracts/llm/scriptRendererV2';
import type {
  ColumnRef,
  ColumnRegistryV2,
  RemediationActionV2,
} from '../contracts/llm/types';

// ── Fixtures ──

function makeColRef(
  name: string,
  position: number,
  duplicateOrdinal = 0,
  extra: Partial<ColumnRef> = {},
): ColumnRef {
  const isDuplicate = extra.isDuplicate ?? false;
  const isAmbiguous = extra.isAmbiguous ?? false;
  const isReservedWord = extra.isReservedWord ?? false;
  const columnId = `col:${name}@${position}@${duplicateOrdinal}`;
  return {
    columnId,
    name,
    position,
    duplicateOrdinal,
    pythonLiteral: `_c[${JSON.stringify(columnId)}]`,
    isAmbiguous,
    isDuplicate,
    isReservedWord,
    ...extra,
  };
}

function buildRegistry(columns: ColumnRef[]): ColumnRegistryV2 {
  return buildColumnRegistryV2(columns);
}

function makeAction(
  actionType: RemediationActionV2['actionType'],
  columnId: string | null,
  params: Record<string, unknown>,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
): RemediationActionV2 {
  return {
    actionId: `act:test_${actionType}_${columnId ?? 'null'}`,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType,
    parameters: params as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
  };
}

// ── Version ──

describe('SCRIPT_RENDERER_VERSION', () => {
  it('is 2.0.0', () => {
    expect(SCRIPT_RENDERER_VERSION).toBe('2.0.0');
  });
});

// ── Header & Footer ──

describe('buildScriptHeader', () => {
  it('contains pandas import', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).toContain('import pandas as pd');
  });

  it('contains numpy import', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).toContain('import numpy as np');
  });

  it('does not contain any other import', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).not.toContain('import os');
    expect(header).not.toContain('import sys');
    expect(header).not.toContain('import subprocess');
    expect(header).not.toContain('import requests');
  });

  it('contains _c dict from generateSafeColumnDict', () => {
    const cols = buildColumnRegistry(['Age', 'Name']);
    const registry = buildRegistry(cols);
    const header = buildScriptHeader(registry);
    expect(header).toContain('_c = {');
    expect(header).toContain(`"${cols[0].columnId}":`);
    expect(header).toContain(`"${cols[1].columnId}":`);
  });

  it('contains def clean_dataset(df):', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).toContain('def clean_dataset(df):');
  });

  it('contains df_clean = df.copy()', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).toContain('df_clean = df.copy()');
  });

  it('contains no timestamp, UUID, or generatedAt', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).not.toContain('generatedAt');
    expect(header).not.toContain('timestamp');
    expect(header).not.toMatch(/20\d\d-\d\d-\d\d/);
    expect(header).not.toContain('uuid');
    expect(header).not.toContain('UUID');
  });

  it('does not include extra comments', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const header = buildScriptHeader(registry);
    expect(header).not.toContain('# Script generado');
    expect(header).not.toContain('# Sin transformaciones');
  });
});

describe('buildScriptFooter', () => {
  it('returns df_clean', () => {
    const footer = buildScriptFooter();
    expect(footer).toContain('return df_clean');
  });

  it('has exactly 4 spaces indentation', () => {
    const footer = buildScriptFooter();
    expect(footer.startsWith('    return df_clean')).toBe(true);
  });
});

// ── Zero Actions ──

describe('buildScriptText with zero actions', () => {
  it('produces a valid Python script', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const script = buildScriptText([], registry);
    expect(script).toContain('def clean_dataset(df):');
    expect(script).toContain('df_clean = df.copy()');
    expect(script).toContain('return df_clean');
  });

  it('ends with a newline', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const script = buildScriptText([], registry);
    expect(script.endsWith('\n')).toBe(true);
  });

  it('has no action lines', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const script = buildScriptText([], registry);
    const lines = script.split('\n');
    const actionLines = lines.filter(l => l.startsWith('    df_clean'));
    expect(actionLines).toHaveLength(1);
  });
});

// ── trim_whitespace ──

describe('trim_whitespace', () => {
  it('collapse false: uses str.strip() only', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('.str.strip()');
    expect(line).not.toContain('str.replace');
  });

  it('collapse true: uses str.strip() and str.replace', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: true,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('.str.strip()');
    expect(line).toContain('.str.replace(r"\\s+"');
    expect(line).toContain('regex=True');
  });

  it('uses df_clean[pythonLiteral] for unique column', () => {
    const cols = buildColumnRegistry(['Age']);
    const registry = buildRegistry(cols);
    const col = cols[0];
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain(`df_clean[_c[${JSON.stringify(col.columnId)}]]`);
  });

  it('uses iloc for duplicate column', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const registry = buildRegistry(cols);
    const col0 = cols[0];
    const action = makeAction('trim_whitespace', col0.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col0, registry);
    expect(line).toContain('iloc[:,');
    expect(line).toContain('["position"]]');
  });

  it('rejects trimEdges !== true', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: false,
      collapseInternalWhitespace: false,
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });
});

// ── drop_exact_duplicates ──

describe('drop_exact_duplicates', () => {
  it('accepts null columnRef', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const action = makeAction('drop_exact_duplicates', null, { keep: 'first' });
    const line = renderActionV2(action, null, registry);
    expect(line).toContain('drop_duplicates');
    expect(line).toContain('keep="first"');
    expect(line).toContain('.copy()');
  });

  it('rejects non-null columnRef', () => {
    const col = makeColRef('Age', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('drop_exact_duplicates', col.columnId, { keep: 'first' });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('rejects non-null action.columnId', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const action = makeAction('drop_exact_duplicates', 'col:someId', { keep: 'first' });
    expect(() => renderActionV2(action, null, registry)).toThrow(ScriptRendererError);
  });

  it('rejects keep !== "first"', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const action = makeAction('drop_exact_duplicates', null, { keep: 'last' });
    expect(() => renderActionV2(action, null, registry)).toThrow(ScriptRendererError);
  });

  it('uses df_clean level (no column reference)', () => {
    const registry = buildRegistry([makeColRef('Age', 0)]);
    const action = makeAction('drop_exact_duplicates', null, { keep: 'first' });
    const line = renderActionV2(action, null, registry);
    expect(line).toContain('df_clean = df_clean.drop_duplicates');
  });
});

// ── normalize_placeholders ──

describe('normalize_placeholders', () => {
  it('uses the full PLACEHOLDER_VOCABULARY_V2 list', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_placeholders', col.columnId, {
      strategy: 'controlled_vocabulary',
      replacement: null,
    });
    const line = renderActionV2(action, col, registry);

    for (const placeholder of PLACEHOLDER_VOCABULARY_V2) {
      expect(line).toContain(JSON.stringify(placeholder));
    }
  });

  it('uses np.nan in replacement', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_placeholders', col.columnId, {
      strategy: 'controlled_vocabulary',
      replacement: null,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('np.nan');
  });

  it('serialized list is valid Python', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_placeholders', col.columnId, {
      strategy: 'controlled_vocabulary',
      replacement: null,
    });
    const line = renderActionV2(action, col, registry);
    const match = line.match(/replace\(\[([\s\S]*?)\], np\.nan\)/);
    expect(match).not.toBeNull();
  });

  it('vocabulary length equals PLACEHOLDER_COUNT', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_placeholders', col.columnId, {
      strategy: 'controlled_vocabulary',
      replacement: null,
    });
    const line = renderActionV2(action, col, registry);
    const allPlaceholders = PLACEHOLDER_VOCABULARY_V2.map(v => JSON.stringify(v));
    for (const p of allPlaceholders) {
      expect(line).toContain(p);
    }
    expect(PLACEHOLDER_COUNT).toBe(PLACEHOLDER_VOCABULARY_V2.length);
  });

  it('rejects strategy !== "controlled_vocabulary"', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_placeholders', col.columnId, {
      strategy: 'llm_vocabulary',
      replacement: null,
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('rejects replacement !== null', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_placeholders', col.columnId, {
      strategy: 'controlled_vocabulary',
      replacement: 'UNKNOWN',
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('works with duplicate column', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const registry = buildRegistry(cols);
    const col0 = cols[0];
    const action = makeAction('normalize_placeholders', col0.columnId, {
      strategy: 'controlled_vocabulary',
      replacement: null,
    });
    const line = renderActionV2(action, col0, registry);
    expect(line).toContain('iloc[:,');
    expect(line).toContain('np.nan');
  });
});

// ── normalize_casing ──

describe('normalize_casing', () => {
  it('title_case: uses str.title()', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_casing', col.columnId, {
      strategy: 'title_case',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('.str.title()');
  });

  it('lowercase: uses str.lower()', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_casing', col.columnId, {
      strategy: 'lowercase',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('.str.lower()');
  });

  it('invalid strategy throws', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_casing', col.columnId, {
      strategy: 'UPPERCASE',
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('both strategies include strip()', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);

    const actionTitle = makeAction('normalize_casing', col.columnId, { strategy: 'title_case' });
    expect(renderActionV2(actionTitle, col, registry)).toContain('.str.strip()');

    const actionLower = makeAction('normalize_casing', col.columnId, { strategy: 'lowercase' });
    expect(renderActionV2(actionLower, col, registry)).toContain('.str.strip()');
  });
});

// ── convert_disguised_numbers ──

describe('convert_disguised_numbers', () => {
  it('uses pd.to_numeric template', () => {
    const col = makeColRef('Amount', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('convert_disguised_numbers', col.columnId, {
      decimalSeparator: 'auto',
      errors: 'coerce',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('pd.to_numeric(');
  });

  it('uses errors="coerce"', () => {
    const col = makeColRef('Amount', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('convert_disguised_numbers', col.columnId, {
      decimalSeparator: 'auto',
      errors: 'coerce',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('errors="coerce"');
  });

  it('replaces comma with dot', () => {
    const col = makeColRef('Amount', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('convert_disguised_numbers', col.columnId, {
      decimalSeparator: 'auto',
      errors: 'coerce',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('.str.replace(",", ".", regex=False)');
  });

  it('rejects decimalSeparator !== "auto"', () => {
    const col = makeColRef('Amount', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('convert_disguised_numbers', col.columnId, {
      decimalSeparator: ',',
      errors: 'coerce',
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('rejects errors !== "coerce"', () => {
    const col = makeColRef('Amount', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('convert_disguised_numbers', col.columnId, {
      decimalSeparator: 'auto',
      errors: 'raise',
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('works with duplicate column', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const registry = buildRegistry(cols);
    const col1 = cols[1];
    const action = makeAction('convert_disguised_numbers', col1.columnId, {
      decimalSeparator: 'auto',
      errors: 'coerce',
    });
    const line = renderActionV2(action, col1, registry);
    expect(line).toContain('iloc[:,');
    expect(line).toContain('pd.to_numeric(');
  });
});

// ── requires_human_review ──

describe('requires_human_review', () => {
  const allReasonCodes: Array<RequiresHumanReviewParams['reasonCode']> = [
    'unknown_rule',
    'ambiguous_column',
    'review_only_rule',
    'diagnosis_requires_review',
    'authorization_missing',
    'no_safe_transform',
  ];

  it('generates only a comment', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('requires_human_review', col.columnId, {
      reasonCode: 'unknown_rule',
    });
    const line = renderActionV2(action, col, registry);
    expect(line.trim().startsWith('#')).toBe(true);
  });

  it('comment contains reasonCode', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('requires_human_review', col.columnId, {
      reasonCode: 'ambiguous_column',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain('reasonCode=ambiguous_column');
  });

  it('each valid reasonCode renders without error', () => {
    const registry = buildRegistry([makeColRef('Name', 0)]);
    for (const reasonCode of allReasonCodes) {
      const action = makeAction('requires_human_review', 'col:test', { reasonCode });
      expect(() => renderActionV2(action, null, registry)).not.toThrow();
    }
  });

  it('invalid reasonCode throws', () => {
    const registry = buildRegistry([makeColRef('Name', 0)]);
    const action = makeAction('requires_human_review', 'col:test', {
      reasonCode: 'llm_generated_reason',
    });
    expect(() => renderActionV2(action, null, registry)).toThrow(ScriptRendererError);
  });

  it('no assignment in comment', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('requires_human_review', col.columnId, {
      reasonCode: 'unknown_rule',
    });
    const line = renderActionV2(action, col, registry);
    expect(line).not.toContain(' = ');
    expect(line).not.toContain('df_clean');
    expect(line).not.toContain('(');
  });

  it('no executable code in comment', () => {
    const registry = buildRegistry([makeColRef('Name', 0)]);
    for (const reasonCode of allReasonCodes) {
      const action = makeAction('requires_human_review', 'col:test', { reasonCode });
      const line = renderActionV2(action, null, registry);
      expect(line.trim()).toMatch(/^# AURA review-only: reasonCode=.+; no transformation rendered$/);
    }
  });

  it('accepts null columnRef', () => {
    const registry = buildRegistry([makeColRef('Name', 0)]);
    const action = makeAction('requires_human_review', null, {
      reasonCode: 'unknown_rule',
    });
    expect(() => renderActionV2(action, null, registry)).not.toThrow();
  });
});

type RequiresHumanReviewParams = { reasonCode: string };

// ── Security & References ──

describe('Security: approvalStatus enforcement', () => {
  it('pending action throws RENDER_ACTION_NOT_APPROVED', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    }, 'pending');
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('rejected action throws RENDER_ACTION_NOT_APPROVED', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    }, 'rejected');
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });
});

describe('Security: column reference enforcement', () => {
  it('columnId mismatch throws RENDER_COLUMN_MISMATCH', () => {
    const col = makeColRef('Name', 0);
    const otherCol = makeColRef('Age', 1);
    const registry = buildRegistry([col, otherCol]);
    const action = makeAction('trim_whitespace', otherCol.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('column not in registry throws RENDER_COLUMN_NOT_IN_REGISTRY', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const externalCol = makeColRef('External', 99);
    const action = makeAction('trim_whitespace', externalCol.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    expect(() => renderActionV2(action, externalCol, registry)).toThrow(ScriptRendererError);
  });

  it('ambiguous column throws RENDER_COLUMN_AMBIGUOUS', () => {
    const col = makeColRef('column', 0, 0, { isAmbiguous: true });
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    expect(() => renderActionV2(action, col, registry)).toThrow(ScriptRendererError);
  });

  it('no name resolution (byName not used)', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).not.toContain('df_clean["Name"]');
    expect(line).toContain(col.pythonLiteral);
  });
});

describe('Special column names', () => {
  it('reserved word column: uses pythonLiteral (bracket notation)', () => {
    const col = makeColRef('class', 0, 0, { isReservedWord: true });
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain(col.pythonLiteral);
  });

  it('column with spaces: uses pythonLiteral', () => {
    const col = makeColRef('First Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain(col.pythonLiteral);
  });

  it('column with special chars: uses pythonLiteral', () => {
    const col = makeColRef("O'Neil", 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const line = renderActionV2(action, col, registry);
    expect(line).toContain(col.pythonLiteral);
  });

  it('duplicate ordinal 0 and 1: both render correctly', () => {
    const cols = buildColumnRegistry(['Score', 'Score']);
    const registry = buildRegistry(cols);
    const col0 = cols[0];
    const col1 = cols[1];

    const action0 = makeAction('trim_whitespace', col0.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });
    const action1 = makeAction('trim_whitespace', col1.columnId, {
      trimEdges: true,
      collapseInternalWhitespace: false,
    });

    const line0 = renderActionV2(action0, col0, registry);
    const line1 = renderActionV2(action1, col1, registry);

    expect(line0).toContain('.iloc[:,');
    expect(line1).toContain('.iloc[:,');

    expect(line0).not.toBe(line1);
  });
});

// ── Determinism ──

describe('Determinism', () => {
  it('renders same input three times: text identical', () => {
    const cols = buildColumnRegistry(['Age', 'City', 'Fare']);
    const registry = buildRegistry(cols);
    const actions: RenderableScriptActionV2[] = [
      {
        action: makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: true }),
        columnRef: cols[0],
      },
      {
        action: makeAction('normalize_casing', cols[1].columnId, { strategy: 'lowercase' }),
        columnRef: cols[1],
      },
      {
        action: makeAction('normalize_placeholders', cols[2].columnId, { strategy: 'controlled_vocabulary', replacement: null }),
        columnRef: cols[2],
      },
    ];

    const script1 = buildScriptText(actions, registry);
    const script2 = buildScriptText(actions, registry);
    const script3 = buildScriptText(actions, registry);

    expect(script1).toBe(script2);
    expect(script2).toBe(script3);
  });

  it('no generatedAt anywhere', () => {
    const cols = buildColumnRegistry(['Age']);
    const registry = buildRegistry(cols);
    const actions: RenderableScriptActionV2[] = [
      {
        action: makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }),
        columnRef: cols[0],
      },
    ];
    const script = buildScriptText(actions, registry);
    expect(script).not.toContain('generatedAt');
    expect(script).not.toContain('timestamp');
    expect(script).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it('no UUID anywhere', () => {
    const cols = buildColumnRegistry(['Age']);
    const registry = buildRegistry(cols);
    const actions: RenderableScriptActionV2[] = [
      {
        action: makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }),
        columnRef: cols[0],
      },
    ];
    const script = buildScriptText(actions, registry);
    expect(script).not.toContain('uuid');
    expect(script).not.toContain('UUID');
  });

  it('order preserved (not sorted by actionId or actionType)', () => {
    const cols = buildColumnRegistry(['Age', 'City', 'Fare']);
    const registry = buildRegistry(cols);
    const actions: RenderableScriptActionV2[] = [
      {
        action: makeAction('normalize_casing', cols[1].columnId, { strategy: 'lowercase' }),
        columnRef: cols[1],
      },
      {
        action: makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: true }),
        columnRef: cols[0],
      },
      {
        action: makeAction('normalize_placeholders', cols[2].columnId, { strategy: 'controlled_vocabulary', replacement: null }),
        columnRef: cols[2],
      },
    ];
    const script = buildScriptText(actions, registry);
    const lines = script.split('\n').filter(l => l.startsWith('    df_clean') || l.startsWith('    #'));

    const casingIdx = lines.findIndex(l => l.includes('str.title()') || l.includes('str.lower()'));
    const trimIdx = lines.findIndex(l => l.includes('str.replace'));
    const placeholdersIdx = lines.findIndex(l => l.includes('np.nan'));

    expect(casingIdx).toBeLessThan(trimIdx);
    expect(trimIdx).toBeLessThan(placeholdersIdx);
  });
});

// ── Full Script ──

describe('Full script with all actionTypes', () => {
  it('renders 6 actionTypes without error', () => {
    const cols = buildColumnRegistry(['FirstName', 'Age', 'Fare', 'Status']);
    const registry = buildRegistry(cols);

    const actions: RenderableScriptActionV2[] = [
      {
        action: makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }),
        columnRef: cols[0],
      },
      {
        action: makeAction('drop_exact_duplicates', null, { keep: 'first' }),
        columnRef: null,
      },
      {
        action: makeAction('normalize_placeholders', cols[1].columnId, { strategy: 'controlled_vocabulary', replacement: null }),
        columnRef: cols[1],
      },
      {
        action: makeAction('normalize_casing', cols[2].columnId, { strategy: 'title_case' }),
        columnRef: cols[2],
      },
      {
        action: makeAction('convert_disguised_numbers', cols[3].columnId, { decimalSeparator: 'auto', errors: 'coerce' }),
        columnRef: cols[3],
      },
      {
        action: makeAction('requires_human_review', 'col:some', { reasonCode: 'unknown_rule' }),
        columnRef: null,
      },
    ];

    expect(() => buildScriptText(actions, registry)).not.toThrow();
  });

  it('script ends with return df_clean', () => {
    const cols = buildColumnRegistry(['Name']);
    const registry = buildRegistry(cols);
    const script = buildScriptText([], registry);
    expect(script.trim().split('\n').pop()).toBe('    return df_clean');
  });

  it('all action lines have 4-space indentation', () => {
    const cols = buildColumnRegistry(['FirstName', 'AgeCount']);
    const registry = buildRegistry(cols);
    const actions: RenderableScriptActionV2[] = [
      {
        action: makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }),
        columnRef: cols[0],
      },
      {
        action: makeAction('normalize_casing', cols[1].columnId, { strategy: 'lowercase' }),
        columnRef: cols[1],
      },
    ];
    const script = buildScriptText(actions, registry);
    const lines = script.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('import ') && !line.startsWith('def ') && !line.startsWith('_c') && !line.startsWith('}')) {
        expect(line).toMatch(/^    .+$/);
      }
    }
  });
});

// ── ScriptRendererError codes ──

describe('ScriptRendererError codes', () => {
  it('RENDER_ACTION_NOT_APPROVED code is correct', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending');
    try {
      renderActionV2(action, col, registry);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScriptRendererError);
      expect((e as ScriptRendererError).code).toBe('RENDER_ACTION_NOT_APPROVED');
    }
  });

  it('RENDER_COLUMN_REQUIRED code is correct', () => {
    const registry = buildRegistry([makeColRef('Name', 0)]);
    const action = makeAction('trim_whitespace', null, { trimEdges: true, collapseInternalWhitespace: false });
    try {
      renderActionV2(action, null, registry);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScriptRendererError);
      expect((e as ScriptRendererError).code).toBe('RENDER_COLUMN_REQUIRED');
    }
  });

  it('RENDER_COLUMN_AMBIGUOUS code is correct', () => {
    const col = makeColRef('col', 0, 0, { isAmbiguous: true });
    const registry = buildRegistry([col]);
    const action = makeAction('trim_whitespace', col.columnId, { trimEdges: true, collapseInternalWhitespace: false });
    try {
      renderActionV2(action, col, registry);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScriptRendererError);
      expect((e as ScriptRendererError).code).toBe('RENDER_COLUMN_AMBIGUOUS');
    }
  });

  it('RENDER_PARAMETERS_INVALID code is correct', () => {
    const col = makeColRef('Name', 0);
    const registry = buildRegistry([col]);
    const action = makeAction('normalize_casing', col.columnId, { strategy: 'INVALID' });
    try {
      renderActionV2(action, col, registry);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScriptRendererError);
      expect((e as ScriptRendererError).code).toBe('RENDER_PARAMETERS_INVALID');
    }
  });

  it('RENDER_UNSUPPORTED_ACTION code for unknown actionType', () => {
    const col = makeColRef('FirstName', 0);
    const registry = buildRegistry([col]);
    const action = {
      actionId: 'act:test_unsupported',
      issueId: 'issue:test',
      ruleId: 'rule:test',
      columnId: col.columnId,
      actionType: 'UNSUPPORTED_TYPE' as unknown as RemediationActionV2['actionType'],
      parameters: {} as RemediationActionV2['parameters'],
      actionability: 'auto_safe',
      evidenceRefs: [],
      approvalStatus: 'approved' as const,
    };
    try {
      renderActionV2(action, col, registry);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScriptRendererError);
      expect((e as ScriptRendererError).code).toBe('RENDER_UNSUPPORTED_ACTION');
    }
  });
});
