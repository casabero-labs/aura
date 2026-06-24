/**
 * Review retention evaluator — Fase 0F.
 *
 * Per-issue: locate the multiline Markdown block where rule+column appears.
 * Groups consecutive lines into items by Markdown item markers (-, *, 1., 2., etc.).
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
 * Split text into Markdown item blocks.
 * A new block starts at lines matching: -, *, 1., 2., 3., etc.
 * Consecutive non-marker lines belong to the current block.
 */
function splitIntoBlocks(text) {
  if (!text) return [];
  const blocks = [];
  let current = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const isItemStart = /^\s*[-*]\s/.test(trimmed) || /^\s*\d+\.\s/.test(trimmed) || /^#{1,3}\s/.test(trimmed);

    if (isItemStart) {
      if (current) blocks.push(current);
      current = trimmed;
    } else if (current) {
      current += '\n' + trimmed;
    } else {
      current = trimmed;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

/**
 * Find the block that contains both the rule name AND the column name.
 * Searches the entire block (which may be multiline).
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
