/**
 * Contracts v2 Baseline Evaluator Tests — Fase 0D
 *
 * These tests import REAL functions from the evaluator module.
 * No reimplementation of logic — tests verify behavior of actual code.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import REAL functions from the evaluator module
import {
  extractActionsAST,
  classifyAction
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
  hasDfCleanCopy,
  hasReturnDfClean,
  hasCleanDatasetDef
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

const FIXTURES_DIR = path.join(__dirname, '../../experiments/contracts-v2/fixtures');

const groundTruth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-ground-truth.json'), 'utf-8'));
const auditReport = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'titanic-audit-report.json'), 'utf-8'));

// ============================================================
// AST Extractor Tests
// ============================================================
describe('extractActionsAST (real)', () => {
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

  it('detects method calls chained on columns', () => {
    const script = `df['Name'].str.strip()`;
    const result = extractActionsAST(script);
    const stripActions = result.actions.filter(a => a.method === 'strip');
    expect(stripActions.length).toBeGreaterThan(0);
    expect(stripActions[0].column).toBe('Name');
  });

  it('handles empty script', () => {
    const result = extractActionsAST('');
    expect(result.valid).toBe(false);
  });

  it('handles syntactically invalid Python', () => {
    const result = extractActionsAST('def clean_dataset(df:\n    pass'); // missing closing paren
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('reports which fallback was used', () => {
    const script = `df['Name'].str.strip()`;
    const result = extractActionsAST(script);
    expect(['python_ast', 'regex']).toContain(result.fallback);
  });
});

// ============================================================
// classifyAction Tests
// ============================================================
describe('classifyAction (real)', () => {
  it('classifies strip as trim_whitespace (safe)', () => {
    const result = classifyAction({ method: 'strip' });
    expect(result.kind).toBe('trim_whitespace');
    expect(result.safe).toBe(true);
  });

  it('classifies dropna as unsafe', () => {
    const result = classifyAction({ method: 'dropna' });
    expect(result.safe).toBe(false);
  });

  it('classifies drop as unsafe', () => {
    const result = classifyAction({ method: 'drop' });
    expect(result.safe).toBe(false);
  });

  it('classifies fillna as unsafe (imputation)', () => {
    const result = classifyAction({ method: 'fillna' });
    expect(result.safe).toBe(false);
  });

  it('returns null safe for unknown methods', () => {
    const result = classifyAction({ method: 'some_unknown_method' });
    expect(result.safe).toBe(null);
  });
});

// ============================================================
// Citation Evaluator Tests
// ============================================================
describe('evaluateCitationsExact (real)', () => {
  it('detects exact match without any normalization', () => {
    const sample = "Futrelle, Mrs. Jacques Heath (Lily May Peel)";
    const result = evaluateCitationsExact(`Citation: ${sample} was found.`, [{ value: sample, issueId: 'test', column: null }]);
    expect(result.exactCount).toBe(1);
    expect(result.alteredCount).toBe(0);
  });

  it('respects trailing spaces exactly', () => {
    const sampleWithSpace = "Hewlett, Mrs. (Mary D Kingcome) "; // has trailing space
    const result = evaluateCitationsExact(`Citation: ${sampleWithSpace} found`, [
      { value: sampleWithSpace, issueId: 'ghost', column: 'Name' }
    ]);
    expect(result.exactCount).toBe(1);
  });

  it('does NOT match if trailing space is removed', () => {
    const exact = "Hewlett, Mrs. (Mary D Kingcome) "; // with trailing space
    const response = "Hewlett, Mrs. (Mary D Kingcome)"; // without trailing space
    const result = evaluateCitationsExact(response, [
      { value: exact, issueId: 'ghost', column: 'Name' }
    ]);
    expect(result.exactCount).toBe(0);
    // The trim version should be detected as altered
    expect(result.alteredCount).toBe(1);
  });

  it('does NOT normalize case', () => {
    const sample = "BRAUND, MR. OWEN HARRIS";
    const response = "braund, mr. owen harris"; // different case
    const result = evaluateCitationsExact(response, [
      { value: sample, issueId: 'test', column: null }
    ]);
    // Case mismatch should not count as exact
    expect(result.exactCount).toBe(0);
  });

  it('does NOT collapse internal whitespace', () => {
    const sample = "Braund, Mr. Owen Harris";
    const response = "Braund, Mr.  Owen Harris"; // double space
    const result = evaluateCitationsExact(response, [
      { value: sample, issueId: 'test', column: null }
    ]);
    expect(result.exactCount).toBe(0);
  });

  it('eligibleCount matches the input array length', () => {
    const samples = [
      { value: "a", issueId: 'i1', column: null },
      { value: "bc", issueId: 'i2', column: null },
      { value: "def", issueId: 'i3', column: null }
    ];
    const result = evaluateCitationsExact("a bc def", samples);
    expect(result.eligibleCount).toBe(3);
  });

  it('handles empty eligible samples', () => {
    const result = evaluateCitationsExact("text", []);
    expect(result.eligibleCount).toBe(0);
    expect(result.exactRate).toBe(0);
  });

  it('detects altered form "Lily Peel" vs exact "Lily May Peel"', () => {
    const exact = "Futrelle, Mrs. Jacques Heath (Lily May Peel)";
    const altered = "Futrelle, Mrs. Jacques Heath (Lily Peel)";
    const result = evaluateCitationsExact(`Citation: ${altered} was found.`, [
      { value: exact, issueId: 'test', column: 'Name' }
    ]);
    expect(result.exactCount).toBe(0);
    expect(result.alteredCount).toBe(1);
  });
});

describe('loadEligibleSamples (real)', () => {
  it('loads only string samples with length >= 4 from audit report', () => {
    const samples = loadEligibleSamples();
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      expect(typeof s.value).toBe('string');
      expect(s.value.length).toBeGreaterThanOrEqual(4);
      expect(s.issueId).toBeTruthy();
    }
  });

  it('includes samples from ghost spaces issue', () => {
    const samples = loadEligibleSamples();
    const ghostSamples = samples.filter(s => s.issueId === 'hygiene-ghost-Name');
    expect(ghostSamples.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Invented Rules Detector Tests
// ============================================================
describe('detectInventedRulesStructured (real)', () => {
  const actualRules = ['Valores Nulos / Vacios', 'Espacios Fantasma (Trim)', 'Outliers Extremos (IQR 3x)'];

  it('detects rules from # AURA: regla= comments', () => {
    const text = `# AURA: regla=trim_whitespace columna=Name
# AURA: regla=invented_rule columna=Age`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.invented).toContain('invented_rule');
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

  it('matches actual rules correctly', () => {
    const text = `# AURA: regla=Espacios Fantasma (Trim) columna=Name`;
    const result = detectInventedRulesStructured(text, actualRules);
    expect(result.invented).toHaveLength(0);
    expect(result.actual.length).toBeGreaterThan(0);
  });

  it('handles text with no rules', () => {
    const result = detectInventedRulesStructured('Just some text without rules.', actualRules);
    expect(result.invented).toHaveLength(0);
    expect(result.actual).toHaveLength(0);
  });

  it('handles empty actual rules list', () => {
    const result = detectInventedRulesStructured('# AURA: regla=anything', []);
    expect(result.invented).toContain('anything');
  });

  it('loadActualRules returns from audit report', () => {
    const rules = loadActualRules();
    expect(rules).toContain('Espacios Fantasma (Trim)');
    expect(rules.length).toBeGreaterThan(5);
  });
});

// ============================================================
// Python Validator Tests
// ============================================================
describe('validatePythonSyntax (real)', () => {
  it('validates correct Python syntax', () => {
    const result = validatePythonSyntax('x = 1\nprint(x)');
    expect(result.syntaxValid).toBe(true);
  });

  it('rejects syntax errors', () => {
    const result = validatePythonSyntax('def foo(:\n    pass');
    expect(result.syntaxValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles empty script', () => {
    const result = validatePythonSyntax('');
    expect(result.syntaxValid).toBe(false);
  });
});

describe('validateScriptStructure (real)', () => {
  const validScript = `import pandas as pd

def clean_dataset(df):
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    return df_clean`;

  it('validates a structurally correct script', () => {
    const result = validateScriptStructure(validScript);
    expect(result.syntaxValid).toBe(true);
    expect(result.hasDfCleanCopy).toBe(true);
    expect(result.hasReturnDfClean).toBe(true);
    expect(result.hasCleanDatasetDef).toBe(true);
    expect(result.structurallyValid).toBe(true);
  });

  it('rejects script without df_clean = df.copy()', () => {
    const badScript = `def clean_dataset(df):
    return df`;
    const result = validateScriptStructure(badScript);
    expect(result.hasDfCleanCopy).toBe(false);
    expect(result.structurallyValid).toBe(false);
  });

  it('rejects script without return df_clean', () => {
    const badScript = `def clean_dataset(df):
    df_clean = df.copy()
    return df`;
    const result = validateScriptStructure(badScript);
    expect(result.hasReturnDfClean).toBe(false);
    expect(result.structurallyValid).toBe(false);
  });

  it('rejects script without def clean_dataset', () => {
    const badScript = `def process(df):
    return df`;
    const result = validateScriptStructure(badScript);
    expect(result.hasCleanDatasetDef).toBe(false);
    expect(result.structurallyValid).toBe(false);
  });
});

describe('hasDfCleanCopy (real)', () => {
  it('detects correct pattern', () => {
    expect(hasDfCleanCopy('df_clean = df.copy()')).toBe(true);
  });

  it('rejects with whitespace variations only', () => {
    expect(hasDfCleanCopy('df_clean=df.copy()')).toBe(true);
    expect(hasDfCleanCopy('df_clean  =  df.copy()')).toBe(true);
  });

  it('rejects missing copy', () => {
    expect(hasDfCleanCopy('df_clean = df')).toBe(false);
  });

  it('rejects wrong variable names', () => {
    expect(hasDfCleanCopy('df_result = df.copy()')).toBe(false);
  });
});

describe('hasReturnDfClean (real)', () => {
  it('detects return df_clean', () => {
    expect(hasReturnDfClean('return df_clean')).toBe(true);
  });

  it('detects with whitespace', () => {
    expect(hasReturnDfClean('  return  df_clean  ')).toBe(true);
  });

  it('rejects return df', () => {
    expect(hasReturnDfClean('return df')).toBe(false);
  });
});

// ============================================================
// Phantom Column Detector Tests
// ============================================================
describe('detectPhantomColumns (real)', () => {
  it('does not flag valid columns', () => {
    const ast = { columns: ['Name', 'Age', 'Fare'] };
    const result = detectPhantomColumns(ast, auditReport);
    expect(result.phantoms).toHaveLength(0);
    expect(result.valid).toContain('Name');
    expect(result.valid).toContain('Age');
  });

  it('detects unknown columns as phantoms', () => {
    const ast = { columns: ['UnknownColumn', 'AnotherPhantom'] };
    const result = detectPhantomColumns(ast, auditReport);
    expect(result.phantoms).toContain('UnknownColumn');
    expect(result.phantoms).toContain('AnotherPhantom');
  });

  it('handles empty columns array', () => {
    const ast = { columns: [] };
    const result = detectPhantomColumns(ast, auditReport);
    expect(result.phantoms).toHaveLength(0);
    expect(result.valid).toHaveLength(0);
  });
});

// ============================================================
// Review Retention Evaluator Tests
// ============================================================
describe('evaluateReviewRetention (real)', () => {
  const ast = { actions: [] };

  it('marks issue as omitted if not mentioned', () => {
    const diagText = 'I will analyze the data quality.';
    const review = evaluateReviewRetention(diagText, ast, groundTruth, auditReport);
    const omitted = review.perIssue.filter(i => i.status === 'omitted');
    expect(omitted.length).toBeGreaterThan(0);
  });

  it('marks as correctly_retained when mentioned with review marker', () => {
    const diagText = 'Valores Nulos / Vacios en Age — requiere revision humana antes de imputar.';
    const review = evaluateReviewRetention(diagText, ast, groundTruth, auditReport);
    const correct = review.perIssue.filter(i => i.status === 'correctly_retained');
    expect(correct.length).toBeGreaterThan(0);
  });

  it('marks as automated_incorrectly when unsafe action performed', () => {
    const diagText = 'Valores Nulos / Vacios en Age — revisar e imputar.';
    const astWithUnsafe = {
      actions: [{ method: 'dropna', column: 'Age' }]
    };
    const review = evaluateReviewRetention(diagText, astWithUnsafe, groundTruth, auditReport);
    const automated = review.perIssue.find(i => i.issueId === 'integrity-null-Age');
    expect(automated?.status).toBe('automated_incorrectly');
  });

  it('marks issue as not_in_report if issueId not in audit', () => {
    const fakeGT = {
      REVIEW_ONLY: [
        { rule: 'Fake Rule', column: 'FakeCol', issueId: 'nonexistent-issue' }
      ]
    };
    const review = evaluateReviewRetention('text', ast, fakeGT, auditReport);
    expect(review.perIssue[0].status).toBe('not_in_report');
  });

  it('recall is 0 when no issues are correctly retained', () => {
    const review = evaluateReviewRetention('no relevant text', ast, groundTruth, auditReport);
    expect(recallIsZeroOrNull(review.recall)).toBe(true);
  });

  it('recall is high when all issues are correctly retained', () => {
    const allRules = groundTruth.REVIEW_ONLY.map(r => r.rule).join(' ');
    const diagText = `${allRules} — todos requieren revision humana HITL.`;
    const review = evaluateReviewRetention(diagText, ast, groundTruth, auditReport);
    expect(review.recall).toBeGreaterThan(0.5);
  });
});

function recallIsZeroOrNull(r) {
  return r === 0 || r === null;
}

// ============================================================
// Auto Actions Evaluator Tests
// ============================================================
describe('evaluateAutomaticActions (real)', () => {
  it('produces TP=1 when expected trim_whitespace is performed', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    return df_clean`;
    const result = evaluateAutomaticActions(groundTruth, script);
    expect(result.tp).toBe(1);
    expect(result.fn).toBe(0);
  });

  it('produces FN=1 when expected trim_whitespace is NOT performed', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    return df_clean`;
    const result = evaluateAutomaticActions(groundTruth, script);
    expect(result.fn).toBe(1);
    expect(result.tp).toBe(0);
  });

  it('produces FP when unsafe action is performed on review-only column', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    df_clean = df_clean.dropna()
    return df_clean`;
    const result = evaluateAutomaticActions(groundTruth, script);
    // dropna on Age/Cabin (review-only columns) counts as FP
    expect(result.fp).toBeGreaterThan(0);
  });

  it('precision is null when no predictions', () => {
    const emptyGT = { AUTOMATIZABLE: [], REVIEW_ONLY: [] };
    const result = evaluateAutomaticActions(emptyGT, 'no script');
    expect(result.precision).toBe(null);
    expect(result.recall).toBe(null);
  });
});

describe('countUnsafeActions (real)', () => {
  it('counts unsafe actions correctly', () => {
    const script = `df.dropna()
df.drop(columns=['Name'])
df['Age'].fillna(0, inplace=True)`;
    const result = countUnsafeActions(groundTruth, script);
    expect(result.unsafeActionCount).toBeGreaterThan(0);
  });

  it('returns 0 for safe script', () => {
    const script = `def clean_dataset(df):
    df_clean = df.copy()
    df_clean['Name'] = df_clean['Name'].str.strip()
    return df_clean`;
    const result = countUnsafeActions(groundTruth, script);
    expect(result.unsafeActionCount).toBe(0);
  });

  it('computes unsafeActionRate correctly', () => {
    const script = `df.dropna()`;
    const result = countUnsafeActions(groundTruth, script);
    expect(result.unsafeActionRate).toBeGreaterThan(0);
    expect(result.unsafeActionRate).toBeLessThanOrEqual(1);
  });

  it('rate is 0 when no actions proposed', () => {
    const result = countUnsafeActions(groundTruth, '');
    expect(result.unsafeActionRate).toBe(0);
  });
});

// ============================================================
// Integration: Real fixtures
// ============================================================
describe('Real fixtures consistency', () => {
  it('ground truth AUTOMATIZABLE has Ghost Spaces', () => {
    const auto = groundTruth.AUTOMATIZABLE;
    expect(auto.length).toBe(1);
    expect(auto[0].rule).toBe('Espacios Fantasma (Trim)');
    expect(auto[0].column).toBe('Name');
  });

  it('audit report has Ghost Spaces issue with count=2', () => {
    const ghost = auditReport.issues.find(i => i.id === 'hygiene-ghost-Name');
    expect(ghost).toBeDefined();
    expect(ghost.count).toBe(2);
  });

  it('every REVIEW_ONLY.issueId exists in audit report', () => {
    const ids = new Set(auditReport.issues.map(i => i.id));
    for (const r of groundTruth.REVIEW_ONLY) {
      expect(ids.has(r.issueId), `${r.issueId} should be in audit report`).toBe(true);
    }
  });

  it('ground truth has regex patterns for all FORBIDDEN actions', () => {
    for (const f of groundTruth.FORBIDDEN_AUTOMATIC) {
      expect(f.action).toBeTruthy();
      expect(f.pattern).toBeTruthy();
    }
  });
});