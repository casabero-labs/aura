/**
 * Benchmark Evidence Classification Tests — Phase 8 L5
 *
 * Validates:
 *   - attempted_failed: status != 'completed'
 *   - preliminary_valid: completed but missing formal criteria
 *   - formal_valid: all criteria met
 *   - planned: no dataset, no provider, no evidence files
 *   - claims properly gated by classification level
 */

import { describe, expect, it } from 'vitest';
import {
  classifyBenchRun,
  isFormalValid,
  isPreliminaryValid,
  isAttemptedFailed,
  evaluationStatusMessage,
  type BenchRunInput,
} from '../utils/benchmarkEvidenceClassification';

function baseInput(overrides: Partial<BenchRunInput> = {}): BenchRunInput {
  return {
    runId: 'run:test_001',
    datasetId: 'controlled_customers_phase8',
    datasetType: 'controlled_synthetic',
    provider: 'ollama',
    model: 'gemma3:1b',
    executionMode: 'ollama_local',
    inputMode: 'recommended',
    temperature: 0.7,
    startedAt: '2026-07-02T10:00:00Z',
    completedAt: '2026-07-02T10:00:30Z',
    status: 'completed',
    latencyMs: 30000,
    jsonValid: true,
    scriptGenerated: true,
    scriptValid: true,
    hallucinationFlags: [],
    unsupportedClaimsCount: 0,
    phantomColumnsCount: 0,
    repetitions: 3,
    comparativeTableProduced: true,
    limitationsDocumented: true,
    humanReviewPerformed: true,
    evidenceFiles: ['audit.json'],
    ...overrides,
  };
}

// ── attempted_failed ──────────────────────────────────────────────────────

describe('attempted_failed classification', () => {
  it('classifies as attempted_failed when status = api_error', () => {
    const result = classifyBenchRun(baseInput({ status: 'api_error', failureReason: 'No API key' }));
    expect(result.classification).toBe('attempted_failed');
    expect(result.classificationReason).toContain('api_error');
    expect(result.classificationReason).toContain('API key');
  });

  it('classifies as attempted_failed when status = provider_unavailable', () => {
    const result = classifyBenchRun(baseInput({ status: 'provider_unavailable', failureReason: 'Chrome AI not detected' }));
    expect(result.classification).toBe('attempted_failed');
    expect(result.classificationReason).toContain('provider_unavailable');
  });

  it('classifies as attempted_failed when status = timeout', () => {
    const result = classifyBenchRun(baseInput({ status: 'timeout' }));
    expect(result.classification).toBe('attempted_failed');
    expect(result.classificationReason).toContain('timeout');
  });

  it('classifies as attempted_failed when status = model_not_downloaded', () => {
    const result = classifyBenchRun(baseInput({ status: 'model_not_downloaded' }));
    expect(result.classification).toBe('attempted_failed');
    expect(result.classificationReason).toContain('model');
  });

  it('classifies as attempted_failed when status = invalid_output', () => {
    const result = classifyBenchRun(baseInput({ status: 'invalid_output' }));
    expect(result.classification).toBe('attempted_failed');
    expect(result.classificationReason).toContain('invalid');
  });

  it('attempted_failed has no valid evidence claims allowed', () => {
    const result = classifyBenchRun(baseInput({ status: 'api_error' }));
    expect(result.claimsForbidden).toContain('AURA produced valid output');
    expect(result.claimsForbidden).toContain('AURA was benchmarked');
  });
});

// ── planned ───────────────────────────────────────────────────────────────

describe('planned classification', () => {
  it('classifies as planned when no dataset', () => {
    const result = classifyBenchRun(baseInput({ datasetId: '', datasetType: 'none' }));
    expect(result.classification).toBe('planned');
    expect(result.classificationReason).toContain('dataset');
  });

  it('classifies as planned when no provider or model', () => {
    const result = classifyBenchRun(baseInput({ provider: '', model: '' }));
    expect(result.classification).toBe('planned');
  });

  it('classifies as planned when no evidence files', () => {
    const result = classifyBenchRun(baseInput({ evidenceFiles: [] }));
    expect(result.classification).toBe('planned');
  });

  it('planned forbids all benchmark claims', () => {
    const result = classifyBenchRun(baseInput({ evidenceFiles: [] }));
    expect(result.classification).toBe('planned');
    expect(result.claimsForbidden).toContain('AURA was benchmarked');
    expect(result.claimsForbidden).toContain('AURA output exported');
  });
});

// ── preliminary_valid ─────────────────────────────────────────────────────

describe('preliminary_valid classification', () => {
  it('classifies as preliminary_valid when completed but missing repetitions', () => {
    const result = classifyBenchRun(baseInput({ repetitions: 1 }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toContain('repetitions');
  });

  it('classifies as preliminary_valid when missing comparative table', () => {
    const result = classifyBenchRun(baseInput({ comparativeTableProduced: false }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toMatch(/[Cc]omparative table/);
  });

  it('classifies as preliminary_valid when missing limitations', () => {
    const result = classifyBenchRun(baseInput({ limitationsDocumented: false }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toContain('Limitations');
  });

  it('classifies as preliminary_valid when missing human review', () => {
    const result = classifyBenchRun(baseInput({ humanReviewPerformed: false }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toContain('Human review');
  });

  it('classifies as preliminary_valid when hallucinations present', () => {
    const result = classifyBenchRun(baseInput({ hallucinationFlags: ['phantom_col_x'], phantomColumnsCount: 1 }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toContain('hallucinations');
  });

  it('classifies as preliminary_valid when missing latency', () => {
    const result = classifyBenchRun(baseInput({ latencyMs: undefined }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toContain('Latency');
  });

  it('classifies as preliminary_valid when JSON not valid', () => {
    const result = classifyBenchRun(baseInput({ jsonValid: false }));
    expect(result.classification).toBe('preliminary_valid');
    expect(result.classificationReason).toContain('JSON');
  });

  it('preliminary_valid forbids formal benchmark claims', () => {
    const result = classifyBenchRun(baseInput({ repetitions: 1 }));
    expect(result.claimsForbidden).toContain('AURA was formally benchmarked');
    expect(result.claimsForbidden).toContain('Results are a formal benchmark');
    expect(result.claimsForbidden).toContain('AURA is production-ready');
    expect(result.claimsForbidden.some(c => c.includes('generalize'))).toBe(true);
  });

  it('preliminary_valid allows preliminary claims', () => {
    const result = classifyBenchRun(baseInput({ repetitions: 1 }));
    expect(result.claimsAllowed).toContain('AURA produced valid output on controlled dataset');
    expect(result.claimsAllowed.some(c => c.includes('Ollama') || c.includes('gemma3'))).toBe(true);
  });
});

// ── formal_valid ──────────────────────────────────────────────────────────

describe('formal_valid classification', () => {
  it('classifies as formal_valid when all criteria met', () => {
    const result = classifyBenchRun(baseInput());
    expect(result.classification).toBe('formal_valid');
    expect(result.classificationReason).toContain('formal validation criteria met');
  });

  it('formal_valid allows benchmark claims', () => {
    const result = classifyBenchRun(baseInput());
    expect(result.claimsAllowed).toContain('AURA was formally benchmarked with documented protocol');
    expect(result.claimsAllowed).toContain('Results are repeatable with 3+ runs on the same configuration');
  });

  it('formal_valid still forbids production-ready and external validation', () => {
    const result = classifyBenchRun(baseInput());
    expect(result.claimsForbidden).toContain('AURA is production-ready');
    expect(result.claimsForbidden).toContain('Results generalize to all datasets');
    expect(result.claimsForbidden).toContain('External independent validation performed');
  });
});

// ── Helper functions ──────────────────────────────────────────────────────

describe('helper functions', () => {
  it('isFormalValid returns true only for formal_valid', () => {
    expect(isFormalValid(classifyBenchRun(baseInput()))).toBe(true);
    expect(isFormalValid(classifyBenchRun(baseInput({ repetitions: 1 })))).toBe(false);
    expect(isFormalValid(classifyBenchRun(baseInput({ status: 'api_error' })))).toBe(false);
  });

  it('isPreliminaryValid returns true only for preliminary_valid', () => {
    expect(isPreliminaryValid(classifyBenchRun(baseInput({ repetitions: 1 })))).toBe(true);
    expect(isPreliminaryValid(classifyBenchRun(baseInput()))).toBe(false);
    expect(isPreliminaryValid(classifyBenchRun(baseInput({ status: 'timeout' })))).toBe(false);
  });

  it('isAttemptedFailed returns true only for attempted_failed', () => {
    expect(isAttemptedFailed(classifyBenchRun(baseInput({ status: 'timeout' })))).toBe(true);
    expect(isAttemptedFailed(classifyBenchRun(baseInput()))).toBe(false);
    expect(isAttemptedFailed(classifyBenchRun(baseInput({ repetitions: 1 })))).toBe(false);
  });

  it('evaluationStatusMessage includes classification tag', () => {
    expect(evaluationStatusMessage(classifyBenchRun(baseInput()))).toContain('[formal_valid]');
    expect(evaluationStatusMessage(classifyBenchRun(baseInput({ repetitions: 1 })))).toContain('[preliminary_valid]');
    expect(evaluationStatusMessage(classifyBenchRun(baseInput({ status: 'timeout' })))).toContain('[attempted_failed]');
  });
});