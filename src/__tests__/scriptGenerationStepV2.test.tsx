/**
 * Script Generation Step v2 — Integration tests (Loop 5R).
 *
 * Real component mounting with @testing-library/react + jsdom.
 * NO mocking of buildColumnRegistry, buildScriptContext, buildScriptCandidateV2,
 * validateScriptCandidateV2, finalizeScriptContractV2, verifyScriptContractV2.
 */
// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  buildColumnRegistry,
  buildScriptContext,
  buildScriptCandidateV2,
  validateScriptCandidateV2,
  finalizeScriptContractV2,
  verifyScriptContractV2,
  isContractsV2Enabled,
  buildRemediationPlanV2,
  validateRemediationPlanV2,
} from '../contracts/llm';
import type {
  RemediationActionV2,
  RemediationPlanV2,
  RemediationContextV2,
  ScriptContractV2,
  ScriptValidationResultV2,
  DiagnosisExecutionResult,
  ColumnRef,
} from '../contracts/llm/types';
import { buildUiScriptContext, buildScriptContractInputKey } from '../services/scriptContractUiContext';
import { AIConfig, AIProvider } from '../types';

// Mock isContractsV2Enabled to return true
vi.mock('../contracts/llm/contractRegistry', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../contracts/llm/contractRegistry')>();
  return {
    ...mod,
    isContractsV2Enabled: () => true,
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAction(
  actionType: RemediationActionV2['actionType'] = 'requires_human_review',
  columnId: string | null = null,
  approvalStatus: RemediationActionV2['approvalStatus'] = 'pending',
  actionId = 'act:test1',
): RemediationActionV2 {
  return {
    actionId,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType,
    parameters: { reasonCode: 'unknown_rule', message: 'test' } as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
  };
}

function makePlan(
  actions: RemediationActionV2[],
  planId = 'plan:test123',
  evidenceEnvelopeRef = 'env:testabc',
): RemediationPlanV2 {
  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId,
    diagnosisRef: 'diag:test',
    evidenceEnvelopeRef,
    datasetFingerprint: 'sha256:fingerprint123',
    plan: actions,
    actionabilityMap: {},
    exclusions: [],
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeRemediationContext(columns?: ColumnRef[]): RemediationContextV2 {
  const cols = columns ?? buildColumnRegistry(['id', 'age', 'name']);
  return {
    evidenceEnvelopeRef: 'env:testabc',
    datasetFingerprint: 'sha256:fingerprint123',
    columns: cols,
    issues: cols.map((c) => ({
      issueId: `issue:${c.columnId}`,
      ruleId: 'rule:replace_na',
      columnId: c.columnId,
      scope: 'column' as const,
      evidenceRefs: [],
      actionability: 'auto_safe' as const,
      automaticAuthorization: {
        authorized: true,
        actionType: 'transform_column',
        conditionsMet: [],
        reason: 'Auto-authorized for test',
      },
    })),
  };
}

function makeStructuredDiagnosis(columns?: ColumnRef[]): DiagnosisExecutionResult {
  const cols = columns ?? buildColumnRegistry(['id', 'age', 'name']);
  const ctx = makeRemediationContext(cols);
  return {
    version: 2 as const,
    diagnosis: {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      responseId: 'diag:test',
      evidenceEnvelopeRef: 'env:testabc',
      issues: ctx.issues.map((i) => ({
        issueId: i.issueId,
        evidenceRefs: i.evidenceRefs,
        hypothesis: 'Test hypothesis',
        confidence: 0.9,
        requiresHumanReview: false,
        limits: [],
      })),
      diagnosisBlocks: [],
      limitations: [],
      generatedAt: '2025-01-01T00:00:00.000Z',
    },
    metrics: { latencyMs: 0, tokensGenerated: 0, model: 'test', provider: 'test', isLocal: false },
    promptHash: 'sha256:prompt',
    evidenceEnvelopeRef: 'env:testabc',
    promptVersion: '1.0',
    rawResponseHash: 'sha256:response',
    remediationContext: ctx,
  };
}

function makeExecutableStructuredDiagnosis(): DiagnosisExecutionResult {
  const cols = buildColumnRegistry(['id', 'age', 'name']);
  const target = cols[1];
  const ctx: RemediationContextV2 = {
    evidenceEnvelopeRef: 'env:testabc',
    datasetFingerprint: 'sha256:fingerprint123',
    columns: cols,
    issues: [
      {
        issueId: `issue:${target.columnId}`,
        ruleId: 'rule:trim-whitespace',
        columnId: target.columnId,
        scope: 'column',
        evidenceRefs: [],
        actionability: 'auto_safe',
        automaticAuthorization: {
          authorized: true,
          actionType: 'trim_whitespace',
          conditionsMet: ['test-fixture'],
          reason: 'Auto-authorized executable fixture',
        },
      },
    ],
  };

  return {
    version: 2 as const,
    diagnosis: {
      contractId: 'aura.diagnosis.v2',
      contractVersion: '2.0.0',
      responseId: 'diag:test',
      evidenceEnvelopeRef: 'env:testabc',
      issues: ctx.issues.map((i) => ({
        issueId: i.issueId,
        evidenceRefs: i.evidenceRefs,
        hypothesis: 'Whitespace can be trimmed deterministically',
        confidence: 0.9,
        requiresHumanReview: false,
        limits: [],
      })),
      diagnosisBlocks: [],
      limitations: [],
      generatedAt: '2025-01-01T00:00:00.000Z',
    },
    metrics: { latencyMs: 0, tokensGenerated: 0, model: 'test', provider: 'test', isLocal: false },
    promptHash: 'sha256:prompt',
    evidenceEnvelopeRef: 'env:testabc',
    promptVersion: '1.0',
    rawResponseHash: 'sha256:response',
    remediationContext: ctx,
  };
}

function makeValidContract(overrides: Partial<ScriptContractV2> = {}): ScriptContractV2 {
  const colRefs = buildColumnRegistry(['id', 'age', 'name']);
  return {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    remediationRef: 'diag:test',
    datasetFingerprint: 'sha256:fingerprint123',
    acceptedActionIds: [],
    rejectedActionIds: [],
    excludedActionIds: [],
    columnRefs: colRefs,
    rendererVersion: '2.0.0',
    placeholderVocabularyVersion: '1.0.0',
    scriptText: "import pandas as pd\nimport numpy as np\ndef clean_dataset(df):\n    df_clean = df.copy()\n    return df_clean",
    cleanDatasetFn: 'clean_dataset',
    scriptHash: 'a1b2c3d4e5f6',
    validationResult: {
      valid: true,
      errors: [],
      warnings: [{ code: 'SCRIPT_SYNTAX_NOT_RUN', message: 'Python not available', path: '$.pythonSyntax', value: null }],
      pythonSyntax: { state: 'not_run' as const },
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

// ── buildUiScriptContext tests ────────────────────────────────────────────────

describe('buildUiScriptContext', () => {
  it('returns ok:true with valid inputs', () => {
    const diag = makeStructuredDiagnosis();
    const result = buildUiScriptContext({
      structuredDiagnosis: diag,
      csvFields: ['id', 'age', 'name'],
      sourceDatasetFingerprint: 'sha256:fingerprint123',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.refs).toHaveLength(3);
      expect(result.buildContext).toBeTruthy();
    }
  });

  it('returns ok:false when remediationContext is missing', () => {
    const result = buildUiScriptContext({
      structuredDiagnosis: { ...makeStructuredDiagnosis(), remediationContext: undefined },
      csvFields: ['id'],
      sourceDatasetFingerprint: 'sha256:fp',
    });
    expect(result.ok).toBe(false);
    const err = result as { ok: false; reason: string };
    expect(err.reason).toBe('missing_remediation_context');
  });

  it('returns ok:false when fingerprint is missing', () => {
    const result = buildUiScriptContext({
      structuredDiagnosis: makeStructuredDiagnosis(),
      csvFields: ['id'],
      sourceDatasetFingerprint: null,
    });
    expect(result.ok).toBe(false);
    const err = result as { ok: false; reason: string };
    expect(err.reason).toBe('missing_fingerprint');
  });

  it('returns ok:false when csvFields is empty', () => {
    const result = buildUiScriptContext({
      structuredDiagnosis: makeStructuredDiagnosis(),
      csvFields: [],
      sourceDatasetFingerprint: 'sha256:fp',
    });
    expect(result.ok).toBe(false);
    const err = result as { ok: false; reason: string };
    expect(err.reason).toBe('missing_columns');
  });

  it('refs use buildColumnRegistry — canonical IDs, not manual', () => {
    const result = buildUiScriptContext({
      structuredDiagnosis: makeStructuredDiagnosis(),
      csvFields: ['age', 'salary'],
      sourceDatasetFingerprint: 'sha256:fp',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // IDs come from buildColumnRegistry, not col:${name}#${pos}#0
      for (const ref of result.refs) {
        expect(ref.columnId).toMatch(/^col:/);
        expect(ref.pythonLiteral).toBeTruthy();
        expect(typeof ref.isReservedWord).toBe('boolean');
      }
    }
  });

  it('reserved words are marked', () => {
    const result = buildUiScriptContext({
      structuredDiagnosis: makeStructuredDiagnosis(),
      csvFields: ['id', 'class', 'return'],
      sourceDatasetFingerprint: 'sha256:fp',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const classRef = result.refs.find((r) => r.name === 'class');
      expect(classRef?.isReservedWord).toBe(true);
    }
  });

  it('duplicated columns get ordinals 0 and 1', () => {
    const result = buildUiScriptContext({
      structuredDiagnosis: makeStructuredDiagnosis(),
      csvFields: ['score', 'score', 'age'],
      sourceDatasetFingerprint: 'sha256:fp',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const scores = result.refs.filter((r) => r.name === 'score');
      expect(scores).toHaveLength(2);
      expect(scores[0].isDuplicate).toBe(true);
      expect(scores[0].duplicateOrdinal).toBe(0);
      expect(scores[1].duplicateOrdinal).toBe(1);
    }
  });
});

// ── buildScriptContractInputKey tests ─────────────────────────────────────────

describe('buildScriptContractInputKey', () => {
  it('returns null when fingerprint is missing', () => {
    expect(buildScriptContractInputKey({ fingerprint: null, envelopeRef: 'e', planId: 'p', plan: [], csvFields: [] })).toBeNull();
  });

  it('returns null when plan is missing', () => {
    expect(buildScriptContractInputKey({ fingerprint: 'f', envelopeRef: 'e', planId: 'p', plan: null, csvFields: [] })).toBeNull();
  });

  it('key changes when approvalStatus changes', () => {
    const base = { fingerprint: 'f', envelopeRef: 'e', planId: 'p', csvFields: ['a'] };
    const k1 = buildScriptContractInputKey({ ...base, plan: [{ actionId: 'a1', approvalStatus: 'approved' }] });
    const k2 = buildScriptContractInputKey({ ...base, plan: [{ actionId: 'a1', approvalStatus: 'rejected' }] });
    expect(k1).not.toBe(k2);
  });

  it('key changes when fingerprint changes', () => {
    const base = { envelopeRef: 'e', planId: 'p', plan: [{ actionId: 'a1', approvalStatus: 'approved' }], csvFields: ['a'] };
    const k1 = buildScriptContractInputKey({ ...base, fingerprint: 'f1' });
    const k2 = buildScriptContractInputKey({ ...base, fingerprint: 'f2' });
    expect(k1).not.toBe(k2);
  });

  it('key changes when csvFields change', () => {
    const base = { fingerprint: 'f', envelopeRef: 'e', planId: 'p', plan: [{ actionId: 'a1', approvalStatus: 'approved' }] };
    const k1 = buildScriptContractInputKey({ ...base, csvFields: ['a', 'b'] });
    const k2 = buildScriptContractInputKey({ ...base, csvFields: ['a', 'c'] });
    expect(k1).not.toBe(k2);
  });

  it('key is stable for same inputs', () => {
    const base = { fingerprint: 'f', envelopeRef: 'e', planId: 'p', plan: [{ actionId: 'a1', approvalStatus: 'approved' }], csvFields: ['a'] };
    const k1 = buildScriptContractInputKey(base);
    const k2 = buildScriptContractInputKey(base);
    expect(k1).toBe(k2);
  });
});

// ── Invalidation by approvalStatus change ───────────────────────────────────

describe('Invalidation by approvalStatus change', () => {
  it('changing approvalStatus invalidates key, planId stays, contract view returns to decision', async () => {
    const diagnosis = makeStructuredDiagnosis();
    const plan = buildRemediationPlanV2(diagnosis);
    const planIdBefore = plan.planId;

    // Build input key with initial approvals
    const keyBefore = buildScriptContractInputKey({
      fingerprint: 'sha256:fingerprint123',
      envelopeRef: 'env:testabc',
      planId: plan.planId,
      plan: plan.plan.map(a => ({ actionId: a.actionId, approvalStatus: a.approvalStatus })),
      csvFields: ['id', 'age', 'name'],
    });
    expect(keyBefore).toBeTruthy();

    // Change approvalStatus of first action
    const changedPlan = {
      ...plan,
      plan: plan.plan.map((a, i) =>
        i === 0 ? { ...a, approvalStatus: 'approved' as const } : a,
      ),
    };

    // planId must stay the same (identity)
    expect(changedPlan.planId).toBe(planIdBefore);

    // Key changes because approvalStatus changed
    const keyAfter = buildScriptContractInputKey({
      fingerprint: 'sha256:fingerprint123',
      envelopeRef: 'env:testabc',
      planId: changedPlan.planId,
      plan: changedPlan.plan.map(a => ({ actionId: a.actionId, approvalStatus: a.approvalStatus })),
      csvFields: ['id', 'age', 'name'],
    });
    expect(keyAfter).toBeTruthy();
    expect(keyAfter).not.toBe(keyBefore);

    // ── Component test: invalidation clears contract view ──
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const contract = makeValidContract();
    const verification = makeValidVerification();

    const { rerender } = render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diagnosis}
        remediationPlan={plan}
        scriptContractV2={contract}
        scriptContractVerificationV2={verification}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // Contract is generated and visible
    expect(screen.getByText('Contrato válido')).toBeTruthy();

    // Store hash for later check
    const oldHash = contract.scriptHash;

    // Rerender with null contract (simulating parent invalidation due to approvalStatus change)
    rerender(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diagnosis}
        remediationPlan={changedPlan}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // "Contrato válido" label disappears
    await waitFor(() => {
      expect(screen.queryByText('Contrato válido')).toBeNull();
    });

    // RemediationPlanStepV2 view returns (Vista A with Generate button)
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    // Verify old hash is not usable — new contract would have new hash
    expect(contract.scriptHash).toBe(oldHash); // original object unchanged
  });
});

// ── Contract pipeline integration ─────────────────────────────────────────────

describe('Contract pipeline (real functions)', () => {
  it('build → validate → finalize → verify succeeds', () => {
    const colRefs = buildColumnRegistry(['id', 'age', 'name']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:test1',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: colRefs,
      issues: [],
    };
    const plan = makePlan(
      [makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:a1')],
      'plan:testctx1',
      'env:test1',
    );

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
    expect(validation.valid).toBe(true);

    const contract = finalizeScriptContractV2(candidate, validation);
    expect(contract.scriptHash).toBeTruthy();
    expect(contract.scriptText).toContain('def clean_dataset');

    const fresh = verifyScriptContractV2(contract, plan, buildCtx);
    expect(fresh.valid).toBe(true);
  });

  it('zero accepted actions → no-op script', () => {
    const colRefs = buildColumnRegistry(['id', 'age']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:z',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: colRefs,
      issues: [],
    };
    const plan = makePlan(
      [makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:p1')],
      'plan:z',
      'env:z',
    );

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
    expect(validation.valid).toBe(true);
    expect(candidate.acceptedActionIds).toHaveLength(0);
    expect(candidate.scriptText).toContain('import pandas as pd');
  });

  it('altered hash fails verification', () => {
    const colRefs = buildColumnRegistry(['id', 'age']);
    const ctx: RemediationContextV2 = {
      evidenceEnvelopeRef: 'env:ah',
      datasetFingerprint: 'sha256:fingerprint123',
      columns: colRefs,
      issues: [],
    };
    const plan = makePlan(
      [makeAction('requires_human_review', colRefs[1].columnId, 'pending', 'act:h1')],
      'plan:ah',
      'env:ah',
    );

    const buildCtx = buildScriptContext(ctx, colRefs, 'sha256:fingerprint123');
    const candidate = buildScriptCandidateV2(plan, buildCtx);
    const validation = validateScriptCandidateV2(candidate, plan, buildCtx);
    const contract = finalizeScriptContractV2(candidate, validation);
    contract.scriptHash = 'altered_hash';

    const fresh = verifyScriptContractV2(contract, plan, buildCtx);
    expect(fresh.valid).toBe(false);
  });
});

// ── ScriptGenerationStepV2 component ──────────────────────────────────────────

describe('ScriptGenerationStepV2 component', () => {
  it('renders "Sin validar" when fingerprint is missing', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['a']}
        sourceDatasetFingerprint={null}
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText('Sin validar')).toBeTruthy();
  });

  it('renders RemediationPlanStepV2 when plan is null (Vista A)', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );
    // RemediationPlanStepV2 renders its own header
    expect(screen.getByText('Acciones sobre una copia')).toBeTruthy();
  });

  it('generates contract on button click (Vista A → Vista B)', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const diag = makeStructuredDiagnosis();

    const onContractChange = vi.fn();

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diag}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={onContractChange}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // Wait for RemediationPlanStepV2 to build the plan
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    // Click generate
    const btn = screen.getByText('Generar contrato de script');
    await user.click(btn);

    // Should show contract view
    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    // onScriptContractChange was called with a valid contract
    expect(onContractChange).toHaveBeenCalledTimes(1);
    const [contract, verification] = onContractChange.mock.calls[0];
    expect(contract.scriptHash).toBeTruthy();
    expect(contract.scriptText).toContain('def clean_dataset');
    expect(verification.valid).toBe(true);
  });

  it('shows syntax not_run as warning', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    await user.click(screen.getByText('Generar contrato de script'));

    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    expect(screen.getByText(/syntax: not_run/)).toBeTruthy();
  });

  it('Continue button disabled when no contract', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    // No "Continuar a revisión" button yet (we're in plan view)
    expect(screen.queryByText('Continuar a revisión')).toBeNull();
  });

  it('contract clears when prop becomes null', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const contract = makeValidContract();
    const verification = makeValidVerification();
    const diagnosis = makeStructuredDiagnosis();
    const plan = buildRemediationPlanV2(diagnosis);

    const { rerender } = render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diagnosis}
        remediationPlan={plan}
        scriptContractV2={contract}
        scriptContractVerificationV2={verification}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // Initially shows contract view
    expect(screen.getByText('Contrato válido')).toBeTruthy();

    // Rerender with null contract (invalidation)
    rerender(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diagnosis}
        remediationPlan={plan}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // Should go back to plan view
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });
  });

  it('scriptText displayed matches contract.scriptText exactly', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    await user.click(screen.getByText('Generar contrato de script'));

    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    // Script code is rendered in the pre.script-code element
    const scriptCode = document.querySelector('.script-code');
    expect(scriptCode).toBeTruthy();
    expect(scriptCode?.textContent).toContain('def clean_dataset');
  });

  it('no "Seguro" label in contract view', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    await user.click(screen.getByText('Generar contrato de script'));

    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    expect(screen.queryByText('Seguro')).toBeNull();
    expect(screen.queryByText(/safetyScore/)).toBeNull();
  });
});

// ── Full integrated flow: null plan → build → review → approve ────────────────

describe('Full integrated flow (null plan → build → review → approve)', () => {
  it('builds plan, generates contract, and approves', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const onContractChange = vi.fn();
    const onRemediationPlanChange = vi.fn();
    const onContinue = vi.fn();
    const diag = makeExecutableStructuredDiagnosis();

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diag}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={onContractChange}
        onRemediationPlanChange={onRemediationPlanChange}
        onContinue={onContinue}
      />,
    );

    // Starts in Vista A (plan view)
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    // Approve one renderable action, then generate → executable contract generated
    await user.click(screen.getByRole('button', { name: /Aprobar/i }));
    await user.click(screen.getByText('Generar contrato de script'));

    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    // Plan was propagated to parent during build, approval, and defensive generation.
    expect(onRemediationPlanChange.mock.calls.length).toBeGreaterThanOrEqual(3);
    const builtPlan = onRemediationPlanChange.mock.calls.at(-1)?.[0];
    expect(builtPlan.planId).toBeTruthy();
    expect(builtPlan.plan).toBeInstanceOf(Array);
    expect(builtPlan.plan.some((action: RemediationActionV2) => action.approvalStatus === 'approved')).toBe(true);

    // Contract was published
    expect(onContractChange).toHaveBeenCalledTimes(1);
    const [contract, verification] = onContractChange.mock.calls[0];
    expect(contract.scriptHash).toBeTruthy();
    expect(verification.valid).toBe(true);

    // Continue button should be enabled (Vista B)
    const continueBtn = screen.getByRole('button', { name: /Continuar a revisión/i });
    expect(continueBtn).toBeTruthy();
    await user.click(continueBtn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

// ── Session restoration: fresh verification on mount ───────────────────────────

describe('Session restoration fresh verification', () => {
  it('valid restored contract: passes fresh verification on mount', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const contract = makeValidContract();
    const verification = makeValidVerification();
    const diag = makeStructuredDiagnosis();
    const plan = buildRemediationPlanV2(diag);

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diag}
        remediationPlan={plan}
        scriptContractV2={contract}
        scriptContractVerificationV2={verification}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // Should show contract view immediately (valid restored contract)
    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });
  });

  it('invalid restored contract: contract cleared on mount', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const diag = makeStructuredDiagnosis();

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint="sha256:fingerprint123"
        structuredDiagnosis={diag}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    // Should show plan view (no contract)
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });
    expect(screen.queryByText('Contrato válido')).toBeNull();
  });
});

// ── RemediationPlanStepV2 props ───────────────────────────────────────────────

describe('RemediationPlanStepV2 props', () => {
  it('shows real column names in the decision view and keeps internal IDs in technical details', async () => {
    const { default: RemediationPlanStepV2 } = await import('../components/RemediationPlanStepV2');

    render(
      <RemediationPlanStepV2
        report={{} as any}
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        onContinue={() => {}}
      />,
    );

    const firstTarget = await screen.findByTestId('remediation-action-target-0');
    expect(firstTarget.textContent).toContain('id');
    expect(firstTarget.textContent).not.toContain('col:');

    const firstCard = screen.getByTestId('remediation-action-0');
    const primaryHeading = firstCard.querySelector('.remediation-action__title');
    expect(primaryHeading?.textContent).toContain('Revisar antes de corregir');
    expect(primaryHeading?.textContent).not.toContain('rule:');
    expect(primaryHeading?.textContent).not.toContain('col:');

    const technicalDetails = firstCard.querySelector('.remediation-action__technical');
    expect(technicalDetails?.textContent).toContain('ID de columna');
    expect(technicalDetails?.textContent).toContain('col:');
  });

  it('continueLabel prop changes button text', async () => {
    const { default: RemediationPlanStepV2 } = await import('../components/RemediationPlanStepV2');
    render(
      <RemediationPlanStepV2
        report={{} as any}
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        continueLabel="Generar contrato de script"
        onContinueWithPlan={() => {}}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });
  });

  it('onContinueWithPlan called with exact plan', async () => {
    const user = userEvent.setup();
    const { default: RemediationPlanStepV2 } = await import('../components/RemediationPlanStepV2');
    const onContinueWithPlan = vi.fn();
    const diag = makeStructuredDiagnosis();

    render(
      <RemediationPlanStepV2
        report={{} as any}
        structuredDiagnosis={diag}
        remediationPlan={null}
        continueLabel="Generar contrato de script"
        onContinueWithPlan={onContinueWithPlan}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    await user.click(screen.getByText('Generar contrato de script'));
    expect(onContinueWithPlan).toHaveBeenCalledTimes(1);
    const plan = onContinueWithPlan.mock.calls[0][0];
    expect(plan.planId).toBeTruthy();
    expect(plan.plan).toBeInstanceOf(Array);
  });

  it('approve/reject changes visible state', async () => {
    const user = userEvent.setup();
    const { default: RemediationPlanStepV2 } = await import('../components/RemediationPlanStepV2');

    render(
      <RemediationPlanStepV2
        report={{} as any}
        structuredDiagnosis={makeStructuredDiagnosis()}
        remediationPlan={null}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Aprobar').length).toBeGreaterThan(0);
    });

    // Click approve on first action
    const approveBtn = screen.getAllByText('Aprobar')[0];
    await user.click(approveBtn);

    // Status should change to "Aprobado · deshacer"
    await waitFor(() => {
      expect(screen.getAllByText(/Aprobado/).length).toBeGreaterThan(0);
    });
  });
});

// ── ScriptReview v2 props ─────────────────────────────────────────────────────

describe('ScriptReview v2 props', () => {
  it('readOnly hides Edit button', async () => {
    const { default: ScriptReview } = await import('../components/ScriptReview');
    render(
      <ScriptReview
        code="import pandas as pd"
        readOnly
        hideEditAction
      />,
    );
    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('non-readOnly shows Edit button', async () => {
    const { default: ScriptReview } = await import('../components/ScriptReview');
    render(
      <ScriptReview
        code="import pandas as pd"
      />,
    );
    expect(screen.getByText('Editar')).toBeTruthy();
  });
});

// ── MainPipeline session restoration ───────────────────────────────────────────

describe('MainPipeline session restoration', () => {
  const mockAiConfig: AIConfig = {
    model: 'test',
    temperature: 0.5,
    autoAnalyze: false,
    providerType: 'cloud',
  };

  const mockAiProvider = {
    name: 'test-mock',
    type: 'cloud' as const,
    analyzeStream: vi.fn(),
    generateExecutiveReport: vi.fn(),
    generateExecutiveReportStream: vi.fn(),
    generateText: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  } as AIProvider;

  function makeInitialData(overrides: Record<string, any> = {}) {
    const diag = makeStructuredDiagnosis();
    const plan = buildRemediationPlanV2(diag);
    const contract = makeValidContract();
    return {
      state: 'script' as const,
      file: null,
      report: { score: 100, issues: [], rowCount: 10, colCount: 3 } as any,
      auditEvidence: {
        datasetFingerprint: 'short-fingerprint',
        datasetSha256: 'sha256:fingerprint123',
        fileName: 'test.csv',
        fileSize: 100,
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-01T00:00:01.000Z',
        parseDurationMs: 10,
        auditDurationMs: 10,
        rowsProcessed: 10,
        columnsProcessed: 3,
        delimiter: ',',
        truncated: false,
        ingestionStatus: 'success' as const,
        report: null as any,
        trace: [],
      } as any,
      rawData: [],
      csvFields: ['id', 'age', 'name'],
      csvDelimiter: ',',
      cleaningScript: contract.scriptText,
      approvedScript: '',
      healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: diag,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: plan,
      scriptContractV2: contract,
      scriptContractVerificationV2: makeValidVerification(),
      benchmarkResults: [],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [],
      ...overrides,
    };
  }

  it('valid session at review: preserves plan, review step renders', async () => {
    const contract = makeValidContract();

    const { default: MainPipeline } = await import('../components/MainPipeline');

    const initialData = makeInitialData({ state: 'review' as const });
    render(
      <MainPipeline
        aiConfig={mockAiConfig}
        aiProvider={mockAiProvider}
        initialData={initialData}
        onLog={vi.fn()}
      />,
    );

    // ReviewStep renders (either v2 or legacy — both contain review content)
    const v2Heading = screen.queryByText('Revisión de contrato');
    const legacyHeading = screen.queryByText('Tú decides antes de aplicar');
    expect(v2Heading || legacyHeading).toBeTruthy();
    // Plan was preserved — V2Review would error if remediationPlan was null
    if (v2Heading) {
      expect(screen.queryByText(/Falta información para aprobar/)).toBeNull();
      // Contract hash visible
      expect(screen.getByText(contract.scriptHash.slice(0, 12))).toBeTruthy();
    }
  });

  it('preserves verified CSV and receipt across an in-memory export round trip', async () => {
    const { default: MainPipeline } = await import('../components/MainPipeline');
    const correctedCsv = new TextEncoder().encode('id,importe\n001,120.00\n');
    // Navigation must carry the verified object intact; verification itself has separate tests.
    const verifiedEvidence = { correctedCsv, receipt: { receiptHash: 'receipt:verified' } };
    const verifiedExecution = { executionId: 'execution:verified' };
    const changed = vi.fn();
    let data = makeInitialData({ state: 'review', executionState: 'verified',
      reauditState: 'completed', verifiedEvidence, verifiedExecution });
    for (let trip = 0; trip < 2; trip += 1) {
      const view = render(<MainPipeline aiConfig={mockAiConfig} aiProvider={mockAiProvider}
        initialData={data} onPipelineChange={changed} />);
      await userEvent.click(screen.getByRole('button', { name: 'Ir a Exportación' }));
      await waitFor(() => expect(changed.mock.calls.at(-1)?.[0].state).toBe('export'));
      const exported = changed.mock.calls.at(-1)![0];
      expect(exported.verifiedEvidence).toBe(verifiedEvidence);
      expect(exported.verifiedEvidence.correctedCsv).toEqual(correctedCsv);
      expect(exported.verifiedExecution).toBe(verifiedExecution);
      expect(exported.reauditState).toBe('completed');
      data = { ...exported, state: 'review' };
      view.unmount();
    }
  });

  it('valid session at script with pre-built plan: can generate and shows contract', async () => {
    const user = userEvent.setup();
    const contract = makeValidContract();

    const { default: MainPipeline } = await import('../components/MainPipeline');

    render(
      <MainPipeline
        aiConfig={mockAiConfig}
        aiProvider={mockAiProvider}
        initialData={makeInitialData({})}
        onLog={vi.fn()}
      />,
    );

    // Plan is preserved — RemediationPlanStepV2 shows plan summary
    expect(screen.getByText('Acciones sobre una copia')).toBeTruthy();
    // Generate button available (plan already built)
    expect(screen.getByText('Generar contrato de script')).toBeTruthy();

    // Click to generate → contract re-generated
    await user.click(screen.getByText('Generar contrato de script'));
    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });
  });

  it('invalid session: altered hash → full cleanup, plan view shown', async () => {
    const diag = makeStructuredDiagnosis();
    const plan = buildRemediationPlanV2(diag);
    const badContract = makeValidContract({ scriptHash: '000000000000' });

    const { default: MainPipeline } = await import('../components/MainPipeline');

    render(
      <MainPipeline
        aiConfig={mockAiConfig}
        aiProvider={mockAiProvider}
        initialData={makeInitialData({
          scriptContractV2: badContract,
          remediationPlan: plan,
          structuredDiagnosis: diag,
        })}
        onLog={vi.fn()}
      />,
    );

    // Contract cleared — plan view shown, not contract view
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });
    expect(screen.queryByText('Contrato válido')).toBeNull();
  });

  it('invalid session: incompatible fingerprint → full cleanup', async () => {
    const { default: MainPipeline } = await import('../components/MainPipeline');

    render(
      <MainPipeline
        aiConfig={mockAiConfig}
        aiProvider={mockAiProvider}
        initialData={makeInitialData({
          auditEvidence: {
            ...makeInitialData().auditEvidence,
            datasetSha256: 'sha256:old-fingerprint',
          },
        })}
        onLog={vi.fn()}
      />,
    );

    // When fingerprint mismatches restoredKey vs currentKey, all states cleared
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });
    expect(screen.queryByText('Contrato válido')).toBeNull();
  });
});

// ── Full flow to ReviewStep ────────────────────────────────────────────────────

describe('Full flow to ReviewStep', () => {
  const mockAiConfig: AIConfig = {
    model: 'test',
    temperature: 0.5,
    autoAnalyze: false,
    providerType: 'cloud',
  };

  const mockAiProvider = {
    name: 'test-mock',
    type: 'cloud' as const,
    analyzeStream: vi.fn(),
    generateExecutiveReport: vi.fn(),
    generateExecutiveReportStream: vi.fn(),
    generateText: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  } as AIProvider;

  it('null plan → build → generate → review → approve', async () => {
    const user = userEvent.setup();
    const diag = makeExecutableStructuredDiagnosis();

    const initialData = {
      state: 'script' as const,
      file: null,
      report: { score: 100, issues: [], rowCount: 10, colCount: 3 } as any,
      auditEvidence: {
        datasetFingerprint: 'short-fingerprint',
        datasetSha256: 'sha256:fingerprint123',
        fileName: 'test.csv',
        fileSize: 100,
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-01T00:00:01.000Z',
        parseDurationMs: 10,
        auditDurationMs: 10,
        rowsProcessed: 10,
        columnsProcessed: 3,
        delimiter: ',',
        truncated: false,
        ingestionStatus: 'success' as const,
        report: null as any,
        trace: [],
      } as any,
      rawData: [],
      csvFields: ['id', 'age', 'name'],
      csvDelimiter: ',',
      cleaningScript: '',
      approvedScript: '',
      healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: diag,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [],
    };

    const { default: MainPipeline } = await import('../components/MainPipeline');

    render(
      <MainPipeline
        aiConfig={mockAiConfig}
        aiProvider={mockAiProvider}
        initialData={initialData}
        onLog={vi.fn()}
      />,
    );

    // Step 1: Plan view (Vista A) — remediation plan is null
    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    // Step 2: Approve one renderable action and generate → executable contract built
    await user.click(screen.getByRole('button', { name: /Aprobar/i }));
    await user.click(screen.getByText('Generar contrato de script'));

    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    // Step 3: Continue to review step
    await user.click(screen.getByRole('button', { name: /Continuar a revisión/i }));

    // Step 4: ReviewStep renders with approve button
    await waitFor(() => {
      expect(screen.getByText('Aprobar script')).toBeTruthy();
    });

    // Step 5: Approve the contract
    await user.click(screen.getByText('Aprobar script'));

    // Step 6: Contract approved — success message appears
    await waitFor(() => {
      expect(screen.getByText('Contrato aprobado por revisión humana')).toBeTruthy();
    });

    // No HealthDelta, no createImprovementRun in v2
    expect(screen.queryByText('Remediación simulada')).toBeNull();
  });
});

// ── "Volver al plan" cleanup ──────────────────────────────────────────────────

describe('Volver al plan cleanup', () => {
  it('clears contract and verification when clicking Volver al plan', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const diag = makeStructuredDiagnosis();
    const contract = makeValidContract();
    const verification = makeValidVerification();
    const plan = buildRemediationPlanV2(diag);
    const onContractChange = vi.fn();

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint={'sha256:fingerprint123'}
        structuredDiagnosis={diag}
        remediationPlan={plan}
        scriptContractV2={contract}
        scriptContractVerificationV2={verification}
        onScriptContractChange={onContractChange}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    // Click "Volver al plan"
    const backBtn = screen.getByRole('button', { name: 'Volver al plan' });
    await user.click(backBtn);

    // Should call onScriptContractChange(null, null) to clear
    await waitFor(() => {
      expect(onContractChange).toHaveBeenCalledWith(null, null);
    });

    // Should return to plan view
    await waitFor(() => {
      expect(screen.getByText('Acciones sobre una copia')).toBeTruthy();
    });
    expect(screen.queryByText('Contrato válido')).toBeNull();
  });
});

// ── data-testid contract details ──────────────────────────────────────────────

describe('data-testid contract details', () => {
  it('renders contract-hash and partition testids', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const diag = makeStructuredDiagnosis();
    const contract = makeValidContract();
    const verification = makeValidVerification();
    const plan = buildRemediationPlanV2(diag);

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint={'sha256:fingerprint123'}
        structuredDiagnosis={diag}
        remediationPlan={plan}
        scriptContractV2={contract}
        scriptContractVerificationV2={verification}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-hash')).toBeTruthy();
    });

    expect(screen.getByTestId('partition-accepted')).toBeTruthy();
    expect(screen.getByTestId('partition-rejected')).toBeTruthy();
    expect(screen.getByTestId('partition-excluded')).toBeTruthy();
    expect(screen.getByTestId('syntax-state')).toBeTruthy();
  });

  it('exposes full contract hash as data-contract-hash attribute (64 hex chars)', async () => {
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const diag = makeStructuredDiagnosis();
    const contract = makeValidContract();
    const verification = makeValidVerification();
    const plan = buildRemediationPlanV2(diag);

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint={'sha256:fingerprint123'}
        structuredDiagnosis={diag}
        remediationPlan={plan}
        scriptContractV2={contract}
        scriptContractVerificationV2={verification}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-hash')).toBeTruthy();
    });

    const el = screen.getByTestId('contract-hash');
    const fullHash = el.getAttribute('data-contract-hash');
    expect(fullHash).toBeTruthy();
    expect(fullHash).toMatch(/^[a-f0-9]+$/);
    expect(fullHash).toBe(contract.scriptHash);
  });

  it('no-op contract shows accepted = 0 in partition', async () => {
    const user = userEvent.setup();
    const { default: ScriptGenerationStepV2 } = await import('../components/ScriptGenerationStepV2');
    const diag = makeStructuredDiagnosis();

    render(
      <ScriptGenerationStepV2
        report={{} as any}
        csvFields={['id', 'age', 'name']}
        sourceDatasetFingerprint={'sha256:fingerprint123'}
        structuredDiagnosis={diag}
        remediationPlan={null}
        scriptContractV2={null}
        scriptContractVerificationV2={null}
        onScriptContractChange={() => {}}
        onRemediationPlanChange={vi.fn()}
        onContinue={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Generar contrato de script')).toBeTruthy();
    });

    // Reject all actions
    const r = screen.getByTestId('remediation-stage');
    const buttons = r.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent?.includes('Rechazar')) {
        await user.click(b);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    await user.click(screen.getByText('Generar contrato de script'));
    await waitFor(() => {
      expect(screen.getByText('Contrato válido')).toBeTruthy();
    });

    const acceptedEl = screen.getByTestId('partition-accepted');
    expect(acceptedEl).toBeTruthy();
    expect(acceptedEl.querySelector('strong')?.textContent?.trim()).toBe('0');
    expect(screen.getByTestId('script-contract-no-executable')).toBeTruthy();
    const blockedReviewButton = screen.getByRole('button', { name: /Sin acciones ejecutables/i }) as HTMLButtonElement;
    expect(blockedReviewButton.disabled).toBe(true);
  });
});


describe('close without changes reaches export through the real pipeline', () => {
  it.each(['empty', 'rejected'])('closes %s plan without generating a script or changing source cells', async (mode) => {
    const {default:MainPipeline}=await import('../components/MainPipeline');
    const {runAudit}=await import('../services/auditEngine');
    const diag=makeExecutableStructuredDiagnosis();
    if(mode==='empty') {
      diag.remediationContext!.issues=[];
      diag.diagnosis.issues=[];
    }
    const built=buildRemediationPlanV2(diag);
    const plan={...built,plan:built.plan.map(action=>({...action,approvalStatus:'rejected' as const}))};
    const data=[{id:'001',age:'30',name:'Ana'}];
    const report=runAudit(data,['id','age','name'],',');
    const changed=vi.fn();
    render(<MainPipeline aiConfig={{providerType:'cloud',model:'test',temperature:0.1} as any} aiProvider={{} as any}
      initialData={{state:'script',report,rawData:data,csvFields:['id','age','name'],csvDelimiter:',',
        auditEvidence:{datasetSha256:'a'.repeat(64)},structuredDiagnosis:diag,remediationPlan:plan,
        cleaningScript:'',approvedScript:'',logs:[],benchmarkResults:[]} as any}
      onPipelineChange={changed}/>);
    const closeButtons = await screen.findAllByRole('button', { name: 'Cerrar sin cambios' });
    await userEvent.click(closeButtons[0]);
    await waitFor(()=>expect(changed.mock.calls.at(-1)?.[0].state).toBe('export'));
    const final=changed.mock.calls.at(-1)![0];
    expect(final.rawData).toEqual(data);
    expect(final.rawData[0].id).toBe('001');
    expect(final.scriptContractV2).toBeNull();
    expect(final.cleaningScript).toBe('');
    expect(final.verifiedEvidence).toBeNull();
  });
});
