import { describe, expect, it } from 'vitest';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';
import { evaluateFormalDiagnosisRun } from '../services/benchmark/formalDiagnosisEvaluator';
import type { EvidenceEnvelopeV2 } from '../contracts/llm';

describe('formal diagnosis evaluator', () => {
  it('computes the frozen primary denominator and leaves script evaluation pending', () => {
    const run = createExperimentEvidenceFixture().runs[0];
    run.inputMode = 'prompt_libre';
    run.input.inputMode = 'prompt_libre';
    run.diagnosis!.parsedOutput = {
      contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
      evidenceEnvelopeRef: run.input.evidenceEnvelopeRef,
      responseId: 'response:test',
      issues: [{ issueId: 'issue:city', evidenceRefs: ['ev:city'], hypothesis: 'case', confidence: 0.8, requiresHumanReview: false, limits: [] }],
      diagnosisBlocks: [{ issueId: 'issue:city', ruleId: 'rule:capitalization-chaos', columnId: 'col:city', scope: 'column', observation: 'case', recommendation: 'normalize' }], limitations: [],
      generatedAt: '2026-07-11T12:00:00.000Z',
    };
    const envelope = { columns: [{ columnId: 'col:city', name: 'city' }] } as unknown as EvidenceEnvelopeV2;

    const evaluation = evaluateFormalDiagnosisRun(run, envelope, '2026-07-11T12:05:00.000Z');

    expect(evaluation.diagnosis.primary).toEqual(expect.objectContaining({ tp: 1, fp: 0, fn: 15 }));
    expect(evaluation.diagnosis.primary.f1).toBeGreaterThan(0);
    expect(evaluation.diagnosis.evidenceFidelity).toBeNull();
    expect(evaluation.diagnosis.contractCompliant).toBe(true);
    expect(evaluation.script).toEqual(expect.objectContaining({ contractValid: false, safe: false }));
  });
});
