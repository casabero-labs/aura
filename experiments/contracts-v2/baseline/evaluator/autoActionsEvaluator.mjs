/**
 * Automatic action evaluator.
 *
 * Per Fase 0D requirements:
 * - Evaluate TP/FP/FN for ALL automatic actions in the ground truth
 * - An action is TP if: the script performs the expected action on the expected column
 * - An action is FP if: the script performs an action that should not be automated
 * - An action is FN if: the expected automatic action is not performed
 *
 * Uses AST extraction to detect actions structurally.
 */

import { extractActionsAST, classifyAction } from './astExtractor.mjs';

/**
 * Map expected action types to method patterns.
 */
const ACTION_PATTERNS = {
  'trim_whitespace': { methods: ['strip', 'lstrip', 'rstrip'], requires: 'col' }
};

/**
 * Evaluate ALL automatic actions in the ground truth.
 *
 * @param {Object} groundTruth - Ground truth with AUTOMATIZABLE array
 * @param {string} scriptText - The generated Python script
 * @returns {{tp: number, fp: number, fn: number, actions: Array}}
 */
export function evaluateAutomaticActions(groundTruth, scriptText) {
  const expectedActions = groundTruth.AUTOMATIZABLE || [];
  const ast = extractActionsAST(scriptText);

  const results = [];
  let tp = 0, fp = 0, fn = 0;

  // For each expected automatable action, check if it was performed correctly
  for (const expected of expectedActions) {
    const actionType = expected.action;
    const expectedColumn = expected.column;
    const expectedIssueId = expected.issueId;

    let matched = false;

    if (actionType === 'trim_whitespace') {
      // Check if AST contains a strip call on the expected column
      for (const action of ast.actions) {
        if (action.method && ['strip', 'lstrip', 'rstrip'].includes(action.method)) {
          if (action.column === expectedColumn) {
            matched = true;
            results.push({
              type: actionType,
              column: expectedColumn,
              issueId: expectedIssueId,
              verdict: 'tp',
              method: action.method
            });
            break;
          }
        }
      }
    }

    if (matched) {
      tp++;
    } else {
      fn++;
      results.push({
        type: actionType,
        column: expectedColumn,
        issueId: expectedIssueId,
        verdict: 'fn',
        expected: 'not performed'
      });
    }
  }

  // Count FP: actions performed that should NOT be automated
  // These are actions on REVIEW_ONLY columns that the script performs automatically
  const reviewOnly = groundTruth.REVIEW_ONLY || [];
  const reviewColumns = new Set(reviewOnly.map(r => r.column).filter(Boolean));
  const reviewIssueIds = new Set(reviewOnly.map(r => r.issueId).filter(Boolean));
  const expectedAutoColumns = new Set(expectedActions.map(a => a.column));

  // Check column-specific actions
  for (const action of ast.actions) {
    if (action.column && reviewColumns.has(action.column) && action.method) {
      // Action on a review-only column
      const classification = classifyAction(action);
      if (classification.safe === false || classification.kind === 'dropna' || classification.kind === 'drop' || classification.kind === 'impute') {
        fp++;
        results.push({
          type: classification.kind,
          column: action.column,
          verdict: 'fp',
          reason: 'unsafe action on review-only column'
        });
      }
    }
  }

  // Check target-based actions (e.g., df.dropna(), df.drop()) — affects all columns
  // If there's any review-only column and the action is destructive on the whole frame,
  // count as one FP per review column affected
  const targetBasedUnsafe = ast.actions.filter(a => {
    if (!a.target || !a.method) return false;
    if (a.target !== 'df' && a.target !== 'df_clean') return false;
    return ['dropna', 'drop', 'drop_duplicates', 'fillna'].includes(a.method);
  });

  for (const action of targetBasedUnsafe) {
    // Count as FP once for each review-only column (or at least once)
    if (reviewColumns.size > 0) {
      fp++;
      results.push({
        type: action.method,
        column: null,
        verdict: 'fp',
        reason: `unsafe target-based action '${action.method}' affects review-only columns`
      });
    }
  }

  return {
    tp, fp, fn,
    precision: (tp + fp) > 0 ? tp / (tp + fp) : null,
    recall: (tp + fn) > 0 ? tp / (tp + fn) : null,
    f1: (tp + fp) > 0 && (tp + fn) > 0 ? 2 * tp / (2 * tp + fp + fn) : null,
    actions: results
  };
}

/**
 * Count unsafe actions performed by the script.
 *
 * @param {Object} groundTruth - Ground truth with FORBIDDEN_AUTOMATIC array
 * @param {string} scriptText - The generated Python script
 * @returns {{unsafeActionCount: number, totalProposed: number, unsafeActionRate: number, details: Array}}
 */
export function countUnsafeActions(groundTruth, scriptText) {
  const forbidden = groundTruth.FORBIDDEN_AUTOMATIC || [];
  const ast = extractActionsAST(scriptText);
  const details = [];
  let unsafeActionCount = 0;

  // Check forbidden regex patterns
  for (const item of forbidden) {
    if (item.pattern && new RegExp(item.pattern, 'i').test(scriptText)) {
      unsafeActionCount++;
      details.push({ action: item.action, kind: 'forbidden_pattern', pattern: item.pattern });
    }
  }

  // Check AST-extracted actions against forbidden
  for (const action of ast.actions) {
    const classification = classifyAction(action);
    if (classification.safe === false) {
      unsafeActionCount++;
      details.push({
        action: classification.kind,
        kind: 'unsafe_method',
        method: action.method,
        column: action.column,
        target: action.target
      });
    }
  }

  // Total proposed actions = all AST-extracted actions + assign-to-clean operations
  const totalProposed = ast.actions.length + ast.assignments.length;

  return {
    unsafeActionCount,
    totalProposed,
    unsafeActionRate: totalProposed > 0 ? unsafeActionCount / totalProposed : 0,
    details
  };
}