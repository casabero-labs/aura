/**
 * Titanic Diagnosis Fixture — Phase 3 E2E Tests.
 *
 * Provides a DiagnosisResponseV2 for Titanic with:
 * - 10 issues (matching Titanic audit report)
 * - All issues: requiresHumanReview=true, evidenceRefs=[]
 * - diagnosisBlocks for each issue
 *
 * This is a FAKE diagnosis (no real LLM inference). Used only for
 * Phase 3 screenshot tests 04/05/06 in third-delivery-evidence.spec.ts.
 *
 * Generated from: experiments/datasets/titanic.csv
 * Audit report: experiments/contracts-v2/fixtures/titanic-audit-report.json
 * IssueIds sourced directly from audit report (deterministic).
 */
export const TITANIC_DIAGNOSIS_RESPONSE_V2 = {
  contractId: 'aura.diagnosis.v2',
  contractVersion: '2.0.0',
  evidenceEnvelopeRef: 'env:276d58a368cb9aeafdc79348a59a45b6cef3fa2db1d6db1fc4e9d8713be7a8d8',
  responseId: 'diag-e2e-titanic-fixture',
  issues: [
    {
      issueId: 'hygiene-ghost-Name',
      evidenceRefs: [],
      hypothesis: 'Whitespace padding detected in Name column.',
      confidence: 0.95,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'semantic-long-tail-Name',
      evidenceRefs: [],
      hypothesis: 'Name column has high cardinality (891 distinct values), indicating a long-tail distribution.',
      confidence: 0.9,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'integrity-null-Age',
      evidenceRefs: [],
      hypothesis: 'Age column has 177 null values (19.9%).',
      confidence: 0.99,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'logic-outlier-tukey-Age',
      evidenceRefs: [],
      hypothesis: 'Age column has 8 mild Tukey outliers.',
      confidence: 0.85,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'logic-outlier-SibSp',
      evidenceRefs: [],
      hypothesis: 'SibSp column has 12 extreme outliers (IQR 3×).',
      confidence: 0.88,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'logic-outlier-tukey-SibSp',
      evidenceRefs: [],
      hypothesis: 'SibSp column has 34 mild Tukey outliers.',
      confidence: 0.82,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'logic-outlier-Ticket',
      evidenceRefs: [],
      hypothesis: 'Ticket column has 16 extreme outliers (IQR 3×).',
      confidence: 0.87,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'logic-outlier-Fare',
      evidenceRefs: [],
      hypothesis: 'Fare column has 53 extreme outliers (IQR 3×).',
      confidence: 0.89,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'logic-outlier-tukey-Fare',
      evidenceRefs: [],
      hypothesis: 'Fare column has 63 mild Tukey outliers.',
      confidence: 0.83,
      requiresHumanReview: true,
      limits: [],
    },
    {
      issueId: 'integrity-null-Cabin',
      evidenceRefs: [],
      hypothesis: 'Cabin column has 687 null values (77.1%) — critical missing data.',
      confidence: 0.99,
      requiresHumanReview: true,
      limits: [],
    },
  ],
  diagnosisBlocks: [
    {
      issueId: 'hygiene-ghost-Name',
      ruleId: 'rule:trim-whitespace',
      columnId: 'col:name',
      scope: 'column',
      observation: '2 values with leading/trailing whitespace in Name column.',
      recommendation: 'Trim whitespace at data ingestion or notify source system.',
    },
    {
      issueId: 'semantic-long-tail-Name',
      ruleId: 'rule:long-tail-category',
      columnId: 'col:name',
      scope: 'column',
      observation: '891 distinct values (100%) — long-tail distribution.',
      recommendation: 'Consider grouping rare names or using name prefixes for analysis.',
    },
    {
      issueId: 'integrity-null-Age',
      ruleId: 'rule:null-values',
      columnId: 'col:age',
      scope: 'column',
      observation: '177 null values in Age column (19.9%).',
      recommendation: 'Investigate data collection. Consider imputation or flagging.',
    },
    {
      issueId: 'logic-outlier-tukey-Age',
      ruleId: 'rule:outlier-tukey',
      columnId: 'col:age',
      scope: 'column',
      observation: '8 mild Tukey outliers in Age column (0.9%).',
      recommendation: 'Review outliers for data entry errors.',
    },
    {
      issueId: 'logic-outlier-SibSp',
      ruleId: 'rule:outlier-iqr',
      columnId: 'col:sibsp',
      scope: 'column',
      observation: '12 extreme outliers (>3× IQR) in SibSp column (1.3%).',
      recommendation: 'Verify large SibSp values (e.g., 5, 8) — may indicate data error or family size anomaly.',
    },
    {
      issueId: 'logic-outlier-tukey-SibSp',
      ruleId: 'rule:outlier-tukey',
      columnId: 'col:sibsp',
      scope: 'column',
      observation: '34 mild Tukey outliers in SibSp column (3.8%).',
      recommendation: 'Review mildly unusual SibSp values.',
    },
    {
      issueId: 'logic-outlier-Ticket',
      ruleId: 'rule:outlier-iqr',
      columnId: 'col:ticket',
      scope: 'column',
      observation: '16 extreme outliers in Ticket column (1.8%).',
      recommendation: 'High ticket numbers may indicate late booking or data anomaly.',
    },
    {
      issueId: 'logic-outlier-Fare',
      ruleId: 'rule:outlier-iqr',
      columnId: 'col:fare',
      scope: 'column',
      observation: '53 extreme outliers (>3× IQR) in Fare column (5.9%).',
      recommendation: 'High fares may indicate luxury cabins or data errors. Review.',
    },
    {
      issueId: 'logic-outlier-tukey-Fare',
      ruleId: 'rule:outlier-tukey',
      columnId: 'col:fare',
      scope: 'column',
      observation: '63 mild Tukey outliers in Fare column (7.1%).',
      recommendation: 'Review mildly unusual fare values.',
    },
    {
      issueId: 'integrity-null-Cabin',
      ruleId: 'rule:null-values',
      columnId: 'col:cabin',
      scope: 'column',
      observation: '687 null values in Cabin column (77.1%) — critical.',
      recommendation: 'Cabin data mostly missing. Consider excluding from analysis or flagging.',
    },
  ],
  limitations: [
    'Fixture diagnosis — no real LLM inference',
    'Evidence refs intentionally empty — requiresHumanReview=true satisfies validator',
    'Hypotheses are template-based, not model-generated',
  ],
  generatedAt: new Date().toISOString(),
};
