/**
 * Remediation Builder v2 — Unit Tests.
 */
import { describe, it, expect } from 'vitest';
import { buildRemediationPlanV2, computeEffectiveActionability } from '../contracts/llm/remediationBuilderV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildRemediationContext, buildDiagnosisRef } from '../contracts/llm/remediationContextV2';
import { buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { DiagnosisExecutionResult, RemediationContextV2 } from '../contracts/llm';

const report: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene', ruleName: 'Espacios Fantasma', description: 'ws', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic' } },
    { id: 'integrity-null-Age', column: 'Age', category: 'Integridad', ruleName: 'Valores Nulos', description: 'nulls', severity: 'warning', count: 177, affectedPercentage: 19.9, sampleValues: [null], ruleId: 'rule:null-values', automaticAuthorization: { actionType: 'null_values', authorized: false, conditionsMet: [], reason: 'No auto' } },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} },
    Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
};

const env = _buildEvidenceEnvelopeV2(report, { privacyLevel: 'local_full', datasetSha256: 'abc123', delimiter: ',' });
const ctx = buildRemediationContext(env);
ctx.evidenceEnvelopeRef = buildDiagnosisPromptV2(env).evidenceEnvelopeRef;
ctx.datasetFingerprint = 'abc123';

const diagResponse = {
  contractId: 'aura.diagnosis.v2' as const, contractVersion: '2.0.0' as const,
  evidenceEnvelopeRef: ctx.evidenceEnvelopeRef, responseId: 'diag-001',
  issues: [
    { issueId: env.issues[0].issueId, evidenceRefs: env.issues[0].evidenceRefs, hypothesis: 'Test', confidence: 0.9, requiresHumanReview: false, limits: [] },
    { issueId: env.issues[1].issueId, evidenceRefs: env.issues[1].evidenceRefs, hypothesis: 'Test', confidence: 0.85, requiresHumanReview: true, limits: [] },
  ],
  diagnosisBlocks: [
    { issueId: env.issues[0].issueId, ruleId: env.issues[0].ruleId, columnId: env.issues[0].columnId, scope: env.issues[0].scope, observation: 'obs', recommendation: 'rec' },
    { issueId: env.issues[1].issueId, ruleId: env.issues[1].ruleId, columnId: env.issues[1].columnId, scope: env.issues[1].scope, observation: 'obs', recommendation: 'rec' },
  ],
  limitations: ['test'],
  generatedAt: new Date().toISOString(),
};

const diagExec: DiagnosisExecutionResult = {
  version: 2,
  diagnosis: diagResponse,
  metrics: { latencyMs: 800, tokensGenerated: 250, model: 'gemini', provider: 'google', isLocal: false },
  promptHash: 'h1', evidenceEnvelopeRef: ctx.evidenceEnvelopeRef, promptVersion: '1', rawResponseHash: 'r1',
  remediationContext: ctx,
};

describe('buildDiagnosisRef', () => {
  it('same semantic content → same ref', () => {
    const ref1 = buildDiagnosisRef(diagResponse);
    const ref2 = buildDiagnosisRef({ ...diagResponse });
    expect(ref1).toBe(ref2);
  });

  it('generatedAt change does not affect ref', () => {
    const ref1 = buildDiagnosisRef(diagResponse);
    const ref2 = buildDiagnosisRef({ ...diagResponse, generatedAt: new Date(2020, 0, 1).toISOString() });
    expect(ref1).toBe(ref2);
  });

  it('returns diag: prefixed string', () => {
    const ref = buildDiagnosisRef(diagResponse);
    expect(ref.startsWith('diag:')).toBe(true);
  });
});

describe('buildRemediationPlanV2', () => {
  it('produces valid plan with correct planId', () => {
    const plan = buildRemediationPlanV2(diagExec, ctx);
    expect(plan.contractId).toBe('aura.remediation.v2');
    expect(plan.contractVersion).toBe('2.0.0');
    expect(plan.planId.startsWith('plan:')).toBe(true);
    expect(plan.diagnosisRef.startsWith('diag:')).toBe(true);
    expect(plan.plan.length).toBeGreaterThanOrEqual(1);
    expect(plan.actionabilityMap).toBeDefined();
  });

  it('trim-whitespace rule produces trim_whitespace action', () => {
    const plan = buildRemediationPlanV2(diagExec, ctx);
    const trimAction = plan.plan.find(a => a.ruleId === 'rule:trim-whitespace');
    expect(trimAction).toBeDefined();
    expect(trimAction!.actionType).toBe('trim_whitespace');
  });

  it('null-values rule (unknown in policy) produces requires_human_review', () => {
    const plan = buildRemediationPlanV2(diagExec, ctx);
    const nullAction = plan.plan.find(a => a.ruleId === 'rule:null-values');
    expect(nullAction).toBeDefined();
    expect(nullAction!.actionType).toBe('requires_human_review');
  });

  it('all actions start as pending', () => {
    const plan = buildRemediationPlanV2(diagExec, ctx);
    for (const action of plan.plan) {
      expect(action.approvalStatus).toBe('pending');
    }
  });

  it('same inputs → same planId (deterministic)', () => {
    const p1 = buildRemediationPlanV2(diagExec, ctx);
    const p2 = buildRemediationPlanV2(diagExec, ctx);
    expect(p1.planId).toBe(p2.planId);
  });
});
