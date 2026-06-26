/**
 * Script Renderer v2 — Phase 4 Loop 2R.
 *
 * Deterministic Python/Pandas script renderer. Hardened.
 * NO LLM. NO timestamps. NO UUIDs. NO clock.
 *
 * Canonical column reference: _c["columnId"]
 * Duplicates: _c["columnId"]["position"]
 *
 * Uses official helpers from scriptColumnResolver.ts exclusively.
 * ColumnRef is untrusted input — registry is the only authority.
 */

import type {
  ColumnRef,
  ColumnRegistryV2,
  RemediationActionV2,
  RemediationActionTypeV2,
  RequiresHumanReviewParams,
} from './types';
import { generateSafeColumnDict } from './columnRegistry';
import { PLACEHOLDER_VOCABULARY_V2 } from './placeholderVocabulary';
import {
  buildColumnReadExpression,
  buildColumnWriteTarget,
} from './scriptColumnResolver';

// ── Version ──

export const SCRIPT_RENDERER_VERSION = '2.0.0';

// ── Renderable Action ──

export interface RenderableScriptActionV2 {
  action: RemediationActionV2;
  columnRef: ColumnRef | null;
}

// ── Error Types ──

export type ScriptRendererErrorCode =
  | 'RENDER_ACTION_NOT_APPROVED'
  | 'RENDER_COLUMN_REQUIRED'
  | 'RENDER_COLUMN_NOT_ALLOWED'
  | 'RENDER_COLUMN_MISMATCH'
  | 'RENDER_COLUMN_AMBIGUOUS'
  | 'RENDER_COLUMN_NOT_IN_REGISTRY'
  | 'RENDER_PARAMETERS_INVALID'
  | 'RENDER_UNSUPPORTED_ACTION';

export class ScriptRendererError extends Error {
  constructor(
    public readonly code: ScriptRendererErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ScriptRendererError';
  }
}

function rendererError(code: ScriptRendererErrorCode, message: string): never {
  throw new ScriptRendererError(code, message);
}

// ── Parameter Validation ──

function validateParameters(parameters: unknown, actionId: string): void {
  if (parameters === null || parameters === undefined) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: action "${actionId}" has null/undefined parameters`,
    );
  }
  if (typeof parameters !== 'object') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: action "${actionId}" parameters must be an object, got ${typeof parameters}`,
    );
  }
  if (Array.isArray(parameters)) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: action "${actionId}" parameters must be an object, got array`,
    );
  }
}

// ── Action Type Classification ──

const COLUMN_REQUIRED_ACTIONS: readonly RemediationActionTypeV2[] = [
  'trim_whitespace',
  'normalize_placeholders',
  'normalize_casing',
  'convert_disguised_numbers',
];

const COLUMN_FORBIDDEN_ACTIONS: readonly RemediationActionTypeV2[] = [
  'drop_exact_duplicates',
];

// ── Column Validation (untrusted ColumnRef → trusted registryCol) ──

function columnsMatch(a: ColumnRef, b: ColumnRef): boolean {
  return (
    a.columnId === b.columnId &&
    a.name === b.name &&
    a.position === b.position &&
    a.duplicateOrdinal === b.duplicateOrdinal &&
    a.pythonLiteral === b.pythonLiteral &&
    a.isDuplicate === b.isDuplicate &&
    a.isAmbiguous === b.isAmbiguous &&
    a.isReservedWord === b.isReservedWord
  );
}

/**
 * Validate a columnRef against the registry.
 * The ColumnRef is UNTRUSTED. After validation, returns the registry column.
 */
function validateColumnRef(
  columnRef: ColumnRef,
  action: RemediationActionV2,
  registry: ColumnRegistryV2,
): ColumnRef {
  if (action.columnId !== null && action.columnId !== columnRef.columnId) {
    rendererError(
      'RENDER_COLUMN_MISMATCH',
      `RENDER_COLUMN_MISMATCH: action.columnId "${action.columnId}" does not match columnRef.columnId "${columnRef.columnId}"`,
    );
  }

  const registryCol = registry.byColumnId.get(columnRef.columnId);
  if (!registryCol) {
    rendererError(
      'RENDER_COLUMN_NOT_IN_REGISTRY',
      `RENDER_COLUMN_NOT_IN_REGISTRY: columnRef.columnId "${columnRef.columnId}" not found in registry`,
    );
  }

  if (!columnsMatch(columnRef, registryCol)) {
    rendererError(
      'RENDER_COLUMN_MISMATCH',
      `RENDER_COLUMN_MISMATCH: columnRef fields do not match registry for "${columnRef.columnId}"`,
    );
  }

  if (registryCol.isAmbiguous) {
    rendererError(
      'RENDER_COLUMN_AMBIGUOUS',
      `RENDER_COLUMN_AMBIGUOUS: column "${registryCol.columnId}" is marked ambiguous`,
    );
  }

  return registryCol;
}

// ── Action Renderers ──

// Verified col: trusted registry ColumnRef (never the untrusted input)

function renderTrimWhitespace(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters;
  validateParameters(params, action.actionId);
  if (
    typeof (params as unknown as Record<string, unknown>).trimEdges !== 'boolean' ||
    (params as unknown as Record<string, unknown>).trimEdges !== true
  ) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: trim_whitespace requires trimEdges=true`,
    );
  }

  const collapse = (params as unknown as Record<string, unknown>).collapseInternalWhitespace;
  if (typeof collapse !== 'boolean') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: trim_whitespace collapseInternalWhitespace must be boolean`,
    );
  }

  const read = buildColumnReadExpression(col);
  const target = buildColumnWriteTarget(col);

  if (collapse === false) {
    return `    ${target} = ${read}.astype("string").str.strip()`;
  }
  return `    ${target} = ${read}.astype("string").str.strip().str.replace(r"\\s+", " ", regex=True)`;
}

function renderDropExactDuplicates(action: RemediationActionV2): string {
  const params = action.parameters;
  validateParameters(params, action.actionId);

  if (action.columnId !== null) {
    rendererError(
      'RENDER_COLUMN_NOT_ALLOWED',
      `RENDER_COLUMN_NOT_ALLOWED: drop_exact_duplicates requires action.columnId=null, got "${action.columnId}"`,
    );
  }

  if (
    typeof (params as unknown as Record<string, unknown>).keep !== 'string' ||
    (params as unknown as Record<string, unknown>).keep !== 'first'
  ) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: drop_exact_duplicates requires keep="first"`,
    );
  }

  return `    df_clean = df_clean.drop_duplicates(keep="first").copy()`;
}

function renderNormalizePlaceholders(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters;
  validateParameters(params, action.actionId);

  if (
    typeof (params as unknown as Record<string, unknown>).strategy !== 'string' ||
    (params as unknown as Record<string, unknown>).strategy !== 'controlled_vocabulary'
  ) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: normalize_placeholders requires strategy="controlled_vocabulary"`,
    );
  }

  if ((params as unknown as Record<string, unknown>).replacement !== null) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: normalize_placeholders requires replacement=null`,
    );
  }

  const read = buildColumnReadExpression(col);
  const target = buildColumnWriteTarget(col);

  const placeholders = PLACEHOLDER_VOCABULARY_V2;
  const serializedPlaceholders = placeholders.map(v => JSON.stringify(v)).join(', ');

  return `    ${target} = ${read}.replace([${serializedPlaceholders}], np.nan)`;
}

function renderNormalizeCasing(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters;
  validateParameters(params, action.actionId);

  const strategy = (params as unknown as Record<string, unknown>).strategy;
  if (typeof strategy !== 'string') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: normalize_casing strategy must be a string`,
    );
  }

  const read = buildColumnReadExpression(col);
  const target = buildColumnWriteTarget(col);

  if (strategy === 'title_case') {
    return `    ${target} = ${read}.astype("string").str.strip().str.title()`;
  }

  if (strategy === 'lowercase') {
    return `    ${target} = ${read}.astype("string").str.strip().str.lower()`;
  }

  rendererError(
    'RENDER_PARAMETERS_INVALID',
    `RENDER_PARAMETERS_INVALID: normalize_casing strategy must be "title_case" or "lowercase", got "${strategy}"`,
  );
}

function renderConvertDisguisedNumbers(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters;
  validateParameters(params, action.actionId);

  if (
    typeof (params as unknown as Record<string, unknown>).decimalSeparator !== 'string' ||
    (params as unknown as Record<string, unknown>).decimalSeparator !== 'auto'
  ) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: convert_disguised_numbers requires decimalSeparator="auto"`,
    );
  }

  if (
    typeof (params as unknown as Record<string, unknown>).errors !== 'string' ||
    (params as unknown as Record<string, unknown>).errors !== 'coerce'
  ) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: convert_disguised_numbers requires errors="coerce"`,
    );
  }

  const read = buildColumnReadExpression(col);
  const target = buildColumnWriteTarget(col);

  return [
    `    ${target} = pd.to_numeric(`,
    `        ${read}.astype("string").str.replace(",", ".", regex=False),`,
    `        errors="coerce",`,
    `    )`,
  ].join('\n');
}

function renderRequiresHumanReview(action: RemediationActionV2): string {
  const params = action.parameters;
  validateParameters(params, action.actionId);

  const reasonCode = (params as unknown as Record<string, unknown>).reasonCode;
  if (typeof reasonCode !== 'string') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: requires_human_review reasonCode must be a string`,
    );
  }

  const validReasonCodes: RequiresHumanReviewParams['reasonCode'][] = [
    'unknown_rule',
    'ambiguous_column',
    'review_only_rule',
    'diagnosis_requires_review',
    'authorization_missing',
    'no_safe_transform',
  ];

  if (!(validReasonCodes as string[]).includes(reasonCode)) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: requires_human_review reasonCode "${reasonCode}" is not a valid closed reasonCode`,
    );
  }

  return `    # AURA review-only: reasonCode=${reasonCode}; no transformation rendered`;
}

// ── Main Render Function ──

export function renderActionV2(
  action: RemediationActionV2,
  columnRef: ColumnRef | null,
  registry: ColumnRegistryV2,
): string {
  if (action.approvalStatus !== 'approved') {
    rendererError(
      'RENDER_ACTION_NOT_APPROVED',
      `RENDER_ACTION_NOT_APPROVED: action "${action.actionId}" has approvalStatus "${action.approvalStatus}"`,
    );
  }

  const requiresColumn = COLUMN_REQUIRED_ACTIONS.includes(action.actionType);
  const forbidsColumn = COLUMN_FORBIDDEN_ACTIONS.includes(action.actionType);

  // ── Action type requires a column ──
  if (requiresColumn) {
    if (action.columnId === null) {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: actionType "${action.actionType}" requires a column but action.columnId is null`,
      );
    }
    if (columnRef === null) {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: actionType "${action.actionType}" requires a column but columnRef is null`,
      );
    }
  }

  // ── Action type forbids a column ──
  if (forbidsColumn && columnRef !== null) {
    rendererError(
      'RENDER_COLUMN_NOT_ALLOWED',
      `RENDER_COLUMN_NOT_ALLOWED: actionType "${action.actionType}" does not allow a columnRef`,
    );
  }

  // ── Validate and resolve columnRef (untrusted → trusted registryCol) ──
  let resolvedCol: ColumnRef | null = null;
  if (columnRef !== null) {
    resolvedCol = validateColumnRef(columnRef, action, registry);

    if (action.columnId !== null && action.columnId !== resolvedCol.columnId) {
      rendererError(
        'RENDER_COLUMN_MISMATCH',
        `RENDER_COLUMN_MISMATCH: action.columnId "${action.columnId}" does not match resolved column "${resolvedCol.columnId}"`,
      );
    }
  }

  // ── requires_human_review consistency ──
  if (action.actionType === 'requires_human_review') {
    if (action.columnId === null && columnRef !== null) {
      rendererError(
        'RENDER_COLUMN_NOT_ALLOWED',
        `RENDER_COLUMN_NOT_ALLOWED: requires_human_review with action.columnId=null must have columnRef=null`,
      );
    }
    if (action.columnId !== null && columnRef === null) {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: requires_human_review with action.columnId set requires a matching columnRef`,
      );
    }
    return renderRequiresHumanReview(action);
  }

  // ── Dispatch ──
  switch (action.actionType) {
    case 'trim_whitespace':
      return renderTrimWhitespace(action, resolvedCol!);

    case 'drop_exact_duplicates':
      return renderDropExactDuplicates(action);

    case 'normalize_placeholders':
      return renderNormalizePlaceholders(action, resolvedCol!);

    case 'normalize_casing':
      return renderNormalizeCasing(action, resolvedCol!);

    case 'convert_disguised_numbers':
      return renderConvertDisguisedNumbers(action, resolvedCol!);

    default: {
      const exhaustiveCheck = action as never;
      rendererError(
        'RENDER_UNSUPPORTED_ACTION',
        `RENDER_UNSUPPORTED_ACTION: actionType "${(exhaustiveCheck as { actionType: string }).actionType}" is not supported`,
      );
    }
  }
}

// ── Header & Footer ──

export function buildScriptHeader(registry: ColumnRegistryV2): string {
  const columnDict = generateSafeColumnDict([...registry.orderedColumns]);

  return [
    `import pandas as pd`,
    `import numpy as np`,
    ``,
    columnDict,
    ``,
    `def clean_dataset(df):`,
    `    df_clean = df.copy()`,
  ].join('\n');
}

export function buildScriptFooter(): string {
  return `    return df_clean`;
}

// ── Full Script Builder ──

export function buildScriptText(
  actions: readonly RenderableScriptActionV2[],
  registry: ColumnRegistryV2,
): string {
  const header = buildScriptHeader(registry);

  const renderedActions: string[] = [];
  for (const { action, columnRef } of actions) {
    const line = renderActionV2(action, columnRef, registry);
    renderedActions.push(line);
  }

  const footer = buildScriptFooter();

  if (renderedActions.length === 0) {
    return `${header}\n${footer}\n`;
  }

  return [
    header,
    ...renderedActions,
    footer,
    '',
  ].join('\n');
}
