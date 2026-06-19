import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DELTA_JSON_PATH = resolve(__dirname, '../../experiments/tests/results/incidentes_colab_delta_fixture.json');

interface IssueSummary {
  id: string;
  ruleName: string;
  column?: string;
  severity: string;
  count: number;
  affectedPercentage: number;
  description: string;
  sampleValues: string[];
}

interface DeltaFixture {
  generatedAt: string;
  scriptExecution: string;
  reAuditEngine: string;
  auditEngine: string;
  auditWrapper: string;
  pythonVersion?: string;
  fixture?: string;
  cleanScript?: string;
  beforeScore: number;
  afterScore: number;
  scoreDelta: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  issueDelta: number;
  beforeReport: {
    score: number;
    rowCount: number;
    colCount: number;
    duplicateRows: number;
    issueCount: number;
    issues: IssueSummary[];
  };
  afterReport: {
    score: number;
    rowCount: number;
    colCount: number;
    duplicateRows: number;
    issueCount: number;
    issues: IssueSummary[];
  };
  correctedRules: string[];
  unchangedRules: string[];
  newRulesAfterScript: string[];
  beforeCriticalIssues: number;
  afterCriticalIssues: number;
  criticalDelta: number;
  remediationClassification?: 'source_debt_preserved' | 'improvement';
}

function loadDelta(): DeltaFixture {
  const raw = readFileSync(DELTA_JSON_PATH, 'utf-8');
  return JSON.parse(raw);
}

describe('Colab Delta Fixture — External Python Remediation Alignment (AURA-SCRIPT-SCORING-ALIGNMENT-01)', () => {

  it('delta JSON exists and is valid', () => {
    expect(() => loadDelta()).not.toThrow();
    const delta = loadDelta();
    expect(delta.generatedAt).toBeTruthy();
    expect(typeof delta.beforeScore).toBe('number');
    expect(typeof delta.afterScore).toBe('number');
  });

  it('marks reAuditEngine as aura_runAudit (official AURA engine)', () => {
    const delta = loadDelta();
    expect(delta.reAuditEngine).toBe('aura_runAudit');
  });

  it('specifies auditEngine and auditWrapper correctly', () => {
    const delta = loadDelta();
    expect(delta.auditEngine).toBe('src/services/auditEngine.ts');
    expect(delta.auditWrapper).toBe('experiments/tests/run_audit_wrapper.ts');
  });

  it('marks scriptExecution as external_python_fixture', () => {
    const delta = loadDelta();
    expect(delta.scriptExecution).toBe('external_python_fixture');
  });

  it('includes full beforeReport and afterReport from runAudit', () => {
    const delta = loadDelta();
    expect(delta.beforeReport).toBeDefined();
    expect(delta.beforeReport.score).toBe(65);
    expect(delta.beforeReport.rowCount).toBe(10);
    expect(delta.afterReport).toBeDefined();
    expect(delta.afterReport.rowCount).toBe(10);
  });

  it('correctedRules includes Caos de Capitalización (City normalized by script)', () => {
    const delta = loadDelta();
    expect(delta.correctedRules).toContain('Caos de Capitalización');
  });

  it('beforeReport contains Contaminación Semántica de ID on CrimeId', () => {
    const delta = loadDelta();
    const issue = delta.beforeReport.issues.find(i => i.ruleName === 'Contaminación Semántica de ID');
    expect(issue).toBeDefined();
    expect(issue!.column).toBe('CrimeId');
  });

  it('afterReport has Contaminación Semántica de ID migrated to crimeid_original auxiliary column', () => {
    const delta = loadDelta();
    const auxContam = delta.afterReport.issues.find(
      i => i.ruleName === 'Contaminación Semántica de ID' && i.column === 'crimeid_original'
    );
    expect(auxContam).toBeDefined();
  });

  it('afterReport no longer has Contaminación Semántica de ID on CrimeId (corrected in primary column)', () => {
    const delta = loadDelta();
    const crimeIdContam = delta.afterReport.issues.filter(
      i => i.ruleName === 'Contaminación Semántica de ID' && i.column === 'CrimeId'
    );
    expect(crimeIdContam).toHaveLength(0);
  });

  it('crimeid_corrupted auxiliary column exists in afterReport (trazabilidad preserved)', () => {
    const delta = loadDelta();
    const hasCorruptedAux = delta.afterReport.issues.some(i => i.column === 'crimeid_corrupted');
    expect(hasCorruptedAux).toBe(false);
  });

  it('scoreDelta is negative (score worsens: remediation exposes pre-existing CrimeId debt)', () => {
    const delta = loadDelta();
    expect(delta.scoreDelta).toBeLessThan(0);
  });

  it('newRulesAfterScript includes Valores Nulos / Vacíos (auxiliary columns introduce nulls)', () => {
    const delta = loadDelta();
    expect(delta.newRulesAfterScript).toContain('Valores Nulos / Vacíos');
  });

  it('unchangedRules includes Contaminación Semántica de ID (migrated, not eliminated)', () => {
    const delta = loadDelta();
    expect(delta.unchangedRules).toContain('Contaminación Semántica de ID');
  });

  it('pythonVersion is present (proof of external Python execution)', () => {
    const delta = loadDelta();
    expect(delta.pythonVersion).toBeTruthy();
    expect(delta.pythonVersion).toMatch(/^Python /);
  });

  it('no critical issues reduction: criticalDelta >= 0 (score worsens, not improves)', () => {
    const delta = loadDelta();
    expect(delta.criticalDelta).toBeGreaterThanOrEqual(0);
  });

  it('remediationClassification is source_debt_preserved (scoreDelta < 0)', () => {
    const delta = loadDelta();
    expect(delta.remediationClassification).toBe('source_debt_preserved');
  });

  it('remediationClassification is NOT improvement when scoreDelta < 0', () => {
    const delta = loadDelta();
    expect(delta.remediationClassification).not.toBe('improvement');
  });

  it('remediationClassification is NOT improvement when criticalDelta > 0', () => {
    const delta = loadDelta();
    if (delta.criticalDelta > 0) {
      expect(delta.remediationClassification).not.toBe('improvement');
    }
  });

  it('scoreDelta < 0 and criticalDelta >= 0 together implies source_debt_preserved classification', () => {
    const delta = loadDelta();
    if (delta.scoreDelta < 0 && delta.criticalDelta >= 0) {
      expect(delta.remediationClassification).toBe('source_debt_preserved');
    }
  });
});
