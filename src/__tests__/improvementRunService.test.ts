/**
 * ImprovementRunService Tests — Phase 5 Loop 5
 *
 * Tests: computeHealthDelta, buildImprovementRunV1, runImprovementFlow.
 * Uses controlled fixtures only. No real user datasets.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { computeHealthDelta, buildImprovementRunV1, runImprovementFlow, type HealthDeltaV1, type ImprovementRunOptions } from '../services/improvementRunService';
import { executeControlledRun, type ControlledExecutionResult } from '../services/executionService';
import { runReaudit, type ReauditResult } from '../services/reauditService';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import { buildScriptCandidateV2, finalizeScriptContractV2 } from '../contracts/llm/scriptBuilderV2';
import { validateScriptCandidateV2 } from '../contracts/llm/scriptValidatorV2';
import type { ScriptContractV2, RemediationPlanV2, ScriptBuildContextV2, RemediationActionV2 } from '../contracts/llm/types';

const VALID_FINGERPRINT = 'sha256:testfingerprint';

const BEFORE_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","SAN FRANCISCO","2024-01-01",160903280
"456 Oak Ave","LOS ANGELES","2024-01-02",160903281
"789 Pine Rd","CHICAGO","2024-01-03",160903282
`;

const AFTER_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","san francisco","2024-01-01",160903280
"456 Oak Ave","los angeles","2024-01-02",160903281
"789 Pine Rd","chicago","2024-01-03",160903282
`;

const BEFORE_CSV_DIRTY = `id,name,email
1,John,not_an_email
2,Jane,jane@example.com
3,Bob,also_invalid
`;

const AFTER_CSV_CLEAN = `id,name,email
1,John,john@example.com
2,Jane,jane@example.com
3,Bob,bob@example.com
`;

function makeAction(
  actionType: string,
  columnId: string | null,
  params: Record<string, unknown>,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
  overrides: Partial<RemediationActionV2> = {},
): RemediationActionV2 {
  return {
    actionId: overrides.actionId ?? `act:test_${actionType}_${columnId ?? 'null'}`,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType: actionType as RemediationActionV2['actionType'],
    parameters: params as unknown as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
    ...overrides,
  };
}

function makePlan(actions: RemediationActionV2[], overrides: Partial<RemediationPlanV2> = {}): RemediationPlanV2 {
  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId: overrides.planId ?? 'plan:test123',
    diagnosisRef: 'diag:test',
    evidenceEnvelopeRef: overrides.evidenceEnvelopeRef ?? 'env:testabc',
    datasetFingerprint: overrides.datasetFingerprint ?? VALID_FINGERPRINT,
    plan: actions,
    actionabilityMap: {},
    exclusions: [],
    generatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBuildContext(plan: RemediationPlanV2, columns: string[]): ScriptBuildContextV2 {
  const colRefs = buildColumnRegistry(columns);
  return buildScriptContext(
    {
      evidenceEnvelopeRef: plan.evidenceEnvelopeRef,
      datasetFingerprint: plan.datasetFingerprint,
      columns: colRefs.map(c => ({
        columnId: c.columnId, name: c.name, position: c.position,
        duplicateOrdinal: c.duplicateOrdinal, isAmbiguous: c.isAmbiguous, isDuplicate: c.isDuplicate,
      })),
      issues: [],
    },
    colRefs,
    plan.datasetFingerprint,
  );
}

function buildValidContract(
  actions: RemediationActionV2[],
  columns: string[],
  planOverrides: Partial<RemediationPlanV2> = {},
): { contract: ScriptContractV2; plan: RemediationPlanV2; ctx: ScriptBuildContextV2 } {
  const plan = makePlan(actions, planOverrides);
  const ctx = makeBuildContext(plan, columns);
  const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
  const validation = validateScriptCandidateV2(candidate, plan, ctx);
  const contract = finalizeScriptContractV2(candidate, validation);
  return { contract, plan, ctx };
}

function makeMockExecutionResult(): ControlledExecutionResult {
  return {
    execution: {
      runtime: 'colab_notebook',
      runtimeVersion: '1.0.0',
      status: 'success',
      startedAt: '2025-01-01T00:00:00.000Z',
      finishedAt: '2025-01-01T00:00:01.000Z',
      durationMs: 1000,
      logs: ['test execution log'],
      error: null,
      sandbox: {
        networkDisabled: true,
        filesystemRestricted: true,
        timeoutMs: 30000,
        memoryLimitMb: 512,
        allowedImports: ['pandas'],
      },
      notebook: { generated: true, json: '{}' },
    },
    preflightBlocked: false,
    sandboxBlocked: false,
    fixtureApplied: true,
    datasetOriginalIntact: true,
    gates: {
      preflight: { status: 'ready', verification: { valid: true, errors: [] }, hashMatch: true, fingerprintMatch: true, acceptedActionsCoherent: true, reasons: [] },
      sandbox: { status: 'success', startedAt: '2025-01-01T00:00:00.000Z', finishedAt: '2025-01-01T00:00:01.000Z', durationMs: 1000, logs: [], error: null, sandbox: { timeoutMs: 30000, networkDisabled: true, filesystemRestricted: true, memoryLimitMb: 512, allowedImports: ['pandas'] }, preflightBlocked: false, importViolations: [], hasCleanDataset: true, networkAccessDetected: false, filesystemAccessDetected: false, dangerousBuiltinsDetected: [] },
    },
  };
}

function makeMockReauditResult(beforeIssues: number, afterIssues: number, scoreBefore: number, scoreAfter: number): ReauditResult {
  return {
    summary: {
      beforeEvidenceEnvelopeRef: 'env:before123',
      afterEvidenceEnvelopeRef: 'env:after456',
      beforeIssueCount: beforeIssues,
      afterIssueCount: afterIssues,
      rulesCompared: ['rule_email_format', 'rule_city_casing'],
    },
    output: {
      rowCountBefore: 3,
      rowCountAfter: 3,
      columnCountBefore: 4,
      columnCountAfter: 4,
      outputFingerprint: 'sha256:afterfp',
      changedCellsEstimate: 3,
      exportedCsvRef: 'output:env:after456',
    },
    beforeReport: {
      score: scoreBefore,
      rowCount: 3,
      colCount: 4,
      duplicateRows: 0,
      issues: Array(beforeIssues).fill(null).map((_, i) => ({
        id: `issue-${i}`,
        ruleName: `Rule ${i}`,
        ruleId: `rule_${i}`,
        category: 'Integridad y Estructura' as any,
        description: `Issue ${i}`,
        severity: 'warning' as any,
        count: 1,
        affectedPercentage: 33,
        sampleValues: [],
      })),
      columnStats: {},
      scoreBreakdown: [],
      delimiterDetected: ',',
    },
    afterReport: {
      score: scoreAfter,
      rowCount: 3,
      colCount: 4,
      duplicateRows: 0,
      issues: Array(afterIssues).fill(null).map((_, i) => ({
        id: `issue-${i}`,
        ruleName: `Rule ${i}`,
        ruleId: `rule_${i}`,
        category: 'Integridad y Estructura' as any,
        description: `Issue ${i}`,
        severity: 'warning' as any,
        count: 1,
        affectedPercentage: 33,
        sampleValues: [],
      })),
      columnStats: {},
      scoreBreakdown: [],
      delimiterDetected: ',',
    },
    beforeOutput: {
      data: [], fields: [], fingerprint: 'sha256:beforefp', rowCount: 3, colCount: 4, delimiter: ',', rawCsv: BEFORE_CSV,
    },
    afterOutput: {
      data: [], fields: [], fingerprint: 'sha256:afterfp', rowCount: 3, colCount: 4, delimiter: ',', rawCsv: AFTER_CSV,
    },
  };
}

// ── Tests ──

describe('computeHealthDelta', () => {
  it('returns improved when issues decrease', () => {
    const reaudit = makeMockReauditResult(3, 0, 75, 100);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('improved');
    expect(delta.scoreBefore).toBe(75);
    expect(delta.scoreAfter).toBe(100);
    expect(delta.delta).toBe(25);
    expect(delta.issueDelta).toBe(-3);
  });

  it('returns unchanged when issue count is stable', () => {
    const reaudit = makeMockReauditResult(3, 3, 75, 75);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('unchanged');
    expect(delta.issueDelta).toBe(0);
  });

  it('returns worsened when issue count increases', () => {
    const reaudit = makeMockReauditResult(1, 3, 80, 65);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('worsened');
    expect(delta.issueDelta).toBe(2);
  });

  it('returns unchanged when no issues before or after', () => {
    const reaudit = makeMockReauditResult(0, 0, 100, 100);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('unchanged');
    expect(delta.summary).toContain('No issues detected');
  });

  it('returns inconclusive when score decreases but issues decrease', () => {
    const reaudit = makeMockReauditResult(3, 1, 80, 70);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('inconclusive');
    expect(delta.delta).toBe(-10);
    expect(delta.caveats.length).toBeGreaterThan(0);
    expect(delta.caveats.some(c => c.includes('Score decreased'))).toBe(true);
    expect(delta.summary).toContain('inconclusive');
  });

  it('returns inconclusive when score increases but issues increase', () => {
    const reaudit = makeMockReauditResult(1, 3, 70, 80);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('inconclusive');
    expect(delta.delta).toBe(10);
    expect(delta.caveats.length).toBeGreaterThan(0);
    expect(delta.caveats.some(c => c.includes('Score increased'))).toBe(true);
    expect(delta.summary).toContain('inconclusive');
  });

  it('adds caveat when delta is 0 with remaining issues', () => {
    const reaudit = makeMockReauditResult(3, 3, 75, 75);
    const delta = computeHealthDelta(reaudit);
    expect(delta.status).toBe('unchanged');
    expect(delta.delta).toBe(0);
    expect(delta.caveats.some(c => c.includes('Score delta is 0'))).toBe(true);
  });

  it('includes summary string', () => {
    const reaudit = makeMockReauditResult(3, 0, 75, 100);
    const delta = computeHealthDelta(reaudit);
    expect(typeof delta.summary).toBe('string');
    expect(delta.summary.length).toBeGreaterThan(0);
  });

  it('computes correct issueDelta', () => {
    const reaudit = makeMockReauditResult(5, 2, 60, 85);
    const delta = computeHealthDelta(reaudit);
    expect(delta.issueDelta).toBe(-3);
  });
});

describe('buildImprovementRunV1', () => {
  const mockOptions: ImprovementRunOptions = {
    beforeEvidenceRef: 'env:before123',
    beforeCsv: BEFORE_CSV,
    afterCsv: AFTER_CSV,
    datasetName: 'TestDataset.csv',
  };

  it('produces valid ImprovementRunV1 structure', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);
    const executionResult = makeMockExecutionResult();
    const reauditResult = runReaudit(BEFORE_CSV, AFTER_CSV, 'env:before123');
    const healthDelta = computeHealthDelta(reauditResult);

    const run = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, mockOptions);

    expect(run.contractId).toBe('aura.improvement_run.v1');
    expect(run.contractVersion).toBe('1.0.0');
    expect(run.runId).toMatch(/^run:/);
    expect(run.createdAt).toBeTruthy();
    expect(run.sourceEvidenceEnvelopeRef).toBe('env:before123');
    expect(run.scriptHash).toBe(contract.scriptHash);
    expect(run.remediationPlanId).toBe(contract.remediationRef || 'unknown');
    expect(run.acceptedActionIds).toEqual(['act:normalize_city']);
    expect(run.execution).toBeDefined();
    expect(run.outputDataset).toBeDefined();
    expect(run.reaudit).toBeDefined();
    expect(run.healthDelta).toBeDefined();
    expect(run.limitations.length).toBeGreaterThan(0);
    expect(run.claims.permitted.length).toBeGreaterThan(0);
    expect(run.claims.prohibited.length).toBeGreaterThan(0);
  });

  it('adds worsened limitation when status is worsened', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);
    const executionResult = makeMockExecutionResult();
    const reauditResult = makeMockReauditResult(1, 3, 80, 65);
    const healthDelta = computeHealthDelta(reauditResult);

    const run = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, mockOptions);

    expect(run.limitations.some(l => l.includes('worsened'))).toBe(true);
    expect(run.claims.permitted.some(c => c.includes('issues were reduced'))).toBe(false);
  });

  it('adds improved claims when status is improved', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);
    const executionResult = makeMockExecutionResult();
    const reauditResult = makeMockReauditResult(3, 0, 75, 100);
    const healthDelta = computeHealthDelta(reauditResult);

    const run = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, mockOptions);

    expect(run.claims.permitted.some(c => c.includes('issues were reduced'))).toBe(true);
  });

  it('includes correct script contract ref', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);
    const executionResult = makeMockExecutionResult();
    const reauditResult = makeMockReauditResult(0, 0, 100, 100);
    const healthDelta = computeHealthDelta(reauditResult);

    const run = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, mockOptions);

    expect(run.scriptContractRef).toMatch(/^contract:/);
    expect(run.scriptHash).toBe(contract.scriptHash);
  });

  it('includes reaudit summary in run', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);
    const executionResult = makeMockExecutionResult();
    const reauditResult = makeMockReauditResult(3, 1, 75, 90);
    const healthDelta = computeHealthDelta(reauditResult);

    const run = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, mockOptions);

    expect(run.reaudit.beforeIssueCount).toBe(3);
    expect(run.reaudit.afterIssueCount).toBe(1);
    expect(run.reaudit.beforeEvidenceEnvelopeRef).toBe('env:before123');
  });

  it('includes healthDelta with correct status', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);
    const executionResult = makeMockExecutionResult();
    const reauditResult = makeMockReauditResult(3, 0, 75, 100);
    const healthDelta = computeHealthDelta(reauditResult);

    const run = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, mockOptions);

    expect(run.healthDelta.status).toBe('improved');
    expect(run.healthDelta.scoreBefore).toBe(75);
    expect(run.healthDelta.scoreAfter).toBe(100);
    expect(run.healthDelta.delta).toBe(25);
    expect(run.healthDelta.issueDelta).toBe(-3);
  });
});

describe('runImprovementFlow', () => {
  it('runs full pipeline and produces ImprovementRunV1', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original_audit',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
      datasetName: 'Incidentes_Policiales.csv',
    });

    expect(result.improvementRun.contractId).toBe('aura.improvement_run.v1');
    expect(result.improvementRun.runId).toMatch(/^run:/);
    expect(result.executionResult.execution.status).toBe('success');
    expect(result.reauditResult.summary.beforeIssueCount).toBeGreaterThanOrEqual(0);
    expect(result.reauditResult.summary.afterIssueCount).toBeGreaterThanOrEqual(0);
    expect(result.healthDelta.status).toBeDefined();
    expect(['improved', 'unchanged', 'worsened', 'inconclusive']).toContain(result.healthDelta.status);
  });

  it('records source and output fingerprints', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.improvementRun.sourceEvidenceEnvelopeRef).toBe('env:original');
    expect(result.improvementRun.outputDataset.outputFingerprint).toBeTruthy();
  });

  it('includes execution summary with notebook generated', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.executionResult.execution.notebook?.generated).toBe(true);
    expect(result.executionResult.execution.notebook?.json).toBeTruthy();
  });

  it('computes HealthDelta status through the flow', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(typeof result.healthDelta.scoreBefore).toBe('number');
    expect(typeof result.healthDelta.scoreAfter).toBe('number');
    expect(typeof result.healthDelta.delta).toBe('number');
    expect(typeof result.healthDelta.issueDelta).toBe('number');
  });

  it('includes permitted claims based on HealthDelta status', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV_DIRTY,
      afterCsv: AFTER_CSV_CLEAN,
    });

    const improved = result.healthDelta.status === 'improved';
    if (improved) {
      expect(result.improvementRun.claims.permitted.some(c => c.includes('issues were reduced'))).toBe(true);
    }
  });

  it('includes all standard prohibited claims', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.improvementRun.claims.prohibited).toContain('Do NOT claim that AURA executed Python directly — execution delegated to Google Colab.');
    expect(result.improvementRun.claims.prohibited).toContain('Do NOT claim that HealthDelta is a formal measurement outside the AURA audit engine.');
  });

  it('includes execution limitations', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.improvementRun.limitations.length).toBeGreaterThan(0);
    expect(result.improvementRun.limitations.some(l => l.includes('Google Colab'))).toBe(true);
  });

  it('throws when execution gate fails', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    // Pass wrong fingerprint to trigger preflight block
    const wrongFpContract = { ...contract, datasetFingerprint: 'sha256:wrong_fp' };

    expect(() => runImprovementFlow(wrongFpContract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    })).toThrow('Execution gate failed');
  });

  it('throws when afterCsv import fails', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    expect(() => runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: '', // invalid
    })).toThrow('Failed to import Colab output');
  });

  it('records acceptedActionIds from contract', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:original',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.improvementRun.acceptedActionIds).toContain('act:city_normalize');
  });
});
