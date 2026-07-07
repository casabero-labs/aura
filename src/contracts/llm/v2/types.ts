/**
 * LLM Contracts v2 — Experimental Types.
 *
 * EXPERIMENTAL — not used in production. No real LLMs, no API keys.
 * Lives alongside the current contract pipeline for comparison purposes.
 */
export type LlmActionability =
  | 'automatic_safe'
  | 'human_review'
  | 'informational';

export interface LlmV2FindingDecision {
  id: string;
  fieldRef: string;
  ruleRef: string;
  issueType: string;
  actionability: LlmActionability;
  allowedAutomation: boolean;
  requiresHumanReview: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  evidenceRef: string;
  rationale: string;
}

export interface V2ComparisonResult {
  phase: string;
  mode: string;
  baselinePhase: string;
  dataset: string;
  providerMode: string;
  usedRealAiProvider: boolean;
  changedProductionContract: boolean;
  sameFixtureAsBaseline: boolean;
  sameTaskAsBaseline: boolean;
  runs: number;
  baselineObserved: {
    automaticActions: string[];
    humanReview: string[];
  };
  v2Observed: {
    automaticActions: string[];
    humanReview: string[];
  };
  v2Decisions: LlmV2FindingDecision[];
  expectedBehavior: {
    automaticActions: string[];
    humanReview: string[];
  };
  comparison: {
    trimWhitespaceRecoveredAsAutomatic: boolean;
    humanReviewItemsPreserved: boolean;
    regressionDetected: boolean;
  };
  metrics: {
    automaticActionPrecision: number | null;
    humanReviewRecall: number | null;
  };
  limits: string[];
}
