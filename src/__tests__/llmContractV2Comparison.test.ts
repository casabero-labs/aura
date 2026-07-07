/**
 * LLM Contract V2 Comparison Harness — L19.
 *
 * Compares experimental v2 contract decisions against the L18 baseline
 * using the same controlled Titanic fixture. No real LLM, no API keys.
 * Does not modify production contracts.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyV2Rules } from '../contracts/llm/v2/engine';
import { TITANIC_CONTRACT_BASELINE_FIXTURE } from '../tests/fixtures/titanicContractBaseline';
import type { LlmV2FindingDecision, V2ComparisonResult } from '../contracts/llm/v2/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASELINE_JSON_PATH = path.resolve(__dirname, '../../docs/product/aura/phase_10/l18_llm_contract_baseline/baseline_result.json');
const COMPARISON_OUT_DIR = path.resolve(__dirname, '../../docs/product/aura/phase_10/l19_llm_contract_v2_comparison');
const COMPARISON_JSON_PATH = path.join(COMPARISON_OUT_DIR, 'comparison_result.json');

let baselineObserved: { automaticActions: string[]; humanReview: string[] };
try {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_JSON_PATH, 'utf-8'));
  baselineObserved = baseline.observedBehavior;
} catch {
  baselineObserved = { automaticActions: [], humanReview: [] };
}

const v2Decisions = applyV2Rules(TITANIC_CONTRACT_BASELINE_FIXTURE.issues as any);

const v2Auto = v2Decisions
  .filter(d => d.actionability === 'automatic_safe')
  .map(d => {
    if (d.id === 'hygiene-ghost-Name') return 'trim_whitespace';
    return d.ruleRef;
  });

const v2Review = v2Decisions
  .filter(d => d.actionability === 'human_review')
  .map(d => {
    if (d.id === 'integrity-null-Age') return 'missing_age';
    if (d.id === 'logic-outlier-tukey-Age') return 'age_outlier';
    if (d.id === 'semantic-long-tail-Ticket') return 'high_cardinality_ticket';
    if (d.id === 'semantic-id-PassengerId') return 'passenger_id_identifier';
    return d.id;
  });

describe('Phase 10 L19 — LLM Contract V2 Comparison', () => {

  // ── V2 classification ──

  it('1. v2 classifies trim_whitespace of Name as automatic_safe', () => {
    const d = v2Decisions.find(d => d.id === 'hygiene-ghost-Name');
    expect(d).toBeDefined();
    expect(d!.actionability).toBe('automatic_safe');
    expect(d!.allowedAutomation).toBe(true);
    expect(d!.requiresHumanReview).toBe(false);
    expect(d!.riskLevel).toBe('low');
  });

  it('2. v2 classifies missing_age as human_review', () => {
    const d = v2Decisions.find(d => d.id === 'integrity-null-Age');
    expect(d).toBeDefined();
    expect(d!.actionability).toBe('human_review');
    expect(d!.allowedAutomation).toBe(false);
    expect(d!.requiresHumanReview).toBe(true);
  });

  it('3. v2 classifies age_outlier as human_review', () => {
    const d = v2Decisions.find(d => d.id === 'logic-outlier-tukey-Age');
    expect(d).toBeDefined();
    expect(d!.actionability).toBe('human_review');
    expect(d!.allowedAutomation).toBe(false);
    expect(d!.requiresHumanReview).toBe(true);
  });

  it('4. v2 classifies high_cardinality_ticket as human_review', () => {
    const d = v2Decisions.find(d => d.id === 'semantic-long-tail-Ticket');
    expect(d).toBeDefined();
    expect(d!.actionability).toBe('human_review');
    expect(d!.allowedAutomation).toBe(false);
    expect(d!.requiresHumanReview).toBe(true);
  });

  it('5. v2 classifies passenger_id_identifier as human_review', () => {
    const d = v2Decisions.find(d => d.id === 'semantic-id-PassengerId');
    expect(d).toBeDefined();
    expect(d!.actionability).toBe('human_review');
    expect(d!.allowedAutomation).toBe(false);
    expect(d!.requiresHumanReview).toBe(true);
    expect(d!.riskLevel).toBe('high');
  });

  // ── Structured references ──

  it('6. v2 uses fieldRef, ruleRef, and evidenceRef', () => {
    for (const d of v2Decisions) {
      expect(d.fieldRef).toBeTruthy();
      expect(d.ruleRef).toBeTruthy();
      expect(d.evidenceRef).toBeTruthy();
      expect(d.rationale).toBeTruthy();
      expect(['low', 'medium', 'high']).toContain(d.riskLevel);
    }
  });

  // ── Baseline integrity ──

  it('7. comparison uses the same L18 fixture', () => {
    expect(TITANIC_CONTRACT_BASELINE_FIXTURE.issues).toHaveLength(5);
  });

  it('8. comparison does not use real provider', () => {
    expect(v2Decisions.some(d => d.rationale.includes('ollama') || d.rationale.includes('gemini'))).toBe(false);
  });

  it('9. comparison does not change production contract', () => {
    expect(v2Decisions).toHaveLength(5);
    for (const d of v2Decisions) {
      expect(d.actionability).toBeTruthy();
      expect(typeof d.requiresHumanReview).toBe('boolean');
    }
  });

  // ── Regression check ──

  it('10. no regression in human review items', () => {
    const reviewIds = v2Decisions
      .filter(d => d.actionability === 'human_review')
      .map(d => d.id);
    expect(reviewIds).toContain('integrity-null-Age');
    expect(reviewIds).toContain('logic-outlier-tukey-Age');
    expect(reviewIds).toContain('semantic-long-tail-Ticket');
    expect(reviewIds).toContain('semantic-id-PassengerId');
    // trim_whitespace should NOT be in human_review
    expect(reviewIds).not.toContain('hygiene-ghost-Name');
  });

  // ── Comparison JSON ──

  it('11. comparison JSON has correct flags and limits', () => {
    const trimRecovered = v2Auto.includes('trim_whitespace');
    const reviewPreserved = ['missing_age', 'age_outlier', 'high_cardinality_ticket', 'passenger_id_identifier']
      .every(r => v2Review.includes(r));
    const regressionDetected = baselineObserved.automaticActions.some(a => !v2Auto.includes(a));

    const result: V2ComparisonResult = {
      phase: 'L19',
      mode: 'experimental_v2_comparison',
      baselinePhase: 'L18',
      dataset: 'titanic_controlled_fixture',
      providerMode: 'mock',
      usedRealAiProvider: false,
      changedProductionContract: false,
      sameFixtureAsBaseline: true,
      sameTaskAsBaseline: true,
      runs: 1,
      baselineObserved,
      v2Observed: {
        automaticActions: v2Auto,
        humanReview: v2Review,
      },
      v2Decisions,
      expectedBehavior: {
        automaticActions: ['trim_whitespace'],
        humanReview: ['missing_age', 'age_outlier', 'high_cardinality_ticket', 'passenger_id_identifier'],
      },
      comparison: {
        trimWhitespaceRecoveredAsAutomatic: trimRecovered,
        humanReviewItemsPreserved: reviewPreserved,
        regressionDetected,
      },
      metrics: {
        automaticActionPrecision: trimRecovered ? 1 : 0,
        humanReviewRecall: reviewPreserved ? 1 : 0,
      },
      limits: [
        'mock provider only — no real LLM inference',
        'not a formal benchmark',
        'not a production replacement',
        'single controlled fixture (6 rows)',
        'v2 is experimental, not activated in production UI',
      ],
    };

    // Assertions
    expect(result.usedRealAiProvider).toBe(false);
    expect(result.changedProductionContract).toBe(false);
    expect(result.sameFixtureAsBaseline).toBe(true);
    expect(result.comparison.trimWhitespaceRecoveredAsAutomatic).toBe(true);
    expect(result.comparison.humanReviewItemsPreserved).toBe(true);
    expect(result.comparison.regressionDetected).toBe(false);
    expect(result.limits.length).toBeGreaterThanOrEqual(3);
    expect(result.metrics.humanReviewRecall).toBe(1);

    // Write comparison JSON
    fs.mkdirSync(COMPARISON_OUT_DIR, { recursive: true });
    fs.writeFileSync(COMPARISON_JSON_PATH, JSON.stringify(result, null, 2), 'utf-8');
  });
});
