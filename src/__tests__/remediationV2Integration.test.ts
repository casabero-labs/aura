/**
 * Remediation v2 — Integration Tests.
 * Tests: v2 no LLM, no Python, plan validates, deterministic.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../contracts/llm/contractRegistry', () => ({ isContractsV2Enabled: vi.fn() }));

import { isContractsV2Enabled } from '../contracts/llm';
import { buildRemediationPlanV2 } from '../contracts/llm/remediationBuilderV2';
import { validateRemediationPlanV2 } from '../contracts/llm/remediationValidatorV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import { buildRemediationContext } from '../contracts/llm/remediationContextV2';
import type { AuditReportInput, DiagnosisExecutionResult } from '../contracts/llm';

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
const pp = buildDiagnosisPromptV2(env);
const ctx = buildRemediationContext(env);
ctx.evidenceEnvelopeRef = pp.evidenceEnvelopeRef;
ctx.datasetFingerprint = 'abc123';

const diagExec: DiagnosisExecutionResult = {
  version: 2,
  diagnosis: {
    contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
    evidenceEnvelopeRef: pp.evidenceEnvelopeRef, responseId: 'diag-001',
    issues: [
      { issueId: env.issues[0].issueId, evidenceRefs: env.issues[0].evidenceRefs, hypothesis: 'Test', confidence: 0.9, requiresHumanReview: false, limits: [] },
      { issueId: env.issues[1].issueId, evidenceRefs: env.issues[1].evidenceRefs, hypothesis: 'Test', confidence: 0.85, requiresHumanReview: true, limits: [] },
    ],
    diagnosisBlocks: [
      { issueId: env.issues[0].issueId, ruleId: env.issues[0].ruleId, columnId: env.issues[0].columnId, scope: env.issues[0].scope, observation: 'obs', recommendation: 'rec' },
      { issueId: env.issues[1].issueId, ruleId: env.issues[1].ruleId, columnId: env.issues[1].columnId, scope: env.issues[1].scope, observation: 'obs', recommendation: 'rec' },
    ],
    limitations: [], generatedAt: new Date().toISOString(),
  },
  metrics: { latencyMs: 800, tokensGenerated: 250, model: 'gemini', provider: 'google', isLocal: false },
  promptHash: 'h1', evidenceEnvelopeRef: pp.evidenceEnvelopeRef, promptVersion: '1', rawResponseHash: 'r1',
  remediationContext: ctx,
};

describe('buildRemediationPlanV2 — integration', () => {
  it('uses only diagnosisExecution.remediationContext (no context param)', () => {
    const plan = buildRemediationPlanV2(diagExec);
    expect(plan.plan.length).toBeGreaterThanOrEqual(1);
  });

  it('produces valid plan that passes validator', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const validation = validateRemediationPlanV2(plan, diagExec);
    expect(validation.valid).toBe(true);
  });

  it('deterministic: same input → same planId', () => {
    const p1 = buildRemediationPlanV2(diagExec);
    const p2 = buildRemediationPlanV2(diagExec);
    expect(p1.planId).toBe(p2.planId);
    expect(p1.diagnosisRef).toBe(p2.diagnosisRef);
  });

  it('no Python in plan', () => {
    const plan = buildRemediationPlanV2(diagExec);
    const json = JSON.stringify(plan);
    expect(json).not.toContain('import os');
    expect(json).not.toContain('subprocess');
    expect(json).not.toContain('eval(');
  });

  it('remediationContext is required', () => {
    const noCtx = { ...diagExec, remediationContext: undefined };
    expect(() => buildRemediationPlanV2(noCtx)).toThrow('remediationContext');
  });

  it('approvalStatus initialized as pending', () => {
    const plan = buildRemediationPlanV2(diagExec);
    for (const a of plan.plan) {
      expect(a.approvalStatus).toBe('pending');
    }
  });
});
