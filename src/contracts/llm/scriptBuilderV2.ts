/**
 * Script Builder v2 — Phase 4 Loop 3R.
 *
 * Builds ScriptContractCandidateV2 from RemediationPlanV2 + ScriptBuildContextV2.
 * Implements the candidate → validate → finalize pipeline.
 *
 * Hardened: finalizer fail-closed, defensive copy, canonical generatedAt,
 * renderer error attribution with actionId, runtime shape validation.
 *
 * Pure core (no clock). Deterministic. NO LLM.
 */

import type {
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptContractCandidateV2,
  ScriptContractV2,
  ScriptValidationResultV2,
  ValidationErrorV2,
  ScriptExcludedActionV2,
  ScriptExclusionReasonV2,
  ColumnRef,
  RemediationActionTypeV2,
  PythonSyntaxState,
} from './types';
import { canonicalJson } from './diagnosisPromptV2';
import { sha256hex } from './hash';
import {
  SCRIPT_RENDERER_VERSION,
  buildScriptText,
  renderActionV2,
  RenderableScriptActionV2,
  ScriptRendererError,
} from './scriptRendererV2';
import { PLACEHOLDER_VOCABULARY_VERSION } from './placeholderVocabulary';

// ── Constants ──

export const SCRIPT_CONTRACT_VERSION = '2.0.0';
export const CLEAN_DATASET_FN = 'clean_dataset';

// ── Options ──

export interface ScriptCandidateBuildOptionsV2 {
  generatedAt?: string;
}

// ── Core type (without generatedAt) ──

export type ScriptContractCandidateCoreV2 =
  Omit<ScriptContractCandidateV2, 'generatedAt'>;

// ── Error Types ──

export type ScriptBuilderErrorCode =
  | 'SCRIPT_BUILD_CONTEXT_INVALID'
  | 'SCRIPT_BUILD_REMEDIATION_MISMATCH'
  | 'SCRIPT_BUILD_REFERENCE_INVALID'
  | 'SCRIPT_BUILD_RENDER_FAILED'
  | 'SCRIPT_BUILD_GENERATED_AT_INVALID'
  | 'SCRIPT_FINALIZATION_VALIDATION_REQUIRED'
  | 'SCRIPT_FINALIZATION_VALIDATION_FAILED'
  | 'SCRIPT_FINALIZATION_SYNTAX_FAILED';

export class ScriptBuilderError extends Error {
  constructor(
    public readonly code: ScriptBuilderErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ScriptBuilderError';
  }
}

function builderError(code: ScriptBuilderErrorCode, message: string, cause?: unknown): never {
  throw new ScriptBuilderError(code, message, cause);
}

// ── Action Classification Helpers ──

const COLUMN_REQUIRED_ACTIONS: readonly RemediationActionTypeV2[] = [
  'trim_whitespace',
  'normalize_placeholders',
  'normalize_casing',
  'convert_disguised_numbers',
];

const DATASET_SCOPE_ACTIONS: readonly RemediationActionTypeV2[] = [
  'drop_exact_duplicates',
];

function actionRequiresColumn(actionType: RemediationActionTypeV2): boolean {
  return COLUMN_REQUIRED_ACTIONS.includes(actionType);
}

const VALID_APPROVAL_STATUSES = new Set<string>(['approved', 'pending', 'rejected']);

// ── Shape Validation ──

function validatePlanShape(plan: unknown): asserts plan is RemediationPlanV2 {
  if (!plan || typeof plan !== 'object') {
    builderError('SCRIPT_BUILD_REFERENCE_INVALID', 'plan must be a non-null object');
  }

  const p = plan as Record<string, unknown>;

  if (!Array.isArray(p.plan)) {
    builderError('SCRIPT_BUILD_REFERENCE_INVALID', 'plan.plan must be an array');
  }

  for (let i = 0; i < (p.plan as unknown[]).length; i++) {
    const action = (p.plan as unknown[])[i];
    if (!action || typeof action !== 'object') {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `plan.plan[${i}] must be a non-null object`);
    }

    const a = action as Record<string, unknown>;

    if (!a.actionId || typeof a.actionId !== 'string') {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `plan.plan[${i}] has missing or non-string actionId`);
    }

    if (typeof a.approvalStatus !== 'string' || !VALID_APPROVAL_STATUSES.has(a.approvalStatus as string)) {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `plan.plan[${i}] "${a.actionId}" has invalid approvalStatus "${String(a.approvalStatus)}"`);
    }
  }
}

// ── Precondition Validation ──

function validatePreconditions(
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
): void {
  if (!buildContext?.correspondenceEvidence?.valid) {
    builderError('SCRIPT_BUILD_CONTEXT_INVALID', 'correspondenceEvidence.valid is false or missing');
  }

  if (!plan.planId) {
    builderError('SCRIPT_BUILD_REMEDIATION_MISMATCH', 'plan.planId is empty');
  }

  if (plan.datasetFingerprint !== buildContext.sourceDatasetFingerprint) {
    builderError(
      'SCRIPT_BUILD_REMEDIATION_MISMATCH',
      `plan.datasetFingerprint "${plan.datasetFingerprint}" does not match buildContext.sourceDatasetFingerprint "${buildContext.sourceDatasetFingerprint}"`,
    );
  }

  if (plan.datasetFingerprint !== buildContext.remediationContext.datasetFingerprint) {
    builderError(
      'SCRIPT_BUILD_REMEDIATION_MISMATCH',
      `plan.datasetFingerprint "${plan.datasetFingerprint}" does not match remediationContext.datasetFingerprint "${buildContext.remediationContext.datasetFingerprint}"`,
    );
  }

  if (plan.evidenceEnvelopeRef !== buildContext.remediationContext.evidenceEnvelopeRef) {
    builderError(
      'SCRIPT_BUILD_REMEDIATION_MISMATCH',
      `plan.evidenceEnvelopeRef "${plan.evidenceEnvelopeRef}" does not match remediationContext.evidenceEnvelopeRef "${buildContext.remediationContext.evidenceEnvelopeRef}"`,
    );
  }

  const actionIds = new Set<string>();
  for (const action of plan.plan) {
    if (!action.actionId) {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `action at index ${plan.plan.indexOf(action)} has empty actionId`);
    }
    if (actionIds.has(action.actionId)) {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `duplicate actionId "${action.actionId}"`);
    }
    actionIds.add(action.actionId);
  }
}

// ── Renderer Validation (individual, for error attribution) ──

function validateActionWithRenderer(
  action: RemediationActionV2,
  columnRef: ColumnRef | null,
  columnRegistry: ScriptBuildContextV2['columnRegistry'],
): void {
  try {
    renderActionV2(action, columnRef, columnRegistry);
  } catch (e) {
    if (e instanceof ScriptRendererError) {
      builderError('SCRIPT_BUILD_RENDER_FAILED', e.message, {
        rendererErrorCode: e.code,
        actionId: action.actionId,
        actionType: action.actionType,
      });
    }
    throw e;
  }
}

// ── Core Builder (pure, no clock) ──

export function buildScriptCandidateCoreV2(
  planInput: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
): ScriptContractCandidateCoreV2 {
  validatePlanShape(planInput);
  const plan = planInput as RemediationPlanV2;

  validatePreconditions(plan, buildContext);

  const acceptedActionIds: string[] = [];
  const rejectedActionIds: string[] = [];
  const excludedActionIds: ScriptExcludedActionV2[] = [];
  const renderableActions: RenderableScriptActionV2[] = [];
  const usedColumnIds = new Set<string>();

  for (const action of plan.plan) {
    // ── Rejected ──
    if (action.approvalStatus === 'rejected') {
      rejectedActionIds.push(action.actionId);
      continue;
    }

    // ── Pending ──
    if (action.approvalStatus === 'pending') {
      excludedActionIds.push({ actionId: action.actionId, reason: 'pending' });
      continue;
    }

    // ── Approved ──
    if (action.approvalStatus === 'approved') {
      // requires_human_review → never accepted
      if (action.actionType === 'requires_human_review') {
        excludedActionIds.push({ actionId: action.actionId, reason: 'unsupported_action' });
        continue;
      }

      // drop_exact_duplicates → dataset scope, no column needed
      if (DATASET_SCOPE_ACTIONS.includes(action.actionType)) {
        validateActionWithRenderer(action, null, buildContext.columnRegistry);
        renderableActions.push({ action, columnRef: null });
        acceptedActionIds.push(action.actionId);
        continue;
      }

      // Actions that require a column
      if (actionRequiresColumn(action.actionType)) {
        if (!action.columnId) {
          excludedActionIds.push({ actionId: action.actionId, reason: 'missing_column' });
          continue;
        }

        const registryCol = buildContext.columnRegistry.byColumnId.get(action.columnId);
        if (!registryCol) {
          excludedActionIds.push({ actionId: action.actionId, reason: 'missing_column' });
          continue;
        }

        if (registryCol.isAmbiguous) {
          excludedActionIds.push({ actionId: action.actionId, reason: 'ambiguous_column' });
          continue;
        }

        validateActionWithRenderer(action, registryCol, buildContext.columnRegistry);
        renderableActions.push({ action, columnRef: registryCol });
        acceptedActionIds.push(action.actionId);
        usedColumnIds.add(registryCol.columnId);
        continue;
      }

      // Unknown actionType → excluded
      excludedActionIds.push({ actionId: action.actionId, reason: 'unsupported_action' as ScriptExclusionReasonV2 });
    }
  }

  // ── Build script via renderer ──
  let scriptText: string;
  try {
    scriptText = buildScriptText(renderableActions, buildContext.columnRegistry);
  } catch (e) {
    if (e instanceof ScriptRendererError) {
      builderError('SCRIPT_BUILD_RENDER_FAILED', e.message, { rendererErrorCode: (e as ScriptRendererError).code });
    }
    throw e;
  }

  // ── Build columnRefs (deduplicated, sorted by columnId, from registry) ──
  const columnRefs: ColumnRef[] = [];
  const seenColumns = new Set<string>();
  for (const columnId of [...usedColumnIds].sort()) {
    if (!seenColumns.has(columnId)) {
      const registryCol = buildContext.columnRegistry.byColumnId.get(columnId);
      if (registryCol) {
        columnRefs.push({ ...registryCol });
        seenColumns.add(columnId);
      }
    }
  }

  // ── Invariant checks ──
  const allActionIds = plan.plan.map(a => a.actionId);
  const coveredIds = new Set([
    ...acceptedActionIds,
    ...rejectedActionIds,
    ...excludedActionIds.map(e => e.actionId),
  ]);

  if (coveredIds.size !== allActionIds.length) {
    builderError('SCRIPT_BUILD_REFERENCE_INVALID', 'not all plan actions are covered');
  }

  for (const id of allActionIds) {
    if (!coveredIds.has(id)) {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `action "${id}" not in any partition`);
    }
  }

  // Disjoint: rejected ∩ excluded = ∅
  const rejectedSet = new Set(rejectedActionIds);
  for (const ex of excludedActionIds) {
    if (rejectedSet.has(ex.actionId)) {
      builderError('SCRIPT_BUILD_REFERENCE_INVALID', `action "${ex.actionId}" is in both rejected and excluded`);
    }
  }

  return {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    remediationRef: plan.planId,
    datasetFingerprint: plan.datasetFingerprint,
    acceptedActionIds,
    rejectedActionIds,
    excludedActionIds,
    columnRefs,
    rendererVersion: SCRIPT_RENDERER_VERSION,
    placeholderVocabularyVersion: PLACEHOLDER_VOCABULARY_VERSION,
    scriptText,
    cleanDatasetFn: CLEAN_DATASET_FN,
  };
}

// ── generatedAt validation ──

function validateGeneratedAt(generatedAt: string): void {
  if (typeof generatedAt !== 'string') {
    builderError('SCRIPT_BUILD_GENERATED_AT_INVALID', `generatedAt must be a string, got ${typeof generatedAt}`);
  }

  const parsed = new Date(generatedAt);
  if (Number.isNaN(parsed.getTime())) {
    builderError('SCRIPT_BUILD_GENERATED_AT_INVALID', `generatedAt "${generatedAt}" is not a valid date`);
  }

  if (parsed.toISOString() !== generatedAt) {
    builderError('SCRIPT_BUILD_GENERATED_AT_INVALID', `generatedAt "${generatedAt}" is not canonical ISO UTC (expected "${parsed.toISOString()}")`);
  }
}

// ── Full Builder (with generatedAt) ──

export function buildScriptCandidateV2(
  planInput: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options?: ScriptCandidateBuildOptionsV2,
): ScriptContractCandidateV2 {
  const core = buildScriptCandidateCoreV2(planInput, buildContext);

  const generatedAt = options?.generatedAt ?? new Date().toISOString();

  validateGeneratedAt(generatedAt);

  return {
    ...core,
    generatedAt,
  };
}

// ── Hash ──

export function buildScriptHashPayloadV2(
  candidate: ScriptContractCandidateV2 | ScriptContractCandidateCoreV2,
): Record<string, unknown> {
  return {
    remediationRef: candidate.remediationRef,
    datasetFingerprint: candidate.datasetFingerprint,
    acceptedActionIds: [...candidate.acceptedActionIds].sort(),
    columnRefs: [...candidate.columnRefs]
      .sort((a, b) => a.columnId.localeCompare(b.columnId)),
    rendererVersion: candidate.rendererVersion,
    placeholderVocabularyVersion: candidate.placeholderVocabularyVersion,
    scriptText: candidate.scriptText,
    cleanDatasetFn: candidate.cleanDatasetFn,
  };
}

export function computeScriptHashV2(
  candidate: ScriptContractCandidateV2 | ScriptContractCandidateCoreV2,
): string {
  const payload = buildScriptHashPayloadV2(candidate);
  return sha256hex(canonicalJson(payload));
}

// ── pythonSyntax validation ──

const VALID_PYTHON_SYNTAX_STATES = new Set<PythonSyntaxState>(['passed', 'not_run', 'failed']);

function validatePythonSyntax(validationResult: ScriptValidationResultV2): void {
  if (!validationResult.pythonSyntax || typeof validationResult.pythonSyntax !== 'object') {
    builderError('SCRIPT_FINALIZATION_VALIDATION_REQUIRED', 'validationResult.pythonSyntax is missing or not an object');
  }

  const state = (validationResult.pythonSyntax as Record<string, unknown>).state;
  if (typeof state !== 'string' || !VALID_PYTHON_SYNTAX_STATES.has(state as PythonSyntaxState)) {
    builderError(
      'SCRIPT_FINALIZATION_VALIDATION_REQUIRED',
      `validationResult.pythonSyntax.state must be "passed", "not_run", or "failed", got "${String(state)}"`,
    );
  }
}

// ── Defensive copy of validationResult ──

function copyValidationError(err: ValidationErrorV2): ValidationErrorV2 {
  return {
    code: err.code,
    path: err.path,
    message: err.message,
    value: err.value,
  };
}

function copyValidationResult(vr: ScriptValidationResultV2): ScriptValidationResultV2 {
  return {
    valid: vr.valid,
    errors: vr.errors.map(e => copyValidationError(e)),
    warnings: vr.warnings.map(e => copyValidationError(e)),
    pythonSyntax: {
      state: vr.pythonSyntax.state,
      engine: vr.pythonSyntax?.engine,
      message: vr.pythonSyntax?.message,
    },
  };
}

// ── Finalizer ──

export function finalizeScriptContractV2(
  candidate: ScriptContractCandidateV2,
  validationResult: ScriptValidationResultV2,
): ScriptContractV2 {
  if (validationResult === null || validationResult === undefined) {
    builderError('SCRIPT_FINALIZATION_VALIDATION_REQUIRED', 'validationResult is required');
  }

  validatePythonSyntax(validationResult);

  if (validationResult.valid !== true) {
    builderError('SCRIPT_FINALIZATION_VALIDATION_FAILED', 'validationResult.valid is not true');
  }

  if (validationResult.pythonSyntax.state === 'failed') {
    builderError('SCRIPT_FINALIZATION_SYNTAX_FAILED', 'Python syntax validation failed');
  }

  const scriptHash = computeScriptHashV2(candidate);

  return {
    contractId: candidate.contractId,
    contractVersion: candidate.contractVersion,
    remediationRef: candidate.remediationRef,
    datasetFingerprint: candidate.datasetFingerprint,
    acceptedActionIds: [...candidate.acceptedActionIds],
    rejectedActionIds: [...candidate.rejectedActionIds],
    excludedActionIds: candidate.excludedActionIds.map(e => ({ ...e })),
    columnRefs: candidate.columnRefs.map(c => ({ ...c })),
    rendererVersion: candidate.rendererVersion,
    placeholderVocabularyVersion: candidate.placeholderVocabularyVersion,
    scriptText: candidate.scriptText,
    cleanDatasetFn: candidate.cleanDatasetFn,
    scriptHash,
    validationResult: copyValidationResult(validationResult),
    generatedAt: candidate.generatedAt,
  };
}
