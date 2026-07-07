/**
 * LLM Contracts v2 — Decision Engine.
 *
 * EXPERIMENTAL. Applies v2 classification rules to fixture issues.
 * Key improvement over v1: column ambiguity does NOT block
 * reversible, non-destructive automatic actions.
 */
import type { LlmV2FindingDecision, LlmActionability } from './types';

interface FixtureIssue {
  id: string;
  column?: string;
  ruleId: string;
  ruleName: string;
  description: string;
  severity: string;
  sampleValues?: (string | number | null)[];
  automaticAuthorization?: {
    actionType: string;
    authorized: boolean;
    conditionsMet: string[];
    reason: string;
  };
}

const V2_RULE_POLICY: Record<string, {
  actionability: LlmActionability;
  allowedAutomation: boolean;
  requiresHumanReview: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}> = {
  'rule:trim-whitespace': {
    actionability: 'automatic_safe',
    allowedAutomation: true,
    requiresHumanReview: false,
    riskLevel: 'low',
  },
  'rule:null-values': {
    actionability: 'human_review',
    allowedAutomation: false,
    requiresHumanReview: true,
    riskLevel: 'medium',
  },
  'rule:mild-outliers': {
    actionability: 'human_review',
    allowedAutomation: false,
    requiresHumanReview: true,
    riskLevel: 'medium',
  },
  'rule:extreme-outliers': {
    actionability: 'human_review',
    allowedAutomation: false,
    requiresHumanReview: true,
    riskLevel: 'high',
  },
  'rule:long-tail-categorical': {
    actionability: 'human_review',
    allowedAutomation: false,
    requiresHumanReview: true,
    riskLevel: 'medium',
  },
  'rule:identifier-column': {
    actionability: 'human_review',
    allowedAutomation: false,
    requiresHumanReview: true,
    riskLevel: 'high',
  },
};

const DEFAULT_POLICY = {
  actionability: 'human_review' as LlmActionability,
  allowedAutomation: false,
  requiresHumanReview: true,
  riskLevel: 'medium' as 'low' | 'medium' | 'high',
};

function issueTypeFromRule(ruleId: string): string {
  const map: Record<string, string> = {
    'rule:trim-whitespace': 'whitespace_normalization',
    'rule:null-values': 'data_completeness',
    'rule:mild-outliers': 'outlier_detection',
    'rule:extreme-outliers': 'outlier_detection',
    'rule:long-tail-categorical': 'cardinality_analysis',
    'rule:identifier-column': 'identifier_detection',
  };
  return map[ruleId] || 'data_quality';
}

function buildRationale(
  ruleId: string,
  ruleName: string,
  column: string,
  policy: typeof V2_RULE_POLICY[string],
): string {
  if (ruleId === 'rule:trim-whitespace') {
    return `Whitespace trimming on column "${column}" is reversible, non-destructive, and semantically neutral. Automatically authorized regardless of column name ambiguity.`;
  }
  if (ruleId === 'rule:null-values') {
    return `Null values in column "${column}" require human context to determine whether imputation, deletion, or flagging is appropriate.`;
  }
  if (ruleId === 'rule:mild-outliers' || ruleId === 'rule:extreme-outliers') {
    return `Outlier values in column "${column}" may represent data entry errors or legitimate extremes. Human review required to classify.`;
  }
  if (ruleId === 'rule:long-tail-categorical') {
    return `High cardinality in column "${column}" requires human review to determine grouping strategy or identify data quality issues.`;
  }
  if (ruleId === 'rule:identifier-column') {
    return `Column "${column}" is an identifier — actions on identifiers require human authorization to prevent data corruption.`;
  }
  return `${ruleName} on column "${column}": human review required.`;
}

export function applyV2Rules(issues: FixtureIssue[]): LlmV2FindingDecision[] {
  return issues.map((issue) => {
    const policy = V2_RULE_POLICY[issue.ruleId] || DEFAULT_POLICY;
    const issueType = issueTypeFromRule(issue.ruleId);
    const column = issue.column || 'unknown';
    const rationale = buildRationale(issue.ruleId, issue.ruleName, column, policy);

    return {
      id: issue.id,
      fieldRef: column,
      ruleRef: issue.ruleId,
      issueType,
      actionability: policy.actionability,
      allowedAutomation: policy.allowedAutomation,
      requiresHumanReview: policy.requiresHumanReview,
      riskLevel: policy.riskLevel,
      evidenceRef: issue.ruleId,
      rationale,
    };
  });
}
