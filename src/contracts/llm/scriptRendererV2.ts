/**
 * Script Renderer v2 — Phase 4 Loop 2.
 *
 * Deterministic Python/Pandas script renderer.
 * Transforms approved RemediationActionV2[] into executable script text.
 * NO LLM involvement. NO timestamps. NO UUIDs. NO clock.
 *
 * Canonical column reference: _c["columnId"]
 * Duplicates: _c["columnId"]["position"]
 */

import type {
  ColumnRef,
  ColumnRegistryV2,
  RemediationActionV2,
  RemediationActionTypeV2,
  TrimWhitespaceParams,
  DropExactDuplicatesParams,
  NormalizePlaceholdersParams,
  NormalizeCasingParams,
  ConvertDisguisedNumbersParams,
  RequiresHumanReviewParams,
} from './types';
import { generateSafeColumnDict } from './columnRegistry';
import { PLACEHOLDER_VOCABULARY_V2 } from './placeholderVocabulary';

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

// ── Column Validation ──

function validateColumnRefForAction(
  col: ColumnRef | null,
  action: RemediationActionV2,
  registry: ColumnRegistryV2,
): ColumnRef {
  if (action.approvalStatus !== 'approved') {
    rendererError(
      'RENDER_ACTION_NOT_APPROVED',
      `RENDER_ACTION_NOT_APPROVED: action "${action.actionId}" has approvalStatus "${action.approvalStatus}"`,
    );
  }

  const actionTypeRequiresColumn: RemediationActionTypeV2[] = [
    'trim_whitespace',
    'normalize_placeholders',
    'normalize_casing',
    'convert_disguised_numbers',
  ];

  const actionTypeAllowsNullColumn: RemediationActionTypeV2[] = [
    'drop_exact_duplicates',
  ];

  const requiresColumn = actionTypeRequiresColumn.includes(action.actionType);
  const allowsNullColumn = actionTypeAllowsNullColumn.includes(action.actionType);

  if (col === null) {
    if (requiresColumn) {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: actionType "${action.actionType}" requires a column`,
      );
    }
    if (!allowsNullColumn && action.actionType !== 'requires_human_review') {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: actionType "${action.actionType}" does not allow null column`,
      );
    }
  }

  if (col !== null) {
    if (action.columnId !== null && action.columnId !== col.columnId) {
      rendererError(
        'RENDER_COLUMN_MISMATCH',
        `RENDER_COLUMN_MISMATCH: action.columnId "${action.columnId}" does not match columnRef.columnId "${col.columnId}"`,
      );
    }

    const registryCol = registry.byColumnId.get(col.columnId);
    if (!registryCol) {
      rendererError(
        'RENDER_COLUMN_NOT_IN_REGISTRY',
        `RENDER_COLUMN_NOT_IN_REGISTRY: columnRef.columnId "${col.columnId}" not found in registry`,
      );
    }

    if (col.isAmbiguous) {
      rendererError(
        'RENDER_COLUMN_AMBIGUOUS',
        `RENDER_COLUMN_AMBIGUOUS: column "${col.columnId}" is marked ambiguous`,
      );
    }

    if (
      col.columnId !== registryCol.columnId ||
      col.name !== registryCol.name ||
      col.position !== registryCol.position ||
      col.duplicateOrdinal !== registryCol.duplicateOrdinal ||
      col.isDuplicate !== registryCol.isDuplicate ||
      col.isAmbiguous !== registryCol.isAmbiguous
    ) {
      rendererError(
        'RENDER_COLUMN_MISMATCH',
        `RENDER_COLUMN_MISMATCH: columnRef does not match registry for "${col.columnId}"`,
      );
    }
  }

  return col!;
}

// ── Expression Builders ──

function buildReadExpression(col: ColumnRef): string {
  if (col.isDuplicate) {
    return `df_clean.iloc[:, ${col.pythonLiteral}["position"]]`;
  }
  return `df_clean[${col.pythonLiteral}]`;
}

function buildWriteTarget(col: ColumnRef): string {
  if (col.isDuplicate) {
    return `df_clean.iloc[:, ${col.pythonLiteral}["position"]]`;
  }
  return `df_clean[${col.pythonLiteral}]`;
}

// ── Action Renderers ──

function renderTrimWhitespace(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters as TrimWhitespaceParams;
  if (params.trimEdges !== true) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: trim_whitespace requires trimEdges=true, got ${JSON.stringify(params.trimEdges)}`,
    );
  }

  const read = buildReadExpression(col);
  const target = buildWriteTarget(col);

  if (params.collapseInternalWhitespace === false) {
    return `    ${target} = ${read}.astype("string").str.strip()`;
  }

  if (params.collapseInternalWhitespace === true) {
    return `    ${target} = ${read}.astype("string").str.strip().str.replace(r"\\s+", " ", regex=True)`;
  }

  rendererError(
    'RENDER_PARAMETERS_INVALID',
    `RENDER_PARAMETERS_INVALID: trim_whitespace collapseInternalWhitespace must be boolean, got ${JSON.stringify(params.collapseInternalWhitespace)}`,
  );
}

function renderDropExactDuplicates(action: RemediationActionV2): string {
  const params = action.parameters as DropExactDuplicatesParams;

  if (action.columnId !== null) {
    rendererError(
      'RENDER_COLUMN_NOT_ALLOWED',
      `RENDER_COLUMN_NOT_ALLOWED: drop_exact_duplicates requires action.columnId=null, got "${action.columnId}"`,
    );
  }

  if (params.keep !== 'first') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: drop_exact_duplicates requires keep="first", got "${params.keep}"`,
    );
  }

  return `    df_clean = df_clean.drop_duplicates(keep="first").copy()`;
}

function renderNormalizePlaceholders(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters as NormalizePlaceholdersParams;

  if (params.strategy !== 'controlled_vocabulary') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: normalize_placeholders requires strategy="controlled_vocabulary", got "${params.strategy}"`,
    );
  }

  if (params.replacement !== null) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: normalize_placeholders requires replacement=null, got ${JSON.stringify(params.replacement)}`,
    );
  }

  const read = buildReadExpression(col);
  const target = buildWriteTarget(col);

  const placeholders = PLACEHOLDER_VOCABULARY_V2;
  const serializedPlaceholders = placeholders.map(v => JSON.stringify(v)).join(', ');

  return `    ${target} = ${read}.replace([${serializedPlaceholders}], np.nan)`;
}

function renderNormalizeCasing(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters as NormalizeCasingParams;
  const read = buildReadExpression(col);
  const target = buildWriteTarget(col);

  if (params.strategy === 'title_case') {
    return `    ${target} = ${read}.astype("string").str.strip().str.title()`;
  }

  if (params.strategy === 'lowercase') {
    return `    ${target} = ${read}.astype("string").str.strip().str.lower()`;
  }

  rendererError(
    'RENDER_PARAMETERS_INVALID',
    `RENDER_PARAMETERS_INVALID: normalize_casing strategy must be "title_case" or "lowercase", got "${params.strategy}"`,
  );
}

function renderConvertDisguisedNumbers(
  action: RemediationActionV2,
  col: ColumnRef,
): string {
  const params = action.parameters as ConvertDisguisedNumbersParams;

  if (params.decimalSeparator !== 'auto') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: convert_disguised_numbers requires decimalSeparator="auto", got "${params.decimalSeparator}"`,
    );
  }

  if (params.errors !== 'coerce') {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: convert_disguised_numbers requires errors="coerce", got "${params.errors}"`,
    );
  }

  const read = buildReadExpression(col);
  const target = buildWriteTarget(col);

  return [
    `    ${target} = pd.to_numeric(`,
    `        ${read}.astype("string").str.replace(",", ".", regex=False),`,
    `        errors="coerce",`,
    `    )`,
  ].join('\n');
}

function renderRequiresHumanReview(
  action: RemediationActionV2,
  _col: ColumnRef | null,
): string {
  const params = action.parameters as RequiresHumanReviewParams;

  const validReasonCodes: RequiresHumanReviewParams['reasonCode'][] = [
    'unknown_rule',
    'ambiguous_column',
    'review_only_rule',
    'diagnosis_requires_review',
    'authorization_missing',
    'no_safe_transform',
  ];

  if (!validReasonCodes.includes(params.reasonCode)) {
    rendererError(
      'RENDER_PARAMETERS_INVALID',
      `RENDER_PARAMETERS_INVALID: requires_human_review reasonCode "${params.reasonCode}" is not a valid closed reasonCode`,
    );
  }

  return `    # AURA review-only: reasonCode=${params.reasonCode}; no transformation rendered`;
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

  const actionTypeRequiresColumn: RemediationActionTypeV2[] = [
    'trim_whitespace',
    'normalize_placeholders',
    'normalize_casing',
    'convert_disguised_numbers',
  ];

  const actionTypeAllowsNullColumn: RemediationActionTypeV2[] = [
    'drop_exact_duplicates',
    'requires_human_review',
  ];

  const requiresColumn = actionTypeRequiresColumn.includes(action.actionType);
  const allowsNullColumn = actionTypeAllowsNullColumn.includes(action.actionType);

  if (columnRef === null) {
    if (requiresColumn) {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: actionType "${action.actionType}" requires a column`,
      );
    }
    if (!allowsNullColumn) {
      rendererError(
        'RENDER_COLUMN_REQUIRED',
        `RENDER_COLUMN_REQUIRED: actionType "${action.actionType}" does not allow null column`,
      );
    }
  }

  const col = columnRef !== null
    ? validateColumnRefForAction(columnRef, action, registry)
    : null;

  if (col !== null && action.columnId !== null && action.columnId !== col.columnId) {
    rendererError(
      'RENDER_COLUMN_MISMATCH',
      `RENDER_COLUMN_MISMATCH: action.columnId "${action.columnId}" does not match resolved columnRef.columnId "${col.columnId}"`,
    );
  }

  switch (action.actionType) {
    case 'trim_whitespace':
      return renderTrimWhitespace(action, col!);

    case 'drop_exact_duplicates':
      return renderDropExactDuplicates(action);

    case 'normalize_placeholders':
      return renderNormalizePlaceholders(action, col!);

    case 'normalize_casing':
      return renderNormalizeCasing(action, col!);

    case 'convert_disguised_numbers':
      return renderConvertDisguisedNumbers(action, col!);

    case 'requires_human_review':
      return renderRequiresHumanReview(action, col);

    default: {
      const exhaustiveCheck: never = action;
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
