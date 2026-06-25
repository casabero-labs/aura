/**
 * ScriptContractV2 Types Tests — Phase 4 Loop 1.
 */

import { describe, it, expect } from 'vitest';
import type {
  ScriptContractCandidateV2,
  ScriptContractV2,
  ScriptValidationResultV2,
  ScriptExcludedActionV2,
  ColumnRef,
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

function makeCandidate(overrides: Partial<ScriptContractCandidateV2> = {}): ScriptContractCandidateV2 {
  return {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    remediationRef: 'plan:test',
    datasetFingerprint: 'sha256:test',
    acceptedActionIds: [],
    rejectedActionIds: [],
    excludedActionIds: [],
    columnRefs: [],
    rendererVersion: '1.0.0',
    placeholderVocabularyVersion: '1.0.0',
    scriptText: 'def clean_dataset(df):\n    df_clean = df.copy()\n    return df_clean\n',
    cleanDatasetFn: 'clean_dataset',
    generatedAt: '2026-06-25T00:00:00.000Z',
    ...overrides,
  };
}

function makeValidationResult(overrides: Partial<ScriptValidationResultV2> = {}): ScriptValidationResultV2 {
  return {
    valid: true,
    errors: [],
    warnings: [],
    pythonSyntax: {
      state: 'passed',
      engine: 'python',
    },
    ...overrides,
  };
}

function makeFinal(overrides: Partial<ScriptContractV2> = {}): ScriptContractV2 {
  return {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    remediationRef: 'plan:test',
    datasetFingerprint: 'sha256:test',
    acceptedActionIds: [],
    rejectedActionIds: [],
    excludedActionIds: [],
    columnRefs: [],
    rendererVersion: '1.0.0',
    placeholderVocabularyVersion: '1.0.0',
    scriptText: 'def clean_dataset(df):\n    df_clean = df.copy()\n    return df_clean\n',
    cleanDatasetFn: 'clean_dataset',
    scriptHash: 'sha256:abc123',
    validationResult: makeValidationResult(),
    generatedAt: '2026-06-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('ScriptContractCandidateV2', () => {
  it('candidate does NOT contain scriptHash', () => {
    const candidate = makeCandidate();
    expect('scriptHash' in candidate).toBe(false);
  });

  it('candidate does NOT contain validationResult', () => {
    const candidate = makeCandidate();
    expect('validationResult' in candidate).toBe(false);
  });

  it('candidate has all required fields', () => {
    const candidate = makeCandidate();
    expect(candidate.contractId).toBe('aura.script.v2');
    expect(candidate.contractVersion).toBe('2.0.0');
    expect(candidate.remediationRef).toBeDefined();
    expect(candidate.datasetFingerprint).toBeDefined();
    expect(Array.isArray(candidate.acceptedActionIds)).toBe(true);
    expect(Array.isArray(candidate.rejectedActionIds)).toBe(true);
    expect(Array.isArray(candidate.excludedActionIds)).toBe(true);
    expect(Array.isArray(candidate.columnRefs)).toBe(true);
    expect(candidate.rendererVersion).toBeDefined();
    expect(candidate.placeholderVocabularyVersion).toBeDefined();
    expect(candidate.scriptText).toBeDefined();
    expect(candidate.cleanDatasetFn).toBeDefined();
    expect(candidate.generatedAt).toBeDefined();
  });

  it('excludedActionIds entries have actionId and reason', () => {
    const candidate = makeCandidate({
      excludedActionIds: [
        { actionId: 'act:1', reason: 'pending' },
        { actionId: 'act:2', reason: 'ambiguous_column' },
        { actionId: 'act:3', reason: 'unsupported_action' },
        { actionId: 'act:4', reason: 'missing_column' },
      ],
    });
    expect(candidate.excludedActionIds[0].reason).toBe('pending');
    expect(candidate.excludedActionIds[1].reason).toBe('ambiguous_column');
    expect(candidate.excludedActionIds[2].reason).toBe('unsupported_action');
    expect(candidate.excludedActionIds[3].reason).toBe('missing_column');
  });

  it('columnRefs uses ColumnRef type not string array', () => {
    const col = makeCol({ columnId: 'col:Name', name: 'Name', position: 0 });
    const candidate = makeCandidate({ columnRefs: [col] });
    expect(candidate.columnRefs[0]).toHaveProperty('columnId');
    expect(candidate.columnRefs[0]).toHaveProperty('pythonLiteral');
  });
});

describe('ScriptContractV2 (final)', () => {
  it('final contains scriptHash', () => {
    const final = makeFinal();
    expect('scriptHash' in final).toBe(true);
    expect(final.scriptHash).toBeDefined();
  });

  it('final contains validationResult', () => {
    const final = makeFinal();
    expect('validationResult' in final).toBe(true);
    expect(final.validationResult).toBeDefined();
  });

  it('final is distinct from candidate', () => {
    const candidate = makeCandidate();
    const final = makeFinal();
    expect('scriptHash' in candidate).toBe(false);
    expect('scriptHash' in final).toBe(true);
    expect('validationResult' in candidate).toBe(false);
    expect('validationResult' in final).toBe(true);
  });
});

describe('ScriptValidationResultV2', () => {
  it('has pythonSyntax with state passed', () => {
    const result = makeValidationResult({
      pythonSyntax: { state: 'passed' },
    });
    expect(result.pythonSyntax.state).toBe('passed');
  });

  it('has pythonSyntax with state failed', () => {
    const result = makeValidationResult({
      pythonSyntax: { state: 'failed', message: 'SyntaxError' },
    });
    expect(result.pythonSyntax.state).toBe('failed');
  });

  it('has pythonSyntax with state not_run', () => {
    const result = makeValidationResult({
      pythonSyntax: { state: 'not_run' },
    });
    expect(result.pythonSyntax.state).toBe('not_run');
  });

  it('has engine field', () => {
    const result = makeValidationResult({
      pythonSyntax: { state: 'passed', engine: 'python3' },
    });
    expect(result.pythonSyntax.engine).toBe('python3');
  });

  it('has optional message field', () => {
    const result = makeValidationResult({
      pythonSyntax: { state: 'failed', message: 'SyntaxError at line 1' },
    });
    expect(result.pythonSyntax.message).toBe('SyntaxError at line 1');
  });

  it('extends ValidationResultV2 shape', () => {
    const result = makeValidationResult();
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

describe('ScriptExclusionReasonV2 reasons', () => {
  it('pending reason is valid', () => {
    const excluded: ScriptExcludedActionV2 = { actionId: 'act:1', reason: 'pending' };
    expect(excluded.reason).toBe('pending');
  });

  it('ambiguous_column reason is valid', () => {
    const excluded: ScriptExcludedActionV2 = { actionId: 'act:2', reason: 'ambiguous_column' };
    expect(excluded.reason).toBe('ambiguous_column');
  });

  it('missing_column reason is valid', () => {
    const excluded: ScriptExcludedActionV2 = { actionId: 'act:3', reason: 'missing_column' };
    expect(excluded.reason).toBe('missing_column');
  });

  it('unsupported_action reason is valid', () => {
    const excluded: ScriptExcludedActionV2 = { actionId: 'act:4', reason: 'unsupported_action' };
    expect(excluded.reason).toBe('unsupported_action');
  });
});
