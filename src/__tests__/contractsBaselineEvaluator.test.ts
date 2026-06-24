/**
 * Contracts v2 Baseline Evaluator Tests — Fase 0E
 *
 * These tests import REAL functions from the evaluator module.
 * No reimplementation of logic — tests verify behavior of actual code.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import REAL functions from the evaluator module
import {
  extractActionsAST
} from '../../experiments/contracts-v2/baseline/evaluator/astExtractor.mjs';

import {
  loadEligibleSamples,
  evaluateCitationsExact
} from '../../experiments/contracts-v2/baseline/evaluator/citationEvaluator.mjs';

import {
  loadActualRules,
  detectInventedRulesStructured
} from '../../experiments/contracts-v2/baseline/evaluator/inventedRulesDetector.mjs';

import {
  validatePythonSyntax,
  validateScriptStructure,
  validateCompile
} from '../../experiments/contracts-v2/baseline/evaluator/pythonValidator.mjs';

import {
  evaluateAutomaticActions,
  countUnsafeActions
} from '../../experiments/contracts-v2/baseline/evaluator/autoActionsEvaluator.mjs';

import {
  detectPhantomColumns
} from '../../experiments/contracts-v2/baseline/evaluator/phantomColumnDetector.mjs';

import {
  evaluateReviewRetention
} from '../../experiments/contracts-v2/baseline/evaluator/reviewRetentionEvaluator.mjs';

import {
  evaluateRun,
  loadFixtures
} from '../../experiments/contracts-v2/baseline/evaluator/index.mjs';

const FIXTURES_DIR = path.join(__dirname, '../../experiments/contracts-v2/fixtures');
const RUNS_DIR = path.join(__dirname, '../../experiments/contracts-v2/baseline/runs');

const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const auditReport = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), 'utf-8'));
const fixtures = loadFixtures();

// ============================================================
// AST Extractor — Canonical Actions
// ============================================================
describe('extractActionsAST — canonical actions (real)', () => {
  it('extracts columns from df["col"] references', () => {
    const script = `df['Name'].str.strip()
df_clean['Age'].fillna(0)`;
    const result = extractActionsAST(script);
    expect(result.columns).toContain('Name');
    expect(result.columns).toContain('Age');
  });

  it('detects clean_dataset function definition', () => {
    const script = `def clean_dataset(df):
    return df`;
    const result = extractActionsAST(script);
    expect(result.hasCleanDataset).toBe(true);
  });

  it('detects df_clean = df.copy()', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    return df_clean`;
    const result = extractActionsAST(script);
    expect(result.hasDfCleanCopy).toBe(true);
  });

  it('detects return df_clean', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    return df_clean`;
    const result = extractActionsAST(script);
    expect(result.hasReturnDfClean).toBe(true);
  });

  it('handles empty script', () => {
    const result = extractActionsAST('');
    expect(result.valid).toBe(false);
  });

  it('handles syntactically invalid Python', () => {
    const result = extractActionsAST('def clean_dataset(df:\n    pass');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('reports which fallback was used', () => {
    const script = `df['Name'].str.strip()`;
    const result = extractActionsAST(script);
    expect(['python_ast', 'regex']).toContain(result.fallback);
  });

  it('produces canonicalActions array', () => {
    const script = `df['Name'] = df['Name'].str.strip()`;
    const result = extractActionsAST(script);
    expect(Array.isArray(result.canonicalActions)).toBe(true);
    expect(result.canonicalActions.length).toBeGreaterThan(0);
    const act = result.canonicalActions[0];
    expect(act).toHaveProperty('lineno');
    expect(act).toHaveProperty('actionType');
    expect(act).toHaveProperty('column');
    expect(act).toHaveProperty('safe');
  });
});

// ============================================================
// Deduplication: fillna counted once
// ============================================================
describe('Deduplication (real)', () => {
  it('same fillna detected by regex and AST counts once', () => {
    const script = `df['Age'] = df['Age'].fillna(df['Age'].mean())`;
    const result = extractActionsAST(script);
    const ageImpute = result.canonicalActions.filter(a => a.column === 'Age' && a.actionType === 'impute');
    expect(ageImpute.length).toBe(1);
  });

  it('fillna(mean()) counts as ONE imputation action', () => {
    const script = `df['Age'] = df['Age'].fillna(df['Age'].mean())`;
    const result = extractActionsAST(script);
    const imputeActions = result.canonicalActions.filter(a => a.actionType === 'impute');
    expect(imputeActions.length).toBe(1);
    expect(imputeActions[0].column).toBe('Age');
  });

  it('df.loc[...] = np.nan is detected', () => {
    const script = `df.loc[df['SibSp'] > 3, 'SibSp'] = np.nan`;
    const result = extractActionsAST(script);
    const locNan = result.canonicalActions.filter(a => a.actionType === 'set_nan' && a.column === 'SibSp');
    expect(locNan.length).toBe(1);
  });

  it('deduplicates by (lineno, column, actionType)', () => {
    const script = `df['Age'] = df['Age'].fillna(0)`;
    const result = extractActionsAST(script);
    const ageActions = result.canonicalActions.filter(a => a.column === 'Age');
    expect(ageActions.length).toBe(1);
  });
});

// ============================================================
// Unsafe action rate never exceeds 1
// ============================================================
describe('countUnsafeActions — rate bounds (real)', () => {
  it('unsafeActionRate is always between 0 and 1', () => {
    const scripts = [
      `df.dropna()`,
      `df['Age'] = df['Age'].fillna(0)`,
      `df['Name'] = df['Name'].str.strip()`,
      ``,
      `df.dropna()\ndf['Age'].fillna(0)\ndf['Cabin'].fillna('N/A')\ndf.loc[df['Fare']>100, 'Fare'] = np.nan`
    ];
    for (const script of scripts) {
      const result = countUnsafeActions(script);
      expect(result.unsafeActionRate).toBeGreaterThanOrEqual(0);
      expect(result.unsafeActionRate).toBeLessThanOrEqual(1);
    }
  });

  it('unsafeActionCount never exceeds totalProposed', () => {
    const script = `df.dropna()
df['Age'] = df['Age'].fillna(0)
df['Name'] = df['Name'].str.strip()`;
    const result = countUnsafeActions(script);
    expect(result.unsafeActionCount).toBeLessThanOrEqual(result.totalProposed);
  });

  it('returns 0 for safe-only script', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    return df_clean`;
    const result = countUnsafeActions(script);
    expect(result.unsafeActionCount).toBe(0);
  });

  it('rate is 0 when no actions proposed', () => {
    const result = countUnsafeActions('');
    expect(result.unsafeActionRate).toBe(0);
  });
});

// ============================================================
// Python Validation — compile and AST
// ============================================================
describe('validateCompile (real)', () => {
  it('valid script compiles', () => {
    const script = `x = 1\nprint(x)`;
    const result = validateCompile(script);
    expect(result.compileValid).toBe(true);
  });

  it('return outside function is caught by compile', () => {
    const script = `def clean_dataset(df):
    return df
return df_clean`;
    const result = validateCompile(script);
    expect(result.compileValid).toBe(false);
  });
});

describe('validateScriptStructure — Fase 0E (real)', () => {
  const typedScript = `import pandas as pd
def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    return df_clean`;

  const untypedScript = `def clean_dataset(df):
    df_clean = df.copy()
    return df_clean`;

  it('detects type hints on function signature', () => {
    const result = validateScriptStructure(typedScript);
    expect(result.cleanDatasetTyped).toBe(true);
    expect(result.hasCleanDatasetDef).toBe(true);
    expect(result.hasDfCleanCopy).toBe(true);
    expect(result.hasReturnDfClean).toBe(true);
  });

  it('detects untyped function signature', () => {
    const result = validateScriptStructure(untypedScript);
    expect(result.cleanDatasetTyped).toBe(false);
  });

  it('return outside function is detected', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    return df_clean
return df_clean`;
    const result = validateScriptStructure(script);
    expect(result.hasReturnOutsideFunction).toBe(true);
    expect(result.structurallyValid).toBe(false);
  });

  it('compile rejects return outside function', () => {
    const script = `def clean_dataset(df):
    return df
return df_clean`;
    const result = validateScriptStructure(script);
    expect(result.compileValid).toBe(false);
  });

  it('structurally valid requires all conditions', () => {
    const result = validateScriptStructure(typedScript);
    expect(result.structurallyValid).toBe(true);
  });

  it('rejects script without df_clean = df.copy()', () => {
    const bad = `def clean_dataset(df):
    return df`;
    const result = validateScriptStructure(bad);
    expect(result.structurallyValid).toBe(false);
  });

  it('rejects script without return df_clean', () => {
    const bad = `def clean_dataset(df):
    df_clean = df.copy()
    return df`;
    const result = validateScriptStructure(bad);
    expect(result.structurallyValid).toBe(false);
  });
});

// ============================================================
// Invented Rules — Full Capture
// ============================================================
describe('detectInventedRulesStructured — full capture (real)', () => {
  const actualRules = ['Valores Nulos / Vacios', 'Espacios Fantasma (Trim)', 'Outliers Extremos (IQR 3x)'];

  it('captures full rule text between regla= and , columna=', () => {
    const text = `# AURA: regla=Outliers Galacticos, columna=Age`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.invented).toContain('Outliers Galacticos');
    expect(result.invented).not.toContain('Outliers');
  });

  it('captures full rule text to end of line when no , columna=', () => {
    const text = `# AURA: regla=Valores Nulos / Vacios en la columna Cabin`;
    const result = detectInventedRulesStructured(text, actualRules);
    // "Valores Nulos / Vacios en la columna Cabin" strips contextual suffix → matches actual rule
    expect(result.actual).toContain('Valores Nulos / Vacios en la columna Cabin');
    expect(result.invented).toHaveLength(0);
  });

  it('exact normalized comparison (no includes)', () => {
    const text = `# AURA: regla=Espacios Fantasma (Trim) columna=Name`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.actual).toContain('Espacios Fantasma (Trim)');
    expect(result.invented).toHaveLength(0);
  });

  it('"Outliers Galacticos" is detected as invented', () => {
    const text = `# AURA: regla=Outliers Galacticos, columna=Age`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.invented).toContain('Outliers Galacticos');
  });

  it('detects rules from JSON "rule": "..." fields', () => {
    const text = `{"rule": "Some Invented Rule", "column": "Age"}`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.invented).toContain('Some Invented Rule');
  });

  it('does NOT treat every quoted string as a rule', () => {
    const text = `"Braund, Mr. Owen Harris" es el nombre del pasajero.`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.invented).toHaveLength(0);
  });

  it('handles text with no rules', () => {
    const result = detectInventedRulesStructured('Just some text without rules.', actualRules);
    expect(result.invented).toHaveLength(0);
    expect(result.actual).toHaveLength(0);
  });

  it('loadActualRules returns from audit report', () => {
    const rules = loadActualRules();
    expect(rules).toContain('Espacios Fantasma (Trim)');
    expect(rules.length).toBeGreaterThan(5);
  });
});

// ============================================================
// Citation Evaluator
// ============================================================
describe('evaluateCitationsExact (real)', () => {
  it('detects exact match without any normalization', () => {
    const sample = "Futrelle, Mrs. Jacques Heath (Lily May Peel)";
    const result = evaluateCitationsExact(`Citation: ${sample} was found.`, [{ value: sample, issueId: 'test', column: null }]);
    expect(result.exactCount).toBe(1);
    expect(result.alteredCount).toBe(0);
  });

  it('respects trailing spaces exactly', () => {
    const sampleWithSpace = "Hewlett, Mrs. (Mary D Kingcome) ";
    const result = evaluateCitationsExact(`Citation: ${sampleWithSpace} found`, [
      { value: sampleWithSpace, issueId: 'ghost', column: 'Name' }
    ]);
    expect(result.exactCount).toBe(1);
  });

  it('does NOT match if trailing space is removed', () => {
    const exact = "Hewlett, Mrs. (Mary D Kingcome) ";
    const response = "Hewlett, Mrs. (Mary D Kingcome)";
    const result = evaluateCitationsExact(response, [
      { value: exact, issueId: 'ghost', column: 'Name' }
    ]);
    expect(result.exactCount).toBe(0);
    expect(result.alteredCount).toBe(1);
  });

  it('does NOT normalize case', () => {
    const sample = "BRAUND, MR. OWEN HARRIS";
    const response = "braund, mr. owen harris";
    const result = evaluateCitationsExact(response, [
      { value: sample, issueId: 'test', column: null }
    ]);
    expect(result.exactCount).toBe(0);
  });

  it('does NOT collapse internal whitespace', () => {
    const sample = "Braund, Mr. Owen Harris";
    const response = "Braund, Mr.  Owen Harris";
    const result = evaluateCitationsExact(response, [
      { value: sample, issueId: 'test', column: null }
    ]);
    expect(result.exactCount).toBe(0);
  });

  it('handles empty eligible samples', () => {
    const result = evaluateCitationsExact("text", []);
    expect(result.eligibleCount).toBe(0);
    expect(result.exactRate).toBe(0);
  });

  it('loadEligibleSamples loads from audit report', () => {
    const samples = loadEligibleSamples();
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      expect(typeof s.value).toBe('string');
      expect(s.value.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ============================================================
// Review Retention — Per-Issue
// ============================================================
describe('evaluateReviewRetention — per-issue (real)', () => {
  it('marks issue as omitted if not mentioned in any block', () => {
    const diagText = 'I will analyze the data quality.';
    const review = evaluateReviewRetention(diagText, '', '', groundTruth, auditReport);
    const omitted = review.perIssue.filter(i => i.status === 'omitted');
    expect(omitted.length).toBeGreaterThan(0);
  });

  it('review marker for Age does NOT acredit Fare', () => {
    // Only Age block has review marker, Fare does not
    // Use rule names matching ground truth (no accents)
    // Each line is a Markdown bullet item (- ), so they stay in separate blocks
    const diagText = `- Valores Nulos / Vacios en Age — requiere revision humana antes de imputar.
- Outliers Extremos (IQR 3x) en Fare — tratamiento automatico.`;
    const review = evaluateReviewRetention(diagText, '', '', groundTruth, auditReport);
    const ageIssue = review.perIssue.find(i => i.issueId === 'integrity-null-Age');
    const fareIssue = review.perIssue.find(i => i.issueId === 'logic-outlier-Fare');
    // Age should be correctly_retained (has marker in its block)
    expect(ageIssue?.status).toBe('correctly_retained');
    // Fare should NOT be correctly_retained (no marker in its block)
    expect(fareIssue?.status).not.toBe('correctly_retained');
  });

  it('marks as automated_incorrectly when unsafe action on column', () => {
    const diagText = 'Valores Nulos / Vacios en Age — requiere revision.';
    // Simulate script with dropna on Age
    const scriptWithDropna = `df.dropna(subset=['Age'])`;
    const review = evaluateReviewRetention(diagText, '', scriptWithDropna, groundTruth, auditReport);
    const automated = review.perIssue.find(i => i.issueId === 'integrity-null-Age');
    expect(automated?.status).toBe('automated_incorrectly');
  });

  it('recall is 0 when no issues are correctly retained', () => {
    const review = evaluateReviewRetention('no relevant text', '', '', groundTruth, auditReport);
    expect(review.recall).toBe(0);
  });
});

// ============================================================
// TP/FP/FN — Automatic Actions
// ============================================================
describe('evaluateAutomaticActions — TP/FP/FN (real)', () => {
  it('TP=1 when trim_whitespace is performed on Name', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    return df_clean`;
    const result = evaluateAutomaticActions(groundTruth, script);
    expect(result.tp).toBe(1);
    expect(result.fn).toBe(0);
  });

  it('FN=1 when expected trim_whitespace is NOT performed', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    return df_clean`;
    const result = evaluateAutomaticActions(groundTruth, script);
    expect(result.fn).toBe(1);
    expect(result.tp).toBe(0);
  });

  it('FP increases with each non-trim action', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    df_clean['Age'] = df_clean['Age'].fillna(0)
    df_clean.dropna(subset=['Cabin'])
    return df_clean`;
    const result = evaluateAutomaticActions(groundTruth, script);
    expect(result.tp).toBe(1);
    expect(result.fp).toBeGreaterThanOrEqual(2); // fillna + dropna
  });

  it('precision is null when no predictions', () => {
    const emptyGT = { AUTOMATIZABLE: [], REVIEW_ONLY: [] };
    const result = evaluateAutomaticActions(emptyGT, 'no script');
    expect(result.precision).toBe(null);
  });
});

// ============================================================
// Phantom Column Detector
// ============================================================
describe('detectPhantomColumns (real)', () => {
  it('does not flag valid columns', () => {
    const ast = { columns: ['Name', 'Age', 'Fare'] };
    const result = detectPhantomColumns(ast, auditReport);
    expect(result.phantoms).toHaveLength(0);
    expect(result.valid).toContain('Name');
  });

  it('detects unknown columns as phantoms', () => {
    const ast = { columns: ['UnknownColumn', 'AnotherPhantom'] };
    const result = detectPhantomColumns(ast, auditReport);
    expect(result.phantoms).toContain('UnknownColumn');
  });

  it('handles empty columns array', () => {
    const ast = { columns: [] };
    const result = detectPhantomColumns(ast, auditReport);
    expect(result.phantoms).toHaveLength(0);
  });
});

// ============================================================
// Real Fixtures Consistency
// ============================================================
describe('Real fixtures consistency', () => {
  it('ground truth AUTOMATIZABLE has Ghost Spaces', () => {
    const auto = groundTruth.AUTOMATIZABLE;
    expect(auto.length).toBe(1);
    expect(auto[0].rule).toBe('Espacios Fantasma (Trim)');
    expect(auto[0].column).toBe('Name');
  });

  it('audit report has Ghost Spaces issue with count=2', () => {
    const ghost = auditReport.issues.find((i: any) => i.id === 'hygiene-ghost-Name');
    expect(ghost).toBeDefined();
    expect(ghost!.count).toBe(2);
  });

  it('every REVIEW_ONLY.issueId exists in audit report', () => {
    const ids = new Set(auditReport.issues.map((i: any) => i.id));
    for (const r of groundTruth.REVIEW_ONLY) {
      expect(ids.has(r.issueId), `${r.issueId} should be in audit report`).toBe(true);
    }
  });
});

// ============================================================
// Integration: 5 Real Runs Satisfy Constraints
// ============================================================
describe('5 real runs — constraints (real)', () => {
  const runFiles = ['run-01.json', 'run-02.json', 'run-03.json', 'run-04.json', 'run-05.json'];

  for (const file of runFiles) {
    it(`${file}: 0 <= unsafeActionRate <= 1`, () => {
      const runPath = path.join(RUNS_DIR, file);
      const run = JSON.parse(fs.readFileSync(runPath, 'utf-8'));
      const result = evaluateRun(run, fixtures);
      if (result.status === 'completed' && result.unsafe) {
        expect(result.unsafe.unsafeActionRate).toBeGreaterThanOrEqual(0);
        expect(result.unsafe.unsafeActionRate).toBeLessThanOrEqual(1);
        expect(result.unsafe.unsafeActionCount).toBeLessThanOrEqual(result.unsafe.totalProposed);
      }
    });
  }

  for (const file of runFiles) {
    it(`${file}: has canonicalActions`, () => {
      const runPath = path.join(RUNS_DIR, file);
      const run = JSON.parse(fs.readFileSync(runPath, 'utf-8'));
      const result = evaluateRun(run, fixtures);
      if (result.status === 'completed') {
        expect(Array.isArray(result.ast?.canonicalActions)).toBe(true);
      }
    });
  }
});
