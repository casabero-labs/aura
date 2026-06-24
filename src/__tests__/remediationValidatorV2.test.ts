/**
 * Remediation Validator v2 — Unit Tests.
 */
import { describe, it, expect } from 'vitest';
import { validateRemediationPlanV2 } from '../contracts/llm/remediationValidatorV2';
import { buildRemediationPlanV2 } from '../contracts/llm/remediationBuilderV2';
import { buildDiagnosisRef, buildRemediationContext } from '../contracts/llm/remediationContextV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import type { AuditReportInput, DiagnosisExecutionResult } from '../contracts/llm';

const report: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene', ruleName: 'Espacios Fantasma', description: 'ws', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic' } },
  ],
  columnStats: { Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} } },
  datasetProfile: { columns: [{ name: 'Name' }] },
};

const env = _buildEvidenceEnvelopeV2(report, { privacyLevel: 'local_full', datasetSha256: 'abc123', delimiter: ',' });
const pp = buildDiagnosisPromptV2(env);

const diagResponse = {
  contractId: 'aura.diagnosis.v2' as const, contractVersion: '2.0.0' as const,
  evidenceEnvelopeRef: pp.evidenceEnvelopeRef, responseId: 'diag-001',
  issues: [{ issueId: env.issues[0].issueId, evidenceRefs: env.issues[0].evidenceRefs, hypothesis: 'Test', confidence: 0.9, requiresHumanReview: false, limits: [] }],
  diagnosisBlocks: [{ issueId: env.issues[0].issueId, ruleId: env.issues[0].ruleId, columnId: env.issues[0].columnId, scope: env.issues[0].scope, observation: 'obs', recommendation: 'rec' }],
  limitations: [], generatedAt: new Date().toISOString(),
};

const ctx = buildRemediationContext(env);
ctx.evidenceEnvelopeRef = pp.evidenceEnvelopeRef;
ctx.datasetFingerprint = 'abc123';

const diagExec: DiagnosisExecutionResult = {
  version: 2, diagnosis: diagResponse, metrics: { latencyMs: 800, tokensGenerated: 250, model: 'gemini', provider: 'google', isLocal: false },
  promptHash: 'h1', evidenceEnvelopeRef: pp.evidenceEnvelopeRef, promptVersion: '1', rawResponseHash: 'r1',
  remediationContext: ctx,
};

describe('validateRemediationPlanV2 — valid plan', () => {
  it('valid plan passes validation', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const result = validateRemediationPlanV2(plan, diagExec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('validateRemediationPlanV2 — malformed input', () => {
  it('null plan fails', () => {
    const r = validateRemediationPlanV2(null, diagExec);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('string plan fails', () => {
    const r = validateRemediationPlanV2('hello', diagExec);
    expect(r.valid).toBe(false);
  });
  it('array plan fails', () => {
    const r = validateRemediationPlanV2([], diagExec);
    expect(r.valid).toBe(false);
  });
});

describe('validateRemediationPlanV2 — schema violations', () => {
  it('wrong contractId fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, contractId: 'wrong' };
    const r = validateRemediationPlanV2(bad, diagExec);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'REMEDIATION_SCHEMA_INVALID')).toBe(true);
  });
  it('fingerprint altered fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, datasetFingerprint: 'WRONG' };
    const r = validateRemediationPlanV2(bad, diagExec);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'REMEDIATION_REFERENCE_INVALID')).toBe(true);
  });
  it('wrong diagnosisRef fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, diagnosisRef: 'diag:WRONG' };
    expect(validateRemediationPlanV2(bad, diagExec).valid).toBe(false);
  });
});

describe('validateRemediationPlanV2 — action validation', () => {
  it('altered actionId fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, plan: plan.plan.map(a => ({ ...a, actionId: 'act:WRONG' })) };
    const r = validateRemediationPlanV2(bad, diagExec);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'REMEDIATION_ACTION_ID_INVALID')).toBe(true);
  });
  it('duplicate actionId fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    if (plan.plan.length > 0) {
      const dup = { ...plan, plan: [plan.plan[0], plan.plan[0]] };
      expect(validateRemediationPlanV2(dup, diagExec).valid).toBe(false);
    }
  });
  it('approval other than pending/approved/rejected fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, plan: plan.plan.map(a => ({ ...a, approvalStatus: 'invalid' as any })) };
    expect(validateRemediationPlanV2(bad, diagExec).valid).toBe(false);
  });
  it('phantom issueId fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, plan: plan.plan.map(a => ({ ...a, issueId: 'phantom' })) };
    expect(validateRemediationPlanV2(bad, diagExec).valid).toBe(false);
  });
  it('wrong ruleId for issue fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, plan: plan.plan.map(a => ({ ...a, ruleId: 'rule:wrong' })) };
    expect(validateRemediationPlanV2(bad, diagExec).valid).toBe(false);
  });
  it('extra parameter rejected', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = {
      ...plan,
      plan: plan.plan.map(a => ({ ...a, parameters: { ...a.parameters as any, extraField: 'injected' } })),
    };
    const r = validateRemediationPlanV2(bad, diagExec);
    expect(r.valid).toBe(false);
  });
  it('extra action property rejected', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, plan: plan.plan.map(a => ({ ...a, injectedField: 'malicious' })) };
    expect(validateRemediationPlanV2(bad, diagExec).valid).toBe(false);
  });
});

describe('validateRemediationPlanV2 — coverage', () => {
  it('missing action fails', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const bad = { ...plan, plan: [] };
    const r = validateRemediationPlanV2(bad, diagExec);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.code === 'REMEDIATION_COVERAGE_INVALID')).toBe(true);
  });
});
