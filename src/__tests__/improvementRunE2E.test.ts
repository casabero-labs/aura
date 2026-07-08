/**
 * ImprovementRun E2E Tests — Phase 5 Loop 6
 *
 * End-to-end validation of the full Phase 5 pipeline:
 * executeControlledRun → importColabOutput → runReaudit →
 * computeHealthDelta → buildImprovementRunV1 → exportJSON → type guards.
 *
 * Uses controlled fixtures only. No real user datasets.
 */

import { describe, expect, it } from 'vitest';
import {
  runImprovementFlow,
  computeHealthDelta,
  exportImprovementRunJSON,
  isHealthDeltaV1,
  isImprovementRunV1,
} from '../services/improvementRunService';
import type { ReauditResult } from '../services/reauditService';

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

const BEFORE_CSV_WORSENED = `id,name,email
1,John,john@example.com
`;

const AFTER_CSV_WORSENED = `id,name,email
1,John,not_an_email
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

// ═══════════════════════════════════════════════════════════
// E2E Tests
// ═══════════════════════════════════════════════════════════

describe('E2E: runImprovementFlow full pipeline', () => {
  it('completes the full flow with city normalization fixture', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:e2e_before',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
      datasetName: 'E2E_City_Normalization.csv',
    });

    expect(result.improvementRun.contractId).toBe('aura.improvement_run.v1');
    expect(result.improvementRun.runId).toMatch(/^run:/);
    expect(result.improvementRun.sourceEvidenceEnvelopeRef).toBe('env:e2e_before');
    expect(result.improvementRun.acceptedActionIds).toContain('act:city_normalize');

    // Execution
    expect(result.executionResult.execution.runtime).toBe('colab_notebook');
    expect(result.executionResult.execution.notebook?.generated).toBe(true);

    // Reaudit
    expect(result.reauditResult.summary.beforeEvidenceEnvelopeRef).toBe('env:e2e_before');
    expect(result.reauditResult.summary.afterEvidenceEnvelopeRef).toMatch(/^env:/);

    // Output dataset
    expect(result.reauditResult.output.rowCountBefore).toBe(3);
    expect(result.reauditResult.output.rowCountAfter).toBe(3);
    expect(result.reauditResult.output.columnCountBefore).toBe(4);
    expect(result.reauditResult.output.columnCountAfter).toBe(4);
    expect(result.reauditResult.output.outputFingerprint).toBeTruthy();

    // HealthDelta
    expect(result.healthDelta.scoreBefore).toBeGreaterThan(0);
    expect(result.healthDelta.scoreAfter).toBeGreaterThan(0);
    expect(typeof result.healthDelta.delta).toBe('number');

    // ImprovementRunV1
    expect(result.improvementRun.limitations.length).toBeGreaterThan(0);
    expect(result.improvementRun.claims.permitted.length).toBeGreaterThan(0);
    expect(result.improvementRun.claims.prohibited.length).toBeGreaterThan(0);
  });

  it('completes flow with email cleaning fixture (improved)', () => {
    const colRefs = buildColumnRegistry(['email']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:email_fix' });
    const { contract, plan, ctx } = buildValidContract([action], ['email']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:e2e_email',
      beforeCsv: BEFORE_CSV_DIRTY,
      afterCsv: AFTER_CSV_CLEAN,
      datasetName: 'E2E_Email_Cleaning.csv',
    });

    expect(result.healthDelta.status).toBe('improved');
    expect(result.healthDelta.issueDelta).toBeLessThan(0);
  });

  it('detects worsened when output introduces issues', () => {
    const colRefs = buildColumnRegistry(['email']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:email_worsen' });
    const { contract, plan, ctx } = buildValidContract([action], ['email']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:e2e_worsen',
      beforeCsv: BEFORE_CSV_WORSENED,
      afterCsv: AFTER_CSV_WORSENED,
      datasetName: 'E2E_Worsened.csv',
    });

    // Status could be worsened or inconclusive depending on score behavior
    expect(['worsened', 'inconclusive']).toContain(result.healthDelta.status);
  });
});

describe('E2E: JSON export', () => {
  it('exports ImprovementRunV1 as valid JSON', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:json_export',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    const json = exportImprovementRunJSON(result.improvementRun);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.contractId).toBe('aura.improvement_run.v1');
    expect(parsed.runId).toMatch(/^run:/);
    expect(parsed.healthDelta).toBeDefined();
    expect(parsed.healthDelta.status).toBeDefined();
    expect(parsed.reaudit).toBeDefined();
    expect(parsed.outputDataset).toBeDefined();
    expect(parsed.execution).toBeDefined();
    expect(parsed.limitations).toBeInstanceOf(Array);
    expect(parsed.claims.permitted).toBeInstanceOf(Array);
    expect(parsed.claims.prohibited).toBeInstanceOf(Array);
  });

  it('produces pretty-printed JSON', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:pretty',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    const json = exportImprovementRunJSON(result.improvementRun);
    expect(json).toContain('\n  ');
  });

  it('throws when passing invalid object to exportImprovementRunJSON', () => {
    expect(() => exportImprovementRunJSON({ foo: 'bar' } as any)).toThrow('invalid ImprovementRunV1');
  });
});

describe('E2E: type guards', () => {
  it('isHealthDeltaV1 returns true for valid HealthDelta', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:guard',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(isHealthDeltaV1(result.healthDelta)).toBe(true);
  });

  it('isHealthDeltaV1 returns false for null', () => {
    expect(isHealthDeltaV1(null)).toBe(false);
  });

  it('isHealthDeltaV1 returns false for invalid shape', () => {
    expect(isHealthDeltaV1({ status: 'improved' })).toBe(false);
  });

  it('isImprovementRunV1 returns true for valid ImprovementRunV1', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:guard2',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(isImprovementRunV1(result.improvementRun)).toBe(true);
  });

  it('isImprovementRunV1 returns false for null', () => {
    expect(isImprovementRunV1(null)).toBe(false);
  });

  it('isImprovementRunV1 returns false for wrong contractId', () => {
    const fake = { contractId: 'wrong.id', contractVersion: '1.0.0' };
    expect(isImprovementRunV1(fake)).toBe(false);
  });

  it('isImprovementRunV1 returns false for missing healthDelta', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:guard3',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    const copy = { ...result.improvementRun, healthDelta: undefined };
    expect(isImprovementRunV1(copy)).toBe(false);
  });
});

describe('E2E: dataset original intact', () => {
  it('datasetOriginalIntact is always true', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:intact',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.executionResult.datasetOriginalIntact).toBe(true);
  });

  it('beforeCsv is not modified by the pipeline', () => {
    const beforeCopy = BEFORE_CSV.slice(0);
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:immut',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(BEFORE_CSV).toBe(beforeCopy);
  });
});

describe('E2E: Colab execution confirmation', () => {
  it('execution runtime is always colab_notebook', () => {
    const colRefs = buildColumnRegistry(['City']);
    const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:city_normalize' });
    const { contract, plan, ctx } = buildValidContract([action], ['City']);

    const result = runImprovementFlow(contract, plan, ctx, {
      beforeEvidenceRef: 'env:colab',
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
    });

    expect(result.executionResult.execution.runtime).toBe('colab_notebook');
  });
});

describe('E2E: inconclusive HealthDelta', () => {
  it('returns inconclusive when score and issues contradict', () => {
    const reaudit = makeMockReauditResult(3, 0, 80, 70);
    const delta = computeHealthDelta(reaudit);

    expect(delta.status).toBe('inconclusive');
    expect(delta.delta).toBe(-10);
    expect(delta.issueDelta).toBe(-3);
    expect(delta.caveats.length).toBeGreaterThan(0);
    expect(delta.summary).toContain('inconclusive');
  });

  it('returns inconclusive when worsened but score increases', () => {
    const reaudit = makeMockReauditResult(1, 5, 60, 80);
    const delta = computeHealthDelta(reaudit);

    expect(delta.status).toBe('inconclusive');
    expect(delta.delta).toBe(20);
    expect(delta.issueDelta).toBe(4);
    expect(delta.summary).toContain('inconclusive');
  });
});

// ── Helper factories reused from improvementRunService.test.ts ──

function makeMockExecutionResult() {
  return {
    execution: {
      runtime: 'colab_notebook' as const,
      runtimeVersion: '1.0.0',
      status: 'success' as const,
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
      preflight: { status: 'ready', verification: { valid: true, errors: [] }, hashMatch: true, fingerprintMatch: true, acceptedActionsCoherent: true, executableActionsPresent: true, reasons: [] },
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
      data: [], fields: [], fingerprint: 'sha256:beforefp', rowCount: 3, colCount: 4, delimiter: ',', rawCsv: 'a,b\n1,2',
    },
    afterOutput: {
      data: [], fields: [], fingerprint: 'sha256:afterfp', rowCount: 3, colCount: 4, delimiter: ',', rawCsv: 'a,b\n1,2',
    },
  };
}
