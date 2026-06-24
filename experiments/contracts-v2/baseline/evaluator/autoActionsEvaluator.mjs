/**
 * Automatic action evaluator — Fase 0F.
 *
 * TP: trim_whitespace on Name (only automatable action in ground truth).
 * FP: every other action the script performs that should not be automated.
 * FN: expected automatable action not performed.
 *
 * unsafeActionCount and totalProposed operate on canonical actions.
 * unsafeActionRate is always clamped to [0, 1].
 */

import { extractActionsAST } from './astExtractor.mjs';

const UNSAFE_METHODS = new Set([
  'fillna', 'dropna', 'drop', 'drop_duplicates',
  'clip', 'replace', 'astype', 'set_nan',
  'loc_assign', 'subscript_assign'
]);

/**
 * Evaluate automatic actions against ground truth.
 *
 * @param {Object} groundTruth
 * @param {string} scriptText
 * @returns {{tp: number, fp: number, fn: number, precision, recall, f1, actions: Array}}
 */
export function evaluateAutomaticActions(groundTruth, scriptText) {
  const expectedActions = groundTruth.AUTOMATIZABLE || [];
  const ast = extractActionsAST(scriptText);
  const results = [];
  let tp = 0, fp = 0, fn = 0;

  // Check expected automatable actions
  for (const expected of expectedActions) {
    let matched = false;
    for (const act of ast.canonicalActions) {
      if (expected.action === 'trim_whitespace') {
        if (['strip', 'lstrip', 'rstrip'].includes(act.actionType) && act.column === expected.column) {
          matched = true;
          results.push({ ...act, issueId: expected.issueId, verdict: 'tp' });
          break;
        }
      }
    }
    if (matched) tp++;
    else {
      fn++;
      results.push({ actionType: expected.action, column: expected.column, issueId: expected.issueId, verdict: 'fn' });
    }
  }

  // Count FP: all non-safe actions that are NOT the expected trim
  for (const act of ast.canonicalActions) {
    if (act.safe) continue; // trim is TP, already counted
    const isExpectedTP = expectedActions.some(e =>
      e.action === 'trim_whitespace' && ['strip', 'lstrip', 'rstrip'].includes(act.actionType) && act.column === e.column
    );
    if (isExpectedTP) continue;
    fp++;
    results.push({ ...act, verdict: 'fp' });
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
 * Count unsafe actions from canonical actions.
 * unsafeActionCount <= totalProposed always.
 * Rate clamped to [0, 1].
 *
 * @param {string} scriptText
 * @returns {{unsafeActionCount, totalProposed, unsafeActionRate, details}}
 */
export function countUnsafeActions(scriptText) {
  const ast = extractActionsAST(scriptText);
  const canonical = ast.canonicalActions;
  const totalProposed = canonical.length;

  const details = [];
  let unsafeCount = 0;

  for (const act of canonical) {
    if (act.safe === false) {
      unsafeCount++;
      details.push({
        actionType: act.actionType,
        column: act.column,
        lineno: act.lineno,
        target: act.target
      });
    }
  }

  return {
    unsafeActionCount: unsafeCount,
    totalProposed,
    unsafeActionRate: totalProposed > 0 ? Math.min(unsafeCount / totalProposed, 1) : 0,
    details
  };
}
