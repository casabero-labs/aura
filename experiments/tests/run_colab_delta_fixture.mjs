#!/usr/bin/env node
/**
 * AURA — External Python Execution Delta Validator
 *
 * Runs the controlled Python clean script against the semantic fixture,
 * re-audits both original and corrected datasets with AURA's runAudit
 * (invoked via tsx from src/services/auditEngine.ts), and produces a
 * delta comparison JSON artifact.
 *
 * Usage: node experiments/tests/run_colab_delta_fixture.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC_DIR = resolve(REPO_ROOT, 'src');

const FIXTURE_CSV = resolve(REPO_ROOT, 'experiments/tests/fixtures/incidentes_semantic_sample.csv');
const CLEAN_SCRIPT = resolve(REPO_ROOT, 'experiments/tests/fixtures/incidentes_clean_script.py');
const RESULTS_DIR = resolve(REPO_ROOT, 'experiments/tests/results');
const OUTPUT_JSON = resolve(RESULTS_DIR, 'incidentes_colab_delta_fixture.json');
const CORRECTED_CSV = resolve(RESULTS_DIR, 'incidentes_corrected.csv');
const PY_WRAPPER = resolve(RESULTS_DIR, '_run_clean.py');

function runAuditViaTsx(csvPath) {
  const result = execSync(
    `npx tsx ../experiments/tests/run_audit_wrapper.ts "${csvPath}"`,
    {
      encoding: 'utf-8',
      timeout: 60000,
      cwd: SRC_DIR,
    }
  );
  return JSON.parse(result);
}

console.log('=== AURA Colab Delta Fixture Runner ===\n');

console.log(`Fixture: ${FIXTURE_CSV}`);

const wrapperScript = `
import sys
sys.path.insert(0, '${resolve(REPO_ROOT, 'experiments/tests/fixtures')}')
from incidentes_clean_script import clean_dataset
import pandas as pd

df = pd.read_csv('${FIXTURE_CSV}')
result = clean_dataset(df)
result.to_csv('${CORRECTED_CSV}', index=False)

print(f'CORRECTED_ROWS={len(result)}')
print(f'CORRECTED_COLS={len(result.columns)}')
corrupted = int(result['crimeid_corrupted'].sum()) if 'crimeid_corrupted' in result.columns else 0
print(f'CONTAMINATED_FLAGGED={corrupted}')
`;
writeFileSync(PY_WRAPPER, wrapperScript);

console.log(`\nExecuting Python clean script...`);
let pythonOutput;
try {
  pythonOutput = execSync(`python3 "${PY_WRAPPER}"`, {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: REPO_ROOT,
  });
  console.log('  ' + pythonOutput.trim().replace(/\n/g, '\n  '));
} catch (err) {
  console.error('  ERROR:', err.message);
  if (err.stderr) console.error('  stderr:', err.stderr.toString());
  process.exit(1);
}

console.log(`\nRe-auditing with AURA runAudit (via tsx)...`);
const beforeReport = runAuditViaTsx(FIXTURE_CSV);
console.log(`  Before: score=${beforeReport.score}, issues=${beforeReport.issues.length}`);

const afterReport = runAuditViaTsx(CORRECTED_CSV);
console.log(`  After:  score=${afterReport.score}, issues=${afterReport.issues.length}`);

const beforeRuleNames = new Set(beforeReport.issues.map(i => i.ruleName));
const afterRuleNames = new Set(afterReport.issues.map(i => i.ruleName));
const correctedRules = [...beforeRuleNames].filter(r => !afterRuleNames.has(r));
const unchangedRules = [...beforeRuleNames].filter(r => afterRuleNames.has(r));
const newRules = [...afterRuleNames].filter(r => !beforeRuleNames.has(r));

const beforeCritical = beforeReport.issues.filter(i => i.severity === 'critical').length;
const afterCritical = afterReport.issues.filter(i => i.severity === 'critical').length;
const scoreDelta = afterReport.score - beforeReport.score;
const criticalDelta = afterCritical - beforeCritical;

const remediationClassification =
  scoreDelta > 0 && criticalDelta <= 0
    ? 'improvement'
    : 'source_debt_preserved';

const delta = {
  generatedAt: new Date().toISOString(),
  scriptExecution: 'external_python_fixture',
  reAuditEngine: 'aura_runAudit',
  auditEngine: 'src/services/auditEngine.ts',
  auditWrapper: 'experiments/tests/run_audit_wrapper.ts',
  pythonVersion: execSync('python3 --version', { encoding: 'utf-8' }).trim(),
  fixture: 'experiments/tests/fixtures/incidentes_semantic_sample.csv',
  cleanScript: 'experiments/tests/fixtures/incidentes_clean_script.py',
  remediationClassification,
  beforeScore: beforeReport.score,
  afterScore: afterReport.score,
  scoreDelta,
  beforeIssueCount: beforeReport.issues.length,
  afterIssueCount: afterReport.issues.length,
  issueDelta: afterReport.issues.length - beforeReport.issues.length,
  beforeReport: {
    score: beforeReport.score,
    rowCount: beforeReport.rowCount,
    colCount: beforeReport.colCount,
    duplicateRows: beforeReport.duplicateRows,
    issueCount: beforeReport.issues.length,
    issues: beforeReport.issues.map(i => ({
      id: i.id,
      ruleName: i.ruleName,
      column: i.column,
      severity: i.severity,
      count: i.count,
      affectedPercentage: i.affectedPercentage,
      description: i.description,
      sampleValues: i.sampleValues,
    })),
  },
  afterReport: {
    score: afterReport.score,
    rowCount: afterReport.rowCount,
    colCount: afterReport.colCount,
    duplicateRows: afterReport.duplicateRows,
    issueCount: afterReport.issues.length,
    issues: afterReport.issues.map(i => ({
      id: i.id,
      ruleName: i.ruleName,
      column: i.column,
      severity: i.severity,
      count: i.count,
      affectedPercentage: i.affectedPercentage,
      description: i.description,
      sampleValues: i.sampleValues,
    })),
  },
  correctedRules,
  unchangedRules,
  newRulesAfterScript: newRules,
  beforeCriticalIssues: beforeCritical,
  afterCriticalIssues: afterCritical,
  criticalDelta,
};

writeFileSync(OUTPUT_JSON, JSON.stringify(delta, null, 2));

console.log(`\n=== Delta Summary ===`);
console.log(`  reAuditEngine:           ${delta.reAuditEngine}`);
console.log(`  remediationClassification: ${delta.remediationClassification}`);
console.log(`  Score:                  ${delta.beforeScore} → ${delta.afterScore} (${delta.scoreDelta >= 0 ? '+' : ''}${delta.scoreDelta})`);
console.log(`  Issues:                 ${delta.beforeIssueCount} → ${delta.afterIssueCount} (${delta.issueDelta >= 0 ? '+' : ''}${delta.issueDelta})`);
console.log(`  Critical:               ${delta.beforeCriticalIssues} → ${delta.afterCriticalIssues}`);
console.log(`  Corrected:              [${delta.correctedRules.join(', ') || 'none'}]`);
console.log(`  Unchanged:             [${delta.unchangedRules.join(', ') || 'none'}]`);
console.log(`  New (script):         [${delta.newRulesAfterScript.join(', ') || 'none'}]`);
console.log(`\n  JSON written:  ${OUTPUT_JSON}`);
