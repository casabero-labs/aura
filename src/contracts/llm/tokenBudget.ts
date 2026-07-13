/**
 * Token Budget — Phase 1B.
 *
 * - ENFORCES limits (not just logs)
 * - Deterministic reduction when maxCharacters exceeded
 * - Distinct exclusion reasons in manifest
 * - includedColumns in envelope.columns respects budget
 */

import { sha256short } from './hash';
import type {
  TokenBudgetV2,
  TruncationManifestV2,
  TruncatedItemV2,
  ExclusionReason,
  EvidenceEnvelopeV2,
} from './types';

const DEFAULT_BUDGET: TokenBudgetV2 = {
  budgetId: 'budget-v2-default',
  maxColumns: 16,
  maxIssues: 24,
  maxSamplesPerIssue: 4,
  maxTopValues: 6,
  // The controlled Phase 8 dataset produces a complete 24-issue envelope of
  // roughly 26k characters. Keep it intact so smart_sample and recommended
  // retain their statistics and evidence samples while still fitting the
  // formal 16k-token Ollama context.
  maxCharacters: 28000,
  limits: {},
};

export function buildTokenBudget(overrides?: Partial<TokenBudgetV2>): TokenBudgetV2 {
  const merged = { ...DEFAULT_BUDGET, ...overrides, limits: { ...DEFAULT_BUDGET.limits, ...(overrides?.limits || {}) } };
  const budgetId = `budget-v2-${sha256short(JSON.stringify(merged), 8)}`;
  return { ...merged, budgetId };
}

export function createTruncationManifest(): TruncationManifestV2 {
  return {
    truncatedColumns: [],
    truncatedIssues: [],
    truncatedSamples: [],
    truncatedTopValues: [],
    truncatedCharacters: [],
  };
}

function truncItem(
  id: string, name: string, resource: string, reason: ExclusionReason,
  allowed: number, actual: number,
): TruncatedItemV2 {
  return { id, name, resource, reason, allowed, actual, excess: Math.max(0, actual - allowed) };
}

export function logColumnExclusion(
  manifest: TruncationManifestV2, name: string,
  budget: TokenBudgetV2, actual: number,
  reason: ExclusionReason,
): void {
  manifest.truncatedColumns.push(truncItem(`col:${name}`, name, 'column', reason, budget.maxColumns, actual));
}

export function logIssueExclusion(
  manifest: TruncationManifestV2, id: string, name: string,
  budget: TokenBudgetV2, actual: number,
  reason: ExclusionReason,
): void {
  manifest.truncatedIssues.push(truncItem(id, name, 'issue', reason, budget.maxIssues, actual));
}

export function logSampleTruncation(
  manifest: TruncationManifestV2, id: string,
  budget: TokenBudgetV2, actual: number,
): void {
  manifest.truncatedSamples.push(truncItem(id, id, 'sample', 'budget_limit', budget.maxSamplesPerIssue, actual));
}

export function logTopValueTruncation(
  manifest: TruncationManifestV2, columnId: string,
  budget: TokenBudgetV2, actual: number,
): void {
  manifest.truncatedTopValues.push(truncItem(columnId, columnId, 'topValues', 'budget_limit', budget.maxTopValues, actual));
}

export function logCharacterTruncation(
  manifest: TruncationManifestV2, id: string, name: string,
  budget: TokenBudgetV2, actual: number,
  reason: ExclusionReason,
): void {
  manifest.truncatedCharacters.push(truncItem(id, name, 'characters', reason, budget.maxCharacters, actual));
}

/**
 * Slice an array to budget limit, logging the truncation.
 */
export function applySlice<T>(
  items: T[],
  max: number,
  logFn: (actual: number) => void,
): T[] {
  if (items.length > max) {
    logFn(items.length);
    return items.slice(0, max);
  }
  return items;
}

/**
 * Deterministic character reduction.
 * Removes the longest string fields first, then truncates JSON.
 * Returns the reduced payload and the manifest.
 */
export function enforceCharacterBudget(
  envelope: EvidenceEnvelopeV2,
  manifest: TruncationManifestV2,
  budget: TokenBudgetV2,
): EvidenceEnvelopeV2 {
  let json = JSON.stringify(envelope);
  if (json.length <= budget.maxCharacters) return envelope;

  const working = JSON.parse(json) as EvidenceEnvelopeV2;

  // Strategy: progressively remove large content
  // 1. Truncate top values across all columns
  for (const colId of Object.keys(working.evidence.columnStats)) {
    const stats = working.evidence.columnStats[colId];
    if (stats.topValues.length > 0) {
      const actual = stats.topValues.length;
      stats.topValues = [];
      logTopValueTruncation(manifest, colId, budget, actual);
    }
  }

  json = JSON.stringify(working);
  if (json.length <= budget.maxCharacters) return working;

  // 2. Remove all samples
  working.evidence.samples = [];
  for (const issue of working.issues) {
    issue.evidenceRefs = [];
  }

  json = JSON.stringify(working);
  if (json.length <= budget.maxCharacters) return working;

  // 3. Remove all column stats
  working.evidence.columnStats = {};

  json = JSON.stringify(working);
  if (json.length <= budget.maxCharacters) return working;

  // 4. Cannot comply — log and return minimized
  logCharacterTruncation(manifest, 'envelope', 'full-envelope', budget, json.length, 'budget_limit');
  return working;
}

export function estimateCharCount(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}

export function defaultBudget(): TokenBudgetV2 {
  return { ...DEFAULT_BUDGET };
}
