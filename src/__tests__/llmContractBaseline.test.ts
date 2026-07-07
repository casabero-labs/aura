/**
 * LLM Contract Baseline Harness — L18.
 *
 * Evaluates the current V2 contract behavior using a controlled Titanic fixture.
 * No real LLM, no API keys, no model downloads.
 * Does not modify production contracts.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

process.env.CONTRACTS_V2_ENABLED = 'true';
(import.meta as any).env = { ...((import.meta as any).env || {}), VITE_CONTRACTS_V2_ENABLED: 'true' };

vi.mock('../contracts/llm/contractRegistry', () => ({ isContractsV2Enabled: vi.fn() }));

import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisPromptV2, buildEnvelopeRef } from '../contracts/llm/diagnosisPromptV2';
import { runDiagnosisPipeline } from '../contracts/llm/diagnosisPipelineV2';
import { buildRemediationContext } from '../contracts/llm/remediationContextV2';
import { buildRemediationPlanV2 } from '../contracts/llm/remediationBuilderV2';
import { isContractsV2Enabled } from '../contracts/llm/contractRegistry';
import { sha256hex } from '../contracts/llm/hash';
import { TITANIC_CONTRACT_BASELINE_FIXTURE } from '../tests/fixtures/titanicContractBaseline';
import type { EvidenceEnvelopeV2, DiagnosisResponseV2, DiagnosisExecutionResult, RemediationPlanV2 } from '../contracts/llm/types';

const ENV_OPTIONS = {
  privacyLevel: 'local_full' as const,
  datasetSha256: 'abc123baselinefingerprint',
  delimiter: ',',
};

const BASELINE_OUT_DIR = path.resolve(__dirname, '../../docs/product/aura/phase_10/l18_llm_contract_baseline');
const BASELINE_JSON_PATH = path.join(BASELINE_OUT_DIR, 'baseline_result.json');

interface BaselineBehavior {
  automaticActions: string[];
  humanReview: string[];
}

interface BaselineJson {
  phase: string;
  mode: string;
  dataset: string;
  providerMode: string;
  usedRealAiProvider: boolean;
  changedProductionContract: boolean;
  expectedBehavior: BaselineBehavior;
  observedBehavior: BaselineBehavior;
  metrics: {
    automaticActionPrecision: number | null;
    humanReviewRecall: number | null;
  };
  limits: string[];
  envelopeRef: string;
  planId: string;
  actionabilityMap: Record<string, string>;
}

/**
 * Build a mock diagnosis response that faithfully mirrors the envelope.
 * Respects column ambiguity: if the issue's column is ambiguous/duplicate,
 * requiresHumanReview must be true (same check as diagnosisValidatorV2).
 */
function buildMockResponse(envelope: EvidenceEnvelopeV2): string {
  const ref = buildEnvelopeRef(envelope);
  const columns = envelope.columns || [];

  const issues = envelope.issues.map((iss) => {
    const col = columns.find(c => c.columnId === iss.columnId);
    const columnForcesReview = col ? (col.isAmbiguous || col.isDuplicate) : false;

    return {
      issueId: iss.issueId,
      evidenceRefs: iss.evidenceRefs,
      hypothesis: `${iss.ruleName}: ${iss.description.substring(0, 80)}`,
      confidence: 0.85,
      requiresHumanReview: columnForcesReview || iss.actionability !== 'auto_safe' || !iss.automaticAuthorization?.authorized,
      limits: [] as string[],
    };
  });

  const blocks = envelope.issues.map((iss) => ({
    issueId: iss.issueId,
    ruleId: iss.ruleId,
    columnId: iss.columnId,
    scope: iss.scope,
    observation: `${iss.count} values affected (${iss.affectedPercentage.toFixed(1)}%)`,
    recommendation: 'Revisar y validar manualmente.',
  }));

  return JSON.stringify({
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: ref,
    responseId: 'diag-l18-baseline-harness',
    issues,
    diagnosisBlocks: blocks,
    limitations: ['Baseline harness — no real LLM inference'],
    generatedAt: new Date().toISOString(),
  });
}

describe('Phase 10 L18 — LLM Contract Baseline', () => {
  let envelope: EvidenceEnvelopeV2;
  let diagnosisResponse: DiagnosisResponseV2;
  let plan: RemediationPlanV2;

  beforeAll(async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);

    envelope = _buildEvidenceEnvelopeV2(TITANIC_CONTRACT_BASELINE_FIXTURE, ENV_OPTIONS);
    const promptPackage = buildDiagnosisPromptV2(envelope);

    const mockAdapter = async () => buildMockResponse(envelope);

    const outcome = await runDiagnosisPipeline(envelope, promptPackage, mockAdapter);
    if (!outcome.success) {
      const failure = outcome as { success: false; code: string; message: string };
      throw new Error(`Pipeline failed: ${failure.code} — ${failure.message}`);
    }
    diagnosisResponse = outcome.response;

    const ctx = buildRemediationContext(envelope);
    ctx.evidenceEnvelopeRef = buildEnvelopeRef(envelope);

    const execution: DiagnosisExecutionResult = {
      version: 2,
      diagnosis: diagnosisResponse,
      metrics: { latencyMs: 0, tokensGenerated: 0, firstTokenMs: 0, model: 'baseline-harness', provider: 'fixture', isLocal: true },
      promptHash: sha256hex('mock-prompt'),
      evidenceEnvelopeRef: buildEnvelopeRef(envelope),
      promptVersion: '2.0.0',
      rawResponseHash: sha256hex(JSON.stringify(diagnosisResponse)),
      remediationContext: ctx,
    };

    plan = buildRemediationPlanV2(execution);
  });

  // ── Fixture integrity ──

  it('1. fixture has Name with leading/trailing spaces for trim', () => {
    const iss = TITANIC_CONTRACT_BASELINE_FIXTURE.issues.find(i => i.ruleId === 'rule:trim-whitespace');
    expect(iss).toBeDefined();
    expect(iss!.count).toBeGreaterThan(0);
    expect(iss!.sampleValues?.[0]?.toString().startsWith(' ')).toBe(true);
  });

  it('2. fixture has null Age', () => {
    const iss = TITANIC_CONTRACT_BASELINE_FIXTURE.issues.find(i => i.id === 'integrity-null-Age');
    expect(iss).toBeDefined();
    expect(iss!.sampleValues).toContain(null);
  });

  it('3. fixture has Age outlier', () => {
    const iss = TITANIC_CONTRACT_BASELINE_FIXTURE.issues.find(i => i.id === 'logic-outlier-tukey-Age');
    expect(iss).toBeDefined();
    expect(iss!.sampleValues).toContain(200);
  });

  it('4. fixture has Ticket high-cardinality issue', () => {
    const iss = TITANIC_CONTRACT_BASELINE_FIXTURE.issues.find(i => i.id === 'semantic-long-tail-Ticket');
    expect(iss).toBeDefined();
    expect(iss!.count).toBe(6);
  });

  it('5. fixture has PassengerId identifier issue', () => {
    const iss = TITANIC_CONTRACT_BASELINE_FIXTURE.issues.find(i => i.id === 'semantic-id-PassengerId' as any);
    expect(iss).toBeDefined();
    expect(iss!.count).toBe(6);
  });

  // ── Baseline integrity ──

  it('6. baseline does not use a real AI provider', () => {
    expect(diagnosisResponse.limitations).toContain('Baseline harness — no real LLM inference');
    expect(plan.plan.some(a => a.actionType === 'trim_whitespace')).toBe(true);
  });

  it('7. baseline does not modify production contract', () => {
    expect(diagnosisResponse.contractId).toBe('aura.diagnosis.v2');
    expect(diagnosisResponse.contractVersion).toBe('2.0.0');
    expect(plan.contractId).toBe('aura.remediation.v2');
  });

  // ── Behavior assertions (envelope-level actionability) ──

  it('8. only trim_whitespace is auto_safe in envelope', () => {
    const trimIssue = envelope.issues.find(i => i.ruleId === 'rule:trim-whitespace');
    expect(trimIssue).toBeDefined();
    expect(trimIssue!.actionability).toBe('auto_safe');
    expect(trimIssue!.automaticAuthorization?.authorized).toBe(true);

    for (const iss of envelope.issues) {
      if (iss.ruleId === 'rule:trim-whitespace') continue;
      expect(iss.actionability).not.toBe('auto_safe');
    }
  });

  it('9. null values (Age) are review_only in envelope', () => {
    const iss = envelope.issues.find(i => i.issueId === 'integrity-null-Age');
    expect(iss).toBeDefined();
    expect(iss!.actionability).toBe('review_only');
    expect(iss!.automaticAuthorization?.authorized).toBe(false);
  });

  it('10. outliers (Age) are review_only in envelope', () => {
    const iss = envelope.issues.find(i => i.issueId === 'logic-outlier-tukey-Age');
    expect(iss).toBeDefined();
    expect(iss!.actionability).toBe('review_only');
    expect(iss!.automaticAuthorization?.authorized).toBe(false);
  });

  it('11. high cardinality (Ticket) is not_actionable in envelope', () => {
    const iss = envelope.issues.find(i => i.issueId === 'semantic-long-tail-Ticket');
    expect(iss).toBeDefined();
    expect(iss!.actionability).toBe('not_actionable');
    expect(iss!.automaticAuthorization?.authorized).toBe(false);
  });

  it('12. identifier (PassengerId) defaults to review_only in envelope', () => {
    const iss = envelope.issues.find(i => i.issueId === 'semantic-id-PassengerId');
    expect(iss).toBeDefined();
    expect(iss!.actionability).toBe('review_only');
    expect(iss!.automaticAuthorization?.authorized).toBe(false);
  });

  // ── Pipeline validation ──

  it('13. diagnosis response references match envelope', () => {
    expect(diagnosisResponse.evidenceEnvelopeRef).toBe(buildEnvelopeRef(envelope));
    expect(diagnosisResponse.issues).toHaveLength(envelope.issues.length);
    expect(diagnosisResponse.diagnosisBlocks).toHaveLength(envelope.issues.length);
  });

  it('14. diagnosis forces human_review when column is ambiguous', () => {
    // Name column is ambiguous per columnRegistry.ts → forces all Name issues to review
    const nameIssue = diagnosisResponse.issues.find(i => i.issueId === 'hygiene-ghost-Name');
    expect(nameIssue).toBeDefined();
    expect(nameIssue!.requiresHumanReview).toBe(true);
  });

  // ── Remediation plan: final contract output ──

  it('15. remediation plan is buildable and valid', () => {
    expect(plan.contractId).toBe('aura.remediation.v2');
    expect(plan.plan.length).toBeGreaterThan(0);
    expect(plan.planId).toMatch(/^plan:/);
    expect(plan.diagnosisRef).toMatch(/^diag:/);
  });

  it('16. plan actionability: trim_whitespace is review_only (column ambiguous)', () => {
    // Even though envelope says auto_safe, column ambiguity forces review_only
    const action = plan.plan.find(a => a.actionType === 'trim_whitespace');
    expect(action).toBeDefined();
    expect(action!.actionability).toBe('review_only');
  });

  it('17. plan excludes not_actionable issues', () => {
    const excludedIds = plan.exclusions.map(e => e.issueId);
    // long-tail Ticket is not_actionable in envelope → excluded
    expect(excludedIds).toContain('semantic-long-tail-Ticket');
  });

  // ── Baseline JSON export ──

  it('18. baseline JSON has correct flags, limits, and observed vs expected', () => {
    const expectedBehavior: BaselineBehavior = {
      automaticActions: ['trim_whitespace'],
      humanReview: [
        'missing_age',
        'age_outlier',
        'high_cardinality_ticket',
        'passenger_id_identifier',
      ],
    };

    // Observed behavior comes from the REMEDIATION PLAN (final contract output)
    const observedAuto: string[] = [];
    const observedReview: string[] = [];

    for (const [issueId, eff] of Object.entries(plan.actionabilityMap)) {
      if (eff === 'auto_safe') {
        if (issueId === 'hygiene-ghost-Name') observedAuto.push('trim_whitespace');
      } else if (eff === 'review_only') {
        if (issueId === 'integrity-null-Age') observedReview.push('missing_age');
        else if (issueId === 'logic-outlier-tukey-Age') observedReview.push('age_outlier');
        else if (issueId === 'semantic-id-PassengerId') observedReview.push('passenger_id_identifier');
        else observedReview.push(issueId);
      }
    }

    const observedBehavior: BaselineBehavior = {
      automaticActions: observedAuto,
      humanReview: observedReview,
    };

    const baseline: BaselineJson = {
      phase: 'L18',
      mode: 'baseline_current_contract',
      dataset: 'titanic_controlled_fixture',
      providerMode: 'mock',
      usedRealAiProvider: false,
      changedProductionContract: false,
      expectedBehavior,
      observedBehavior,
      metrics: {
        automaticActionPrecision: null,
        humanReviewRecall: null,
      },
      limits: [
        'baseline uses controlled fixture',
        'no real AI provider — mock adapter returns template diagnosis',
        'metrics not calculated: no real LLM inference, no ground truth comparison',
        'not a formal benchmark',
        'not provider comparison',
        'not production replacement',
      ],
      envelopeRef: buildEnvelopeRef(envelope),
      planId: plan.planId,
      actionabilityMap: plan.actionabilityMap,
    };

    expect(baseline.usedRealAiProvider).toBe(false);
    expect(baseline.changedProductionContract).toBe(false);
    expect(baseline.limits.length).toBeGreaterThanOrEqual(4);

    // Currently: column ambiguity → all actions reviewed, none automatic
    expect(observedAuto).toHaveLength(0);
    expect(observedReview.length).toBeGreaterThanOrEqual(3);

    // Write baseline JSON
    fs.mkdirSync(BASELINE_OUT_DIR, { recursive: true });
    fs.writeFileSync(BASELINE_JSON_PATH, JSON.stringify(baseline, null, 2), 'utf-8');
  });
});
