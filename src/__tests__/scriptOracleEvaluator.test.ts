import { describe, expect, it } from 'vitest';
import {
  evaluateScriptOracle,
  type RemediationOracleV1,
} from '../services/benchmark/scriptOracleEvaluator';

const oracle: RemediationOracleV1 = {
  links: [
    {
      diagnosticKey: 'rule:trim-whitespace|full_name|column',
      expectedActions: ['trim_whitespace'],
      allowedActions: ['trim_whitespace', 'requires_human_review'],
      forbiddenActions: ['drop_row', 'silent_drop_column'],
    },
    {
      diagnosticKey: 'rule:null-values|email|column',
      expectedActions: ['requires_human_review'],
      allowedActions: ['requires_human_review'],
      forbiddenActions: ['auto_fill_constant', 'drop_row'],
    },
  ],
};

const safeScript = [
  'import pandas as pd',
  'def clean_dataset(df):',
  "    result = df.copy()",
  "    result['full_name'] = result['full_name'].str.strip()",
  '    return result',
].join('\n');

describe('evaluateScriptOracle', () => {
  it('accepts a valid, safe script that covers the oracle actions', () => {
    const result = evaluateScriptOracle({
      oracle,
      scriptText: safeScript,
      contractValid: true,
      syntaxValid: true,
      knownColumns: ['full_name', 'email'],
      referencedColumns: ['full_name'],
      actions: [
        { diagnosticKey: 'rule:trim-whitespace|full_name|column', actionType: 'trim_whitespace' },
        { diagnosticKey: 'rule:null-values|email|column', actionType: 'requires_human_review' },
      ],
    });

    expect(result).toMatchObject({
      contractValid: true,
      syntaxValid: true,
      safe: true,
      invalidColumns: [],
      dangerousImports: [],
      missingActions: [],
      unsupportedActions: [],
      coverage: 1,
      eligibleForHumanReview: true,
    });
    expect(result.coveredActions).toHaveLength(2);
  });

  it('rejects invented columns and dangerous imports', () => {
    const result = evaluateScriptOracle({
      oracle,
      scriptText: `${safeScript}\nimport os\nos.remove('/tmp/data.csv')`,
      contractValid: true,
      syntaxValid: true,
      knownColumns: ['full_name', 'email'],
      referencedColumns: ['full_name', 'phantom'],
      actions: [],
    });

    expect(result.safe).toBe(false);
    expect(result.invalidColumns).toEqual(['phantom']);
    expect(result.dangerousImports).toEqual(['os']);
    expect(result.dangerousOperations).toContain('filesystem');
  });

  it('keeps missing and unsupported remediation actions separate', () => {
    const result = evaluateScriptOracle({
      oracle,
      scriptText: safeScript,
      contractValid: true,
      syntaxValid: true,
      knownColumns: ['full_name', 'email'],
      referencedColumns: ['full_name'],
      actions: [
        { diagnosticKey: 'rule:trim-whitespace|full_name|column', actionType: 'drop_row' },
        { diagnosticKey: 'rule:ghost|email|column', actionType: 'replace_value' },
      ],
    });

    expect(result.coveredActions).toEqual([]);
    expect(result.missingActions).toHaveLength(2);
    expect(result.unsupportedActions).toEqual([
      'rule:ghost|email|column=>replace_value',
      'rule:trim-whitespace|full_name|column=>drop_row',
    ]);
    expect(result.safe).toBe(false);
    expect(result.eligibleForHumanReview).toBe(false);
  });

  it('requires the clean_dataset entrypoint and a passed syntax gate', () => {
    const result = evaluateScriptOracle({
      oracle: { links: [] },
      scriptText: 'import pandas as pd\ndef transform(df):\n    return df',
      contractValid: true,
      syntaxValid: true,
      knownColumns: [],
      referencedColumns: [],
      actions: [],
    });

    expect(result.syntaxValid).toBe(false);
    expect(result.eligibleForHumanReview).toBe(false);
  });
});
