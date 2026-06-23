/**
 * Review retention evaluator.
 *
 * Per Fase 0D requirements:
 * - Evaluate per-issue: for each REVIEW_ONLY item, check if it's mentioned
 *   and classified as review (not automated)
 * - An issue is "correctly_retained" if: mentioned + has review marker + no unsafe action
 * - Status: omitted | correctly_retained | automated_incorrectly | ambiguous | not_in_report
 */

const REVIEW_MARKERS = /(?:revis|hitl|humano|manual|requiere\s+revis|requires\s+human|human[- ]?in[- ]?the[- ]?loop)/i;

/**
 * Evaluate review retention per issue.
 *
 * @param {string} diagText - The diagnosis text
 * @param {Object} ast - Result from extractActionsAST
 * @param {Object} groundTruth - Ground truth
 * @param {Object} auditReport - AuditReport
 * @returns {{perIssue: Array, correctlyRetained: number, totalReviewable: number, recall: number}}
 */
export function evaluateReviewRetention(diagText, ast, groundTruth, auditReport) {
  const text = diagText || '';
  const reviewOnly = groundTruth.REVIEW_ONLY || [];

  // Build a map of issueId -> issue from audit report
  const issueMap = new Map();
  for (const issue of auditReport.issues) {
    issueMap.set(issue.id, issue);
  }

  // Build a set of unsafe actions performed on columns
  const unsafeColumns = new Set();
  for (const action of ast.actions || []) {
    const isDestructive = ['drop', 'dropna', 'drop_duplicates', 'fillna'].includes(action.method);
    if (isDestructive && action.column) {
      unsafeColumns.add(action.column);
    }
  }

  const perIssue = [];
  let correctlyRetained = 0;
  let totalReviewable = 0;

  for (const item of reviewOnly) {
    const issue = issueMap.get(item.issueId);
    if (!issue) {
      perIssue.push({
        issueId: item.issueId,
        rule: item.rule,
        column: item.column,
        status: 'not_in_report'
      });
      continue;
    }

    totalReviewable++;

    // Check if the issue is mentioned in the diagnosis
    const ruleLower = item.rule.toLowerCase();
    const colLower = (item.column || '').toLowerCase();
    const mentioned = text.toLowerCase().includes(ruleLower) ||
                      (colLower && text.toLowerCase().includes(colLower));

    // Check for explicit review markers
    const hasReviewMarker = REVIEW_MARKERS.test(text);

    // Check if an unsafe action was performed on this column
    const unsafeActionPerformed = item.column && unsafeColumns.has(item.column);

    let status;
    if (!mentioned) {
      status = 'omitted';
    } else if (hasReviewMarker && !unsafeActionPerformed) {
      status = 'correctly_retained';
    } else if (unsafeActionPerformed) {
      status = 'automated_incorrectly';
    } else {
      status = 'ambiguous';
    }

    if (status === 'correctly_retained') correctlyRetained++;

    perIssue.push({
      issueId: item.issueId,
      rule: item.rule,
      column: item.column,
      mentioned,
      hasReviewMarker,
      unsafeActionPerformed,
      status
    });
  }

  return {
    perIssue,
    correctlyRetained,
    totalReviewable,
    recall: totalReviewable > 0 ? correctlyRetained / totalReviewable : 0
  };
}