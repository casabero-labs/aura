/**
 * Token Budget — Fase 1.
 *
 * Deterministic token budget with truncation manifest.
 * Every omission is logged in the manifest for auditability.
 */

import { createHash } from 'node:crypto';
import type { TokenBudgetV2, TruncationManifestV2, TruncatedItemV2 } from './types';

const DEFAULT_BUDGET: TokenBudgetV2 = {
  budgetId: 'budget-v2-default',
  maxColumns: 16,
  maxIssues: 24,
  maxSamplesPerIssue: 4,
  maxTopValues: 6,
  maxCharacters: 16000,
  limits: {},
};

/**
 * Build a token budget, merging user overrides with defaults.
 */
export function buildTokenBudget(overrides?: Partial<TokenBudgetV2>): TokenBudgetV2 {
  const merged = { ...DEFAULT_BUDGET, ...overrides, limits: { ...DEFAULT_BUDGET.limits, ...(overrides?.limits || {}) } };
  const hash = createHash('sha256')
    .update(JSON.stringify(merged))
    .digest('hex')
    .slice(0, 8);
  return { ...merged, budgetId: `budget-v2-${hash}` };
}

/**
 * Create an empty truncation manifest.
 */
export function createTruncationManifest(): TruncationManifestV2 {
  return {
    truncatedColumns: [],
    truncatedIssues: [],
    truncatedSamples: [],
    truncatedTopValues: [],
    truncatedCharacters: [],
  };
}

/**
 * Check if an item exceeds budget and log it in the manifest if so.
 */
export function applyColumnLimit(
  manifest: TruncationManifestV2,
  budget: TokenBudgetV2,
  total: number,
  included: string[],
  excluded: string[],
): TruncationManifestV2 {
  if (total > budget.maxColumns) {
    for (const name of excluded) {
      manifest.truncatedColumns.push({
        id: `col:${name}`,
        name,
        resource: 'column',
        allowed: budget.maxColumns,
        actual: total,
        excess: total - budget.maxColumns,
      });
    }
  }
  return manifest;
}

export function applyIssueLimit(
  manifest: TruncationManifestV2,
  budget: TokenBudgetV2,
  total: number,
  excluded: { id: string; name: string }[],
): TruncationManifestV2 {
  if (total > budget.maxIssues) {
    for (const { id, name } of excluded) {
      manifest.truncatedIssues.push({
        id,
        name,
        resource: 'issue',
        allowed: budget.maxIssues,
        actual: total,
        excess: total - budget.maxIssues,
      });
    }
  }
  return manifest;
}

export function applySampleLimit(
  manifest: TruncationManifestV2,
  budget: TokenBudgetV2,
  issueId: string,
  actual: number,
): TruncationManifestV2 {
  if (actual > budget.maxSamplesPerIssue) {
    manifest.truncatedSamples.push({
      id: issueId,
      name: issueId,
      resource: 'sample',
      allowed: budget.maxSamplesPerIssue,
      actual,
      excess: actual - budget.maxSamplesPerIssue,
    });
  }
  return manifest;
}

export function applyTopValuesLimit(
  manifest: TruncationManifestV2,
  budget: TokenBudgetV2,
  columnId: string,
  actual: number,
): TruncationManifestV2 {
  if (actual > budget.maxTopValues) {
    manifest.truncatedTopValues.push({
      id: columnId,
      name: columnId,
      resource: 'topValues',
      allowed: budget.maxTopValues,
      actual,
      excess: actual - budget.maxTopValues,
    });
  }
  return manifest;
}

export function applyCharacterLimit(
  manifest: TruncationManifestV2,
  budget: TokenBudgetV2,
  field: string,
  actual: number,
): TruncationManifestV2 {
  if (actual > budget.maxCharacters) {
    manifest.truncatedCharacters.push({
      id: field,
      name: field,
      resource: 'characters',
      allowed: budget.maxCharacters,
      actual,
      excess: actual - budget.maxCharacters,
    });
  }
  return manifest;
}

/**
 * Get the default budget (no overrides).
 */
export function defaultBudget(): TokenBudgetV2 {
  return { ...DEFAULT_BUDGET };
}

/**
 * Estimate total character count for a payload (approximate).
 */
export function estimateCharCount(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}
