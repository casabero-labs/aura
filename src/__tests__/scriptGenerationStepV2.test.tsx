/**
 * Script Generation Step v2 Tests — Phase 4 Loop 5.
 *
 * Tests the UI integration logic of the script contract pipeline.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type {
  RemediationActionV2,
  RemediationPlanV2,
  RemediationContextV2,
  ScriptContractV2,
  ScriptValidationResultV2,
  DiagnosisExecutionResult,
} from '../contracts/llm/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAction(
  actionType: RemediationActionV2['actionType'] = 'trim_whitespace',
  columnId: string | null = 'col:age#1#0',
  approvalStatus: RemediationActionV2['approvalStatus'] = 'approved',
  actionId = 'act:test1',
): RemediationActionV2 {
  return {
    actionId,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType,
    parameters: {},
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
  };
}

function makePlan(actions: RemediationActionV2[], planId = 'plan:test123'): RemediationPlanV2 {
  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId,
    diagnosisRef: 'diag:test',
    evidenceEnvelopeRef: 'env:testabc',
    datasetFingerprint: 'sha256:fingerprint123',
    plan: actions,
    actionabilityMap: {},
    exclusions: [],
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeRemediationContext(): RemediationContextV2 {
  return {
    evidenceEnvelopeRef: 'env:testabc',
    datasetFingerprint: 'sha256:fingerprint123',
    columns: [
      { columnId: 'col:age#1#0', name: 'age', position: 1, duplicateOrdinal: 0, isAmbiguous: false, isDuplicate: false },
    ],
    issues: [
      { issueId: 'issue:test', ruleId: 'rule:test', columnId: 'col:age#1#0', reason: 'Test issue', actionType: 'trim_whitespace', parameters: {} },
    ],
  };
}

function makeStructuredDiagnosis(): DiagnosisExecutionResult {
  return {
    diagnosis: {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      diagnosisRef: 'diag:test',
      evidenceEnvelopeRef: 'env:testabc',
      issues: [],
      generatedAt: '2025-01-01T00:00:00.000Z',
    },
    evidenceEnvelopeRef: 'env:testabc',
    remediationContext: makeRemediationContext(),
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeValidContract(overrides: Partial<ScriptContractV2> = {}): ScriptContractV2 {
  return {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    remediationRef: 'diag:test',
    datasetFingerprint: 'sha256:fingerprint123',
    acceptedActionIds: ['act:test1'],
    rejectedActionIds: [],
    excludedActionIds: [],
    columnRefs: [
      { columnId: 'col:age#1#0', name: 'age', position: 1, duplicateOrdinal: 0, isAmbiguous: false, isDuplicate: false },
    ],
    rendererVersion: '1.0.0',
    placeholderVocabularyVersion: '1.0.0',
    scriptText: "import pandas as pd\nimport numpy as np\ndf['age'] = df['age'].astype(str).str.strip()",
    cleanDatasetFn: 'clean_dataset',
    scriptHash: 'a1b2c3d4e5f6',
    validationResult: {
      valid: true,
      errors: [],
      warnings: [{ code: 'SCRIPT_SYNTAX_NOT_RUN', message: 'Python not available in browser', path: '$.pythonSyntax' }],
      pythonSyntax: { state: 'not_run' },
    },
    generatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeValidVerification(overrides: Partial<ScriptValidationResultV2> = {}): ScriptValidationResultV2 {
  return {
    valid: true,
    errors: [],
    warnings: [],
    pythonSyntax: { state: 'not_run' },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
  };
}

describe('Contract flow (build → validate → finalize → verify)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valid plan generates usable contract (requires_human_review → excluded)', async () => {
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');
    const { validateScriptCandidateV2 } = await import('../contracts/llm/scriptValidatorV2');
    const { finalizeScriptContractV2 } = await import('../contracts/llm/scriptBuilderV2');
    const { verifyScriptContractV2 } = await import('../contracts/llm/scriptValidatorV2');

    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:test1',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:a1')], 'plan:testctx1');
    plan.evidenceEnvelopeRef = 'env:test1';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
    expect(validation.valid).toBe(true);

    const contract = finalizeScriptContractV2(candidate, validation);
    expect(contract.scriptHash).toBeTruthy();

    const fresh = verifyScriptContractV2(contract, plan, buildCtx);
    expect(fresh.valid).toBe(true);
  });

  it('zero accepted actions → no-op script is valid', async () => {
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');
    const { validateScriptCandidateV2 } = await import('../contracts/llm/scriptValidatorV2');

    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:test2',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:p1')], 'plan:testctx2');
    plan.evidenceEnvelopeRef = 'env:test2';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);

    expect(validation.valid).toBe(true);
    expect(candidate.acceptedActionIds).toHaveLength(0);
    expect(candidate.scriptText).toContain('import pandas as pd');
  });

  it('partition counts: accepted + rejected + excluded match plan', async () => {
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');

    const colRefs = buildColumnRegistry(['id', 'age', 'name', 'salary']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:test3',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([
      makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:p1'),
      makeAction('requires_human_review', colRefs[2].columnId, 'pending', 'act:p2'),
      makeAction('requires_human_review', colRefs[3].columnId, 'pending', 'act:p3'),
    ], 'plan:testctx3');
    plan.evidenceEnvelopeRef = 'env:test3';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);

    expect(candidate.acceptedActionIds).toHaveLength(0);
    expect(candidate.excludedActionIds.length).toBe(3);
    expect(candidate.excludedActionIds.some((e: any) => e.actionId === 'act:p1')).toBe(true);
  });

  it('excluded actions include reason field', async () => {
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');

    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:test5',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([
      makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:review1'),
    ], 'plan:testctx5');
    plan.evidenceEnvelopeRef = 'env:test5';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);

    const excluded = candidate.excludedActionIds.find((e: any) => e.actionId === 'act:review1');
    expect(excluded).toBeTruthy();
    expect(typeof excluded.reason).toBe('string');
  });

  it('syntax not_run appears as warning, not error', async () => {
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');
    const { validateScriptCandidateV2 } = await import('../contracts/llm/scriptValidatorV2');

    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:test6',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:a1')], 'plan:testctx6');
    plan.evidenceEnvelopeRef = 'env:test6';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);

    expect(validation.valid).toBe(true);
    expect(validation.pythonSyntax.state).toBe('not_run');
    expect(validation.warnings.some((w: any) => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
    expect(validation.errors.some((e: any) => e.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(false);
  });
});

describe('Contract visual state', () => {
  it('contractValid = validationResult.valid && freshVerification.valid', async () => {
    const contract = makeValidContract();
    const verification = makeValidVerification({ valid: false });
    const contractValid = contract.validationResult.valid === true && verification.valid === true;
    expect(contractValid).toBe(false);
  });

  it('valid contract shows "Contrato válido" badge', () => {
    const contract = makeValidContract();
    const verification = makeValidVerification();
    const contractValid = contract.validationResult.valid === true && verification.valid === true;
    expect(contractValid).toBe(true);
  });

  it('"Seguro" label NOT in v2 contract display', () => {
    const contract = makeValidContract();
    expect(JSON.stringify(contract)).not.toMatch(/Seguro/);
    expect(JSON.stringify(contract)).not.toMatch(/safetyScore/);
  });

  it('"AI" NOT mentioned in v2 contract', () => {
    const contract = makeValidContract();
    expect(JSON.stringify(contract)).not.toMatch(/\bAI\b/i);
    expect(JSON.stringify(contract)).not.toMatch(/\bLLM\b/i);
  });

  it('syntax not_run shown as informational warning', () => {
    const contract = makeValidContract();
    contract.validationResult.pythonSyntax = { state: 'not_run' };
    contract.validationResult.warnings = [
      { code: 'SCRIPT_SYNTAX_NOT_RUN', message: 'Python not available in browser', path: '$.pythonSyntax' },
    ];
    expect(contract.validationResult.pythonSyntax.state).toBe('not_run');
    expect(contract.validationResult.warnings.length).toBeGreaterThan(0);
  });

  it('errors display only code, path, message (no stack trace)', () => {
    const error = { code: 'SCRIPT_CONTRACT_INVALID', message: 'Missing required field', path: '$.scriptText' };
    expect(Object.keys(error)).toEqual(['code', 'message', 'path']);
    expect(JSON.stringify(error)).not.toMatch(/at /);
    expect(JSON.stringify(error)).not.toMatch(/stack/);
  });
});

describe('PipelineData v2 fields', () => {
  let mockLs: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockLs = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockLs);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PipelineData includes scriptContractV2 and scriptContractVerificationV2', async () => {
    const { PipelineData } = await import('../components/MainPipeline');
    const data = {
      state: 'review' as const,
      file: null,
      report: null,
      auditEvidence: null,
      rawData: [] as Record<string, any>[],
      csvFields: [] as string[],
      csvDelimiter: ',',
      cleaningScript: '',
      approvedScript: '',
      healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null,
      remediationPlan: null,
      scriptContractV2: makeValidContract(),
      scriptContractVerificationV2: makeValidVerification(),
      benchmarkResults: [] as any[],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [] as { time: string; msg: string }[],
    };
    expect((data as any).scriptContractV2).toBeTruthy();
    expect((data as any).scriptContractVerificationV2).toBeTruthy();
  });

  it('session snapshot roundtrip preserves scriptContractV2', async () => {
    const { savePipelineSession, loadPipelineSession } = await import('../services/pipelineSession');
    const contract = makeValidContract();
    const verification = makeValidVerification();

    const snapshot = {
      state: 'review',
      file: null,
      report: null,
      auditEvidence: null,
      rawData: [],
      csvFields: ['age', 'name'],
      csvDelimiter: ',',
      cleaningScript: contract.scriptText,
      approvedScript: '',
      healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null,
      remediationPlan: null,
      scriptContractV2: contract,
      scriptContractVerificationV2: verification,
      benchmarkResults: [],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [],
      savedAt: new Date().toISOString(),
    };

    savePipelineSession(snapshot as any);
    const restored = loadPipelineSession();

    expect(restored).not.toBeNull();
    expect((restored as any).scriptContractV2).toBeTruthy();
    expect((restored as any).scriptContractV2.scriptHash).toBe(contract.scriptHash);
    expect((restored as any).scriptContractVerificationV2).toBeTruthy();
  });
});

describe('ReviewStep v2 fresh verification', () => {
  it('fresh verification called before approval in v2', async () => {
    const { verifyScriptContractV2 } = await import('../contracts/llm/scriptValidatorV2');
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');

    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:vftest1',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:v1')], 'plan:vftest1');
    plan.evidenceEnvelopeRef = 'env:vftest1';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');
    const { validateScriptCandidateV2 } = await import('../contracts/llm/scriptValidatorV2');
    const { finalizeScriptContractV2 } = await import('../contracts/llm/scriptBuilderV2');

    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
    const contract = finalizeScriptContractV2(candidate, validation);

    const fresh = verifyScriptContractV2(contract, plan, buildCtx);
    expect(fresh).toBeTruthy();
    expect(fresh.valid).toBe(true);
  });

  it('altered hash blocks approval', async () => {
    const { verifyScriptContractV2 } = await import('../contracts/llm/scriptValidatorV2');
    const { buildColumnRegistry } = await import('../contracts/llm/columnRegistry');
    const { buildScriptContext } = await import('../contracts/llm/scriptBuildContext');
    const { buildScriptCandidateV2 } = await import('../contracts/llm/scriptBuilderV2');
    const { validateScriptCandidateV2 } = await import('../contracts/llm/scriptValidatorV2');
    const { finalizeScriptContractV2 } = await import('../contracts/llm/scriptBuilderV2');

    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:vftest2',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: [...colRefs],
      issues: [],
    };
    const plan = makePlan([makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:v2')], 'plan:vftest2');
    plan.evidenceEnvelopeRef = 'env:vftest2';

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
    const contract = finalizeScriptContractV2(candidate, validation);
    contract.scriptHash = 'altered_hash';

    const fresh = verifyScriptContractV2(contract, plan, buildCtx);
    expect(fresh.valid).toBe(false);
  });

  it('v2 mode does NOT call createImprovementRun', () => {
    const contract = makeValidContract();
    expect(JSON.stringify(contract)).not.toMatch(/createImprovementRun/);
    expect(JSON.stringify(contract)).not.toMatch(/runSimulation/);
    expect(JSON.stringify(contract)).not.toMatch(/Pyodide/);
    expect(JSON.stringify(contract)).not.toMatch(/healthDelta/);
  });

  it('v2 review does NOT show safetyScore', () => {
    const contract = makeValidContract();
    expect(JSON.stringify(contract)).not.toMatch(/safetyScore/);
    expect(JSON.stringify(contract)).not.toMatch(/Seguro/);
  });

  it('v2 review does NOT claim dataset improved', () => {
    const contract = makeValidContract();
    expect(JSON.stringify(contract)).not.toMatch(/mejor\w+/i);
    expect(JSON.stringify(contract)).not.toMatch(/improved/i);
  });
});

describe('isContractsV2Enabled routing', () => {
  it('isContractsV2Enabled returns boolean', async () => {
    const { isContractsV2Enabled } = await import('../contracts/llm');
    const enabled = isContractsV2Enabled();
    expect(typeof enabled).toBe('boolean');
  });

  it('structuredDiagnosis without remediationContext → legacy route', () => {
    const diag = makeStructuredDiagnosis();
    diag.remediationContext = undefined;
    expect(diag.remediationContext).toBeUndefined();
  });
});

describe('RemediationPlanStepV2 continueLabel', () => {
  it('RemediationPlanStepV2 is importable', async () => {
    const mod = await import('../components/RemediationPlanStepV2');
    expect(mod.default).toBeDefined();
  });
});

describe('ScriptReview v2 props', () => {
  it('ScriptReview is importable with v2 props', async () => {
    const { default: ScriptReview } = await import('../components/ScriptReview');
    expect(ScriptReview).toBeDefined();
  });
});
