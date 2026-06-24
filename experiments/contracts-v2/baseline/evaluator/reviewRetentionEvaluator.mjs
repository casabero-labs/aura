/**
 * Review retention evaluator — Fase 0E.
 *
 * Per-issue: locate the block/bullet/paragraph where the rule+column appears.
 * Check for HITL/review marker in that SAME block.
 * If an unsafe action is performed on that column, it overrides retention.
 *
 * Status per issue:
 *   omitted — rule+column not mentioned
 *   correctly_retained — mentioned + review marker in block + no unsafe action on column
 *   automated_incorrectly — unsafe action performed on that column
 *   ambiguous — mentioned but no review marker and no unsafe action
 *   not_in_report — issue not in audit report
 */

import { extractActionsAST } from './astExtractor.mjs';

const REVIEW_MARKERS = /(?:revis(?:ión|ar)?|hitl|humano|manual|requiere\s+revis|requires\s+human|human[- ]?in[- ]?the[- ]?loop|validar\s+con)/i;

/**
 * Split text into blocks: each line is a separate block (paragraph/bullet).
 * AURA comment lines start a new block.
 */
function splitIntoBlocks(text) {
  if (!text) return [];
  const blocks = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      blocks.push(trimmed);
    }
  }
  return blocks;
}

/**
 * Find the block that contains both the rule name AND the column name.
 * No fallback — if both aren't in the same block, the issue is not mentioned.
 */
function findBlockForIssue(blocks, rule, column) {
  const ruleLower = (rule || '').toLowerCase();
  const colLower = (column || '').toLowerCase();

  for (const block of blocks) {
    const blockLower = block.toLowerCase();
    const hasRule = ruleLower && blockLower.includes(ruleLower);
    const hasCol = colLower && blockLower.includes(colLower);
    if (hasRule && hasCol) return block;
  }

  return null;
}

/**
 * Evaluate review retention per issue.
 *
 * @param {string} diagText - Diagnosis text
 * @param {string} summaryText - Summary text
 * @param {string} scriptText - Script text
 * @param {Object} groundTruth - Ground truth
 * @param {Object} auditReport - AuditReport
 * @returns {{perIssue, correctlyRetained, totalReviewable, recall}}
 */
export function evaluateReviewRetention(diagText, summaryText, scriptText, groundTruth, auditReport) {
  const reviewOnly = groundTruth.REVIEW_ONLY || [];
  const fullText = (diagText || '') + '\n' + (summaryText || '');
  const blocks = splitIntoBlocks(fullText);

  // Also include script blocks for review marker detection
  const scriptBlocks = splitIntoBlocks(scriptText || '');
  const allBlocks = [...blocks, ...scriptBlocks];

  // Build unsafe column set from canonical actions
  const ast = extractActionsAST(scriptText);
  const unsafeColumns = new Set();
  for (const act of ast.canonicalActions) {
    if (act.safe === false && act.column) {
      unsafeColumns.add(act.column);
    }
  }

  // Build issue map
  const issueMap = new Map();
  for (const issue of auditReport.issues) {
    issueMap.set(issue.id, issue);
  }

  const perIssue = [];
  let correctlyRetained = 0;
  let totalReviewable = 0;

  for (const item of reviewOnly) {
    const issue = issueMap.get(item.issueId);
    if (!issue) {
      perIssue.push({ issueId: item.issueId, rule: item.rule, column: item.column, status: 'not_in_report' });
      continue;
    }

    totalReviewable++;

    // Find the block for this issue+column
    const block = findBlockForIssue(allBlocks, item.rule, item.column);
    const mentioned = block !== null;

    // Check for review marker in that specific block
    let hasReviewMarker = false;
    if (block) {
      hasReviewMarker = REVIEW_MARKERS.test(block);
    }

    // Check unsafe action on this column
    const unsafeActionPerformed = item.column && unsafeColumns.has(item.column);

    let status;
    if (!mentioned) {
      status = 'omitted';
    } else if (unsafeActionPerformed) {
      status = 'automated_incorrectly';
    } else if (hasReviewMarker) {
      status = 'correctly_retained';
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
