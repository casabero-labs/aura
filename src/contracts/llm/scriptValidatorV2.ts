/**
 * Script Validator v2 — Phase 4 Loop 4R.1.
 *
 * Validates ScriptContractCandidateV2 and verifies ScriptContractV2.
 * Totally fail-closed: never throws, always returns ScriptValidationResultV2.
 */

import type {
  ScriptContractCandidateV2,
  ScriptContractV2,
  ScriptValidationResultV2,
  ValidationErrorV2,
  ColumnRef,
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptExcludedActionV2,
  PythonSyntaxState,
} from './types';
import { SCRIPT_RENDERER_VERSION } from './scriptRendererV2';
import { PLACEHOLDER_VOCABULARY_VERSION } from './placeholderVocabulary';
import { buildScriptCandidateCoreV2, computeScriptHashV2 } from './scriptBuilderV2';
import type { ScriptErrorCode, ScriptWarningCode } from './scriptErrorCodes';

// ── Options ──

export interface PythonSyntaxCheckResultV2 {
  state: PythonSyntaxState;
  engine?: string;
  message?: string;
}

export interface ScriptValidationOptionsV2 {
  syntaxChecker?: (
    scriptText: string,
  ) => PythonSyntaxCheckResultV2;
}

// ── Internal State ──

interface ValState {
  errors: ValidationErrorV2[];
  warnings: ValidationErrorV2[];
  syntaxResult: PythonSyntaxCheckResultV2;
}

function verror(state: ValState, code: string, path: string, message: string, value?: unknown): void {
  state.errors.push({ code, path, message, value });
}

function vwarn(state: ValState, code: string, path: string, message: string, value?: unknown): void {
  state.warnings.push({ code, path, message, value });
}

// ── Safe Helpers (never throw) ──

function safeType<T>(value: unknown, expected: string, path: string, state: ValState): value is T {
  if (typeof value !== expected) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, `expected ${expected}, got ${typeof value}`);
    return false;
  }
  return true;
}

function safeString(value: unknown, path: string, state: ValState, allowEmpty = false): value is string {
  if (!safeType<string>(value, 'string', path, state)) return false;
  if (!allowEmpty && (value as string).length === 0) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, 'string must not be empty');
    return false;
  }
  return true;
}

function safeFiniteNumber(value: unknown, path: string, state: ValState): value is number {
  if (typeof value !== 'number') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, `expected number, got ${typeof value}`);
    return false;
  }
  if (!Number.isFinite(value)) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, `expected finite number, got ${value}`);
    return false;
  }
  return true;
}

function safeNonNegativeInteger(value: unknown, path: string, state: ValState): value is number {
  if (!safeFiniteNumber(value, path, state)) return false;
  if (!Number.isInteger(value) || value < 0) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, `expected non-negative integer, got ${value}`);
    return false;
  }
  return true;
}

function safeArray(value: unknown, path: string, state: ValState): value is unknown[] {
  if (!Array.isArray(value)) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, `expected array, got ${typeof value}`);
    return false;
  }
  return true;
}

function safeObj(value: unknown, path: string, state: ValState): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', path, `expected non-null object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
    return false;
  }
  return true;
}

function safeStrArray(value: unknown, path: string, state: ValState): string[] | null {
  if (!safeArray(value, path, state)) return null;
  const arr = value as unknown[];
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'string' || arr[i] === '') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `${path}[${i}]`, 'must be non-empty string');
      return null;
    }
  }
  return arr as string[];
}

function safeNoDupIds(ids: string[], path: string, state: ValState): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      verror(state, 'SCRIPT_REFERENCE_INVALID', path, `duplicate id "${id}"`);
      return false;
    }
    seen.add(id);
  }
  return true;
}

const CANDIDATE_KEYS = new Set([
  'contractId', 'contractVersion', 'remediationRef', 'inputReceiptRef', 'datasetFingerprint',
  'acceptedActionIds', 'rejectedActionIds', 'excludedActionIds', 'columnRefs',
  'rendererVersion', 'placeholderVocabularyVersion', 'scriptText', 'cleanDatasetFn', 'generatedAt',
]);

const CONTRACT_EXTRA_KEYS = new Set(['scriptHash', 'validationResult']);

const VALID_EXCLUSION_REASONS = new Set(['pending', 'ambiguous_column', 'missing_column', 'unsupported_action']);

const COLUMN_REQUIRED_ACTIONS = new Set(['trim_whitespace', 'normalize_placeholders', 'normalize_casing', 'convert_disguised_numbers']);

// ── Shape Validation (V1-V7) ──

function validateShape(candidate: unknown, isFinal: boolean, state: ValState): Record<string, unknown> | null {
  if (!safeObj(candidate, '$', state)) return null;

  const c = candidate as Record<string, unknown>;

  const expectedKeys = new Set(isFinal
    ? [...CANDIDATE_KEYS, ...CONTRACT_EXTRA_KEYS]
    : CANDIDATE_KEYS);

  for (const key of Object.keys(c)) {
    if (!expectedKeys.has(key)) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.${key}`, `unexpected property "${key}"`);
    }
  }

  if (isFinal) {
    for (const key of expectedKeys) {
      if (!(key in c)) {
        verror(state, 'SCRIPT_CONTRACT_INVALID', `$.${key}`, 'required field missing');
      }
    }
  }

  if (c.contractId !== 'aura.script.v2') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.contractId', `expected "aura.script.v2", got "${String(c.contractId)}"`);
  }

  if (c.contractVersion !== '2.0.0') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.contractVersion', `expected "2.0.0", got "${String(c.contractVersion)}"`);
  }

  if (c.cleanDatasetFn !== 'clean_dataset') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.cleanDatasetFn', `expected "clean_dataset", got "${String(c.cleanDatasetFn)}"`);
  }

  if (c.rendererVersion !== SCRIPT_RENDERER_VERSION) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.rendererVersion', `expected "${SCRIPT_RENDERER_VERSION}"`);
  }
  if (c.placeholderVocabularyVersion !== PLACEHOLDER_VOCABULARY_VERSION) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.placeholderVocabularyVersion', `expected "${PLACEHOLDER_VOCABULARY_VERSION}"`);
  }

  if (safeString(c.generatedAt, '$.generatedAt', state)) {
    const d = new Date(c.generatedAt as string);
    if (isNaN(d.getTime()) || d.toISOString() !== c.generatedAt) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', '$.generatedAt', `not canonical ISO UTC: "${c.generatedAt}"`);
    }
  }

  safeString(c.scriptText, '$.scriptText', state);
  if (typeof c.scriptText === 'string' && !(c.scriptText as string).includes('def clean_dataset(df):')) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.scriptText', 'missing def clean_dataset(df):');
  }

  safeString(c.remediationRef, '$.remediationRef', state);
  safeString(c.datasetFingerprint, '$.datasetFingerprint', state);

  const acceptedIds = safeStrArray(c.acceptedActionIds, '$.acceptedActionIds', state);
  if (acceptedIds) safeNoDupIds(acceptedIds, '$.acceptedActionIds', state);

  const rejectedIds = safeStrArray(c.rejectedActionIds, '$.rejectedActionIds', state);
  if (rejectedIds) safeNoDupIds(rejectedIds, '$.rejectedActionIds', state);

  if (safeArray(c.excludedActionIds, '$.excludedActionIds', state)) {
    const exArr = c.excludedActionIds as unknown[];
    const seenEx = new Set<string>();
    for (let i = 0; i < exArr.length; i++) {
      if (safeObj(exArr[i], `$.excludedActionIds[${i}]`, state)) {
        const ex = exArr[i] as Record<string, unknown>;
        safeString(ex.actionId, `$.excludedActionIds[${i}].actionId`, state);
        const aid = ex.actionId as string;
        if (aid && seenEx.has(aid)) {
          verror(state, 'SCRIPT_REFERENCE_INVALID', `$.excludedActionIds[${i}]`, `duplicate actionId "${aid}"`);
        }
        if (aid) seenEx.add(aid);
        if (!VALID_EXCLUSION_REASONS.has(ex.reason as string)) {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.excludedActionIds[${i}].reason`, `invalid reason "${String(ex.reason)}"`);
        }
        for (const k of Object.keys(ex)) {
          if (k !== 'actionId' && k !== 'reason') {
            verror(state, 'SCRIPT_CONTRACT_INVALID', `$.excludedActionIds[${i}].${k}`, `unexpected property "${k}"`);
          }
        }
      }
    }
  }

  if (safeArray(c.columnRefs, '$.columnRefs', state)) {
    const colsArr = c.columnRefs as unknown[];
    const seenCols = new Set<string>();
    for (let i = 0; i < colsArr.length; i++) {
      if (safeObj(colsArr[i], `$.columnRefs[${i}]`, state)) {
        const col = colsArr[i] as Record<string, unknown>;
        safeString(col.columnId, `$.columnRefs[${i}].columnId`, state);
        safeString(col.name, `$.columnRefs[${i}].name`, state);
        safeNonNegativeInteger(col.position, `$.columnRefs[${i}].position`, state);
        safeNonNegativeInteger(col.duplicateOrdinal, `$.columnRefs[${i}].duplicateOrdinal`, state);
        safeString(col.pythonLiteral, `$.columnRefs[${i}].pythonLiteral`, state);
        if (typeof col.isAmbiguous !== 'boolean') {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.columnRefs[${i}].isAmbiguous`, 'must be boolean');
        }
        if (typeof col.isDuplicate !== 'boolean') {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.columnRefs[${i}].isDuplicate`, 'must be boolean');
        }
        if (typeof col.isReservedWord !== 'boolean') {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.columnRefs[${i}].isReservedWord`, 'must be boolean');
        }

        if (col.columnId && seenCols.has(col.columnId as string)) {
          verror(state, 'SCRIPT_REFERENCE_INVALID', `$.columnRefs[${i}].columnId`, `duplicate columnId "${col.columnId}"`);
        }
        if (col.columnId) seenCols.add(col.columnId as string);

        const colKeys = new Set(['columnId', 'name', 'position', 'duplicateOrdinal', 'pythonLiteral', 'isAmbiguous', 'isDuplicate', 'isReservedWord']);
        for (const k of Object.keys(col)) {
          if (!colKeys.has(k)) {
            verror(state, 'SCRIPT_CONTRACT_INVALID', `$.columnRefs[${i}].${k}`, `unexpected property "${k}"`);
          }
        }
      }
    }
  }

  return c;
}

// ── Correspondence Validation (V8-V15) ──

function validateCorrespondence(
  c: Record<string, unknown>,
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  state: ValState,
): void {
  const planMap = new Map<string, RemediationActionV2>();
  for (const action of plan.plan) {
    planMap.set(action.actionId, action);
  }

  if (c.remediationRef !== plan.planId) {
    verror(state, 'SCRIPT_REMEDIATION_MISMATCH', '$.remediationRef', `expected "${plan.planId}", got "${String(c.remediationRef)}"`);
  }

  if (c.datasetFingerprint !== plan.datasetFingerprint) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.datasetFingerprint', `fingerprint mismatch`);
  }

  if (!buildContext.correspondenceEvidence.valid) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.context', 'correspondenceEvidence.valid is false');
  }

  if (plan.datasetFingerprint !== buildContext.sourceDatasetFingerprint) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.context', 'fingerprint mismatch with context');
  }

  if (plan.evidenceEnvelopeRef !== buildContext.remediationContext.evidenceEnvelopeRef) {
    verror(state, 'SCRIPT_REMEDIATION_MISMATCH', '$.context', 'evidenceEnvelopeRef mismatch');
  }

  const acceptedIds = (c.acceptedActionIds as string[]) || [];
  const rejectedIds = (c.rejectedActionIds as string[]) || [];
  const excludedIds = ((c.excludedActionIds as ScriptExcludedActionV2[]) || []).map(e => e.actionId);

  for (const id of acceptedIds) {
    if (!planMap.has(id)) verror(state, 'SCRIPT_REFERENCE_INVALID', '$.acceptedActionIds', `actionId "${id}" not in plan`);
  }
  for (const id of rejectedIds) {
    if (!planMap.has(id)) verror(state, 'SCRIPT_REFERENCE_INVALID', '$.rejectedActionIds', `actionId "${id}" not in plan`);
  }
  for (const id of excludedIds) {
    if (!planMap.has(id)) verror(state, 'SCRIPT_REFERENCE_INVALID', '$.excludedActionIds', `actionId "${id}" not in plan`);
  }

  const allCovered = new Set([...acceptedIds, ...rejectedIds, ...excludedIds]);
  for (const action of plan.plan) {
    if (!allCovered.has(action.actionId)) {
      verror(state, 'SCRIPT_COVERAGE_INVALID', '$.plan', `action "${action.actionId}" not covered`);
    }
  }
  if (allCovered.size !== plan.plan.length) {
    verror(state, 'SCRIPT_COVERAGE_INVALID', '$.plan', 'extra actionIds not in plan');
  }

  const registry = buildContext.columnRegistry;
  const refs = (c.columnRefs as ColumnRef[]) || [];
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const regCol = registry.byColumnId.get(ref.columnId);
    if (!regCol) {
      verror(state, 'SCRIPT_REFERENCE_INVALID', `$.columnRefs[${i}]`, `columnId "${ref.columnId}" not in registry`);
      continue;
    }
    if (
      ref.columnId !== regCol.columnId ||
      ref.name !== regCol.name ||
      ref.position !== regCol.position ||
      ref.duplicateOrdinal !== regCol.duplicateOrdinal ||
      ref.pythonLiteral !== regCol.pythonLiteral ||
      ref.isAmbiguous !== regCol.isAmbiguous ||
      ref.isDuplicate !== regCol.isDuplicate ||
      ref.isReservedWord !== regCol.isReservedWord
    ) {
      verror(state, 'SCRIPT_REFERENCE_INVALID', `$.columnRefs[${i}]`, `columnRef does not match registry`);
    }
    if (ref.isAmbiguous) {
      verror(state, 'SCRIPT_COLUMN_AMBIGUOUS', `$.columnRefs[${i}]`, `ambiguous column "${ref.columnId}"`);
    }
  }
}

// ── HITL / Partition Validation (V16-V21) ──

function deriveExpectedReason(action: RemediationActionV2, registry: { byColumnId: ReadonlyMap<string, ColumnRef> }, acceptedIds: Set<string>): string | undefined {
  if (action.approvalStatus === 'pending') return 'pending';
  if (action.approvalStatus === 'rejected') return 'unsupported_action';
  if (action.approvalStatus === 'approved') {
    if (action.actionType === 'requires_human_review') return 'unsupported_action';
    if (COLUMN_REQUIRED_ACTIONS.has(action.actionType)) {
      if (!action.columnId) return 'missing_column';
      const regCol = registry.byColumnId.get(action.columnId);
      if (!regCol) return 'missing_column';
      if (regCol.isAmbiguous) return 'ambiguous_column';
    }
  }
  return undefined;
}

function validatePartition(
  c: Record<string, unknown>,
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  state: ValState,
): void {
  const planMap = new Map<string, RemediationActionV2>();
  for (const action of plan.plan) {
    planMap.set(action.actionId, action);
  }

  const acceptedIds = new Set(c.acceptedActionIds as string[] || []);
  const rejectedIds = new Set(c.rejectedActionIds as string[] || []);
  const excluded = (c.excludedActionIds as ScriptExcludedActionV2[]) || [];
  const excludedIds = new Set(excluded.map(e => e.actionId));

  for (const id of acceptedIds) {
    const action = planMap.get(id);
    if (action && action.approvalStatus !== 'approved') {
      verror(state, 'SCRIPT_APPROVAL_INVALID', `$.acceptedActionIds`, `"${id}" is not approved`);
    }
  }

  for (const id of rejectedIds) {
    const action = planMap.get(id);
    if (action && action.approvalStatus !== 'rejected') {
      verror(state, 'SCRIPT_APPROVAL_INVALID', `$.rejectedActionIds`, `"${id}" is not rejected`);
    }
  }

  const interAcceptedRejected = [...acceptedIds].filter(id => rejectedIds.has(id));
  for (const id of interAcceptedRejected) {
    verror(state, 'SCRIPT_PARTITION_INVALID', '$.acceptedActionIds', `"${id}" is in both accepted and rejected`);
  }

  const interAcceptedExcluded = [...acceptedIds].filter(id => excludedIds.has(id));
  for (const id of interAcceptedExcluded) {
    verror(state, 'SCRIPT_PARTITION_INVALID', '$.acceptedActionIds', `"${id}" is in both accepted and excluded`);
  }

  const interRejectedExcluded = [...rejectedIds].filter(id => excludedIds.has(id));
  for (const id of interRejectedExcluded) {
    verror(state, 'SCRIPT_PARTITION_INVALID', '$.rejectedActionIds', `"${id}" is in both rejected and excluded`);
  }

  for (const ex of excluded) {
    if (rejectedIds.has(ex.actionId)) {
      verror(state, 'SCRIPT_PARTITION_INVALID', `$.excludedActionIds`, `"${ex.actionId}" is both rejected and excluded`);
    }
  }

  const registry = buildContext.columnRegistry;

  for (const action of plan.plan) {
    if (action.approvalStatus === 'pending') {
      const found = excluded.find(e => e.actionId === action.actionId);
      if (!found) {
        verror(state, 'SCRIPT_APPROVAL_INVALID', `$.plan`, `pending action "${action.actionId}" not in excluded`);
      } else if (found.reason !== 'pending') {
        verror(state, 'SCRIPT_APPROVAL_INVALID', `$.excludedActionIds`, `pending action "${action.actionId}" has reason "${found.reason}"`);
      }
    }

    if (action.approvalStatus === 'rejected') {
      const found = excluded.find(e => e.actionId === action.actionId);
      if (found && found.reason !== 'unsupported_action' && found.reason !== 'missing_column' && found.reason !== 'ambiguous_column') {
        verror(state, 'SCRIPT_APPROVAL_INVALID', `$.excludedActionIds`, `rejected action "${action.actionId}" has unexpected reason "${found.reason}"`);
      }
    }

    if (action.approvalStatus === 'approved') {
      const expectedReason = deriveExpectedReason(action, registry, acceptedIds);
      if (expectedReason === 'missing_column' || expectedReason === 'ambiguous_column' || expectedReason === 'unsupported_action') {
        const found = excluded.find(e => e.actionId === action.actionId);
        if (!found) {
          verror(state, 'SCRIPT_APPROVAL_INVALID', `$.plan`, `action "${action.actionId}" with reason "${expectedReason}" not in excluded`);
        } else if (found.reason !== expectedReason) {
          verror(state, 'SCRIPT_APPROVAL_INVALID', `$.excludedActionIds`, `action "${action.actionId}" expected reason "${expectedReason}", got "${found.reason}"`);
        }
      }
    }
  }

  for (const id of acceptedIds) {
    const action = planMap.get(id);
    if (action && action.actionType === 'requires_human_review') {
      verror(state, 'SCRIPT_APPROVAL_INVALID', `$.acceptedActionIds`, `"${id}" is requires_human_review`);
    }
  }

  for (const action of plan.plan) {
    if (action.approvalStatus !== 'approved') continue;
    if (action.actionType === 'requires_human_review') continue;

    if (COLUMN_REQUIRED_ACTIONS.has(action.actionType)) {
      if (!action.columnId) {
        const inAccepted = acceptedIds.has(action.actionId);
        if (inAccepted) {
          verror(state, 'SCRIPT_APPROVAL_INVALID', `$.acceptedActionIds`, `"${action.actionId}" approved but missing column`);
        }
        continue;
      }

      const regCol = registry.byColumnId.get(action.columnId);
      if (!regCol) {
        if (acceptedIds.has(action.actionId)) {
          verror(state, 'SCRIPT_REFERENCE_INVALID', `$.acceptedActionIds`, `"${action.actionId}" column not in registry`);
        }
        continue;
      }

      if (regCol.isAmbiguous) {
        if (acceptedIds.has(action.actionId)) {
          verror(state, 'SCRIPT_COLUMN_AMBIGUOUS', `$.acceptedActionIds`, `"${action.actionId}" column is ambiguous`);
        }
      }
    }
  }
}

// ── Column Validation (V22-V25) ──

function validateColumns(
  c: Record<string, unknown>,
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  state: ValState,
): void {
  const registry = buildContext.columnRegistry;
  const acceptedIds = new Set(c.acceptedActionIds as string[] || []);
  const refs = (c.columnRefs as ColumnRef[]) || [];

  const expectedCols = new Map<string, ColumnRef>();
  const planMap = new Map<string, RemediationActionV2>();
  for (const action of plan.plan) planMap.set(action.actionId, action);

  for (const id of acceptedIds) {
    const action = planMap.get(id);
    if (!action || action.actionType === 'drop_exact_duplicates') continue;

    if (action.columnId) {
      const regCol = registry.byColumnId.get(action.columnId);
      if (regCol && !expectedCols.has(regCol.columnId)) {
        expectedCols.set(regCol.columnId, regCol);
      }
    }
  }

  for (const [, col] of expectedCols) {
    if (col.isAmbiguous) {
      verror(state, 'SCRIPT_COLUMN_AMBIGUOUS', '$.columnRefs', `ambiguous column "${col.columnId}" referenced by accepted action`);
    }
  }

  const expectedIds = [...expectedCols.keys()].sort();
  const actualIds = refs.map(r => r.columnId).filter(Boolean);

  if (expectedIds.length !== actualIds.length) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.columnRefs', `expected ${expectedIds.length} columns, got ${actualIds.length}`);
  }

  for (let i = 0; i < Math.min(expectedIds.length, actualIds.length); i++) {
    const expected = registry.byColumnId.get(expectedIds[i]);
    const actual = refs.find(r => r.columnId === expectedIds[i]);
    if (!actual) {
      verror(state, 'SCRIPT_REFERENCE_INVALID', '$.columnRefs', `missing column "${expectedIds[i]}"`);
      continue;
    }

    if (actual.columnId !== expectedIds[i]) {
      verror(state, 'SCRIPT_RENDER_MISMATCH', '$.columnRefs', `wrong order at index ${i}`);
    }

    if (expected && !columnsMatch(actual, expected)) {
      verror(state, 'SCRIPT_REFERENCE_INVALID', `$.columnRefs[${i}]`, `column "${actual.columnId}" does not match registry`);
    }
  }

  for (let i = 1; i < refs.length; i++) {
    if (refs[i - 1].columnId.localeCompare(refs[i].columnId) >= 0) {
      verror(state, 'SCRIPT_RENDER_MISMATCH', '$.columnRefs', 'not sorted by columnId');
      break;
    }
  }
}

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

// ── Lexical Masker ──

function maskStringsAndComments(script: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < script.length) {
    const ch = script[i];

    if (script.startsWith("'''", i)) {
      result.push("'''");
      i += 3;
      while (i < script.length) {
        if (script.startsWith("'''", i)) {
          result.push("'''");
          i += 3;
          break;
        }
        result.push(' ');
        i++;
      }
      continue;
    }

    if (script.startsWith('"""', i)) {
      result.push('"""');
      i += 3;
      while (i < script.length) {
        if (script.startsWith('"""', i)) {
          result.push('"""');
          i += 3;
          break;
        }
        result.push(' ');
        i++;
      }
      continue;
    }

    if (ch === '#') {
      result.push('#');
      i++;
      while (i < script.length && script[i] !== '\n') {
        result.push(' ');
        i++;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      const prefixMap: Record<string, string[]> = {
        'r': ["r'", 'r"'],
        'R': ["R'", 'R"'],
        'f': ["f'", 'f"'],
        'F': ["F'", 'F"'],
        'b': ["b'", 'b"'],
        'B': ["B'", 'B"'],
      };
      let matchedPrefix: string | null = null;
      if (i + 1 < script.length && prefixMap[ch]?.includes(script.substring(i, i + 2))) {
        matchedPrefix = script.substring(i, i + 2);
      }
      if (matchedPrefix) {
        result.push(matchedPrefix);
        i += 2;
      } else {
        result.push(ch === "'" ? "'" : '"');
        i++;
      }

      const close = matchedPrefix ? matchedPrefix[1] : ch;
      while (i < script.length) {
        if (script[i] === '\\' && i + 1 < script.length) {
          result.push(' ');
          result.push(' ');
          i += 2;
        } else if (script[i] === close) {
          result.push(close);
          i++;
          break;
        } else {
          result.push(' ');
          i++;
        }
      }
      continue;
    }

    result.push(ch);
    i++;
  }

  return result.join('');
}

// ── Import Whitelist Validation ──

const ALLOWED_IMPORTS: Record<string, string> = {
  'pandas as pd': 'pandas as pd',
  'numpy as np': 'numpy as np',
};

function validateImportWhitelist(scriptText: string, state: ValState): void {
  const masked = maskStringsAndComments(scriptText);

  const lineRe = /^([^#\n]*?)$/gm;
  const importRe = /^\s*import\s+(\S+)\s+as\s+(\S+)\s*(?:#[^\n]*)?$/i;
  const fromRe = /^\s*from\s+\S+\s+import\s+/i;
  const combinedImportRe = /^\s*import\s+\S+\s*,\s*\S+/;
  const indentImportRe = /^\s+import\s+/;
  const semicolonRe = /;\s*import\s+/;
  const continuationRe = /\\\s*$/m;

  const allowedFound = new Set<string>();
  const lines = masked.split('\n');

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    if (fromRe.test(line)) {
      verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', 'from ... import not allowed');
      continue;
    }

    if (combinedImportRe.test(line)) {
      verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `combined import not allowed: "${trimmed}"`);
      continue;
    }

    if (semicolonRe.test(trimmed)) {
      verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `semicolon in import not allowed`);
      continue;
    }

    const match = importRe.exec(line);
    if (match) {
      const module = match[1];
      const alias = match[2];
      const normalized = `${module} as ${alias}`;

      if (indentImportRe.test(line)) {
        verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `indented import not allowed: "${trimmed}"`);
        continue;
      }

      if (continuationRe.test(line.slice(0, match.index + match[0].length))) {
        verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `import continuation not allowed`);
        continue;
      }

      if (!ALLOWED_IMPORTS[normalized]) {
        verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `unauthorized import: "${normalized}"`);
        continue;
      }

      if (allowedFound.has(normalized)) {
        verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `duplicate import: "${normalized}"`);
        continue;
      }

      allowedFound.add(normalized);
      importRe.lastIndex = 0;
      continue;
    }

    if (/^\s*import\s+/.test(line)) {
      const normalized = line.trim().replace(/\s+/g, ' ');
      if (!ALLOWED_IMPORTS[normalized]) {
        verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `unauthorized import: "${normalized}"`);
      }
    }
  }

  const requiredImports = ['pandas as pd', 'numpy as np'];
  for (const req of requiredImports) {
    if (!allowedFound.has(req)) {
      verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `missing required import: "${req}"`);
    }
  }
}

// ── Security: Pattern Scanning on Masked Script ──

function validateSecurity(scriptText: string, state: ValState): void {
  validateImportWhitelist(scriptText, state);

  const masked = maskStringsAndComments(scriptText);

  for (const kw of ['eval', 'exec', '__import__']) {
    const re = new RegExp(`\\b${kw}\\(`, 'i');
    if (re.test(masked)) {
      verror(state, 'SCRIPT_EXECUTABLE_CONTENT', '$.scriptText', `executable content: ${kw}`);
    }
  }

  for (const kw of ['subprocess', 'os.system', 'socket', 'requests', 'urllib', 'http.client']) {
    const escaped = kw.replace('.', '\\.');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(masked)) {
      verror(state, 'SCRIPT_NETWORK_ACCESS', '$.scriptText', `network access: ${kw}`);
    }
  }

  for (const kw of ['open(', 'io.open(', 'pathlib', '__file__']) {
    const escaped = kw.replace('.', '\\.').replace('(', '\\(').replace('_', '_');
    if (new RegExp(escaped, 'i').test(masked)) {
      verror(state, 'SCRIPT_FILE_ACCESS', '$.scriptText', `file access: ${kw}`);
    }
  }

  if (/inplace\s*=\s*True/i.test(masked)) {
    verror(state, 'SCRIPT_DESTRUCTIVE_OPERATION', '$.scriptText', 'inplace=True');
  }
  if (/\bdel\b/.test(masked)) {
    verror(state, 'SCRIPT_DESTRUCTIVE_OPERATION', '$.scriptText', 'del statement');
  }
}

// ── Syntax Validation (V32-V34) ──

const VALID_STATES = new Set(['passed', 'failed', 'not_run']);
const ALLOWED_RESULT_KEYS = new Set(['state', 'engine', 'message']);

function validateSyntax(
  scriptText: string,
  options: ScriptValidationOptionsV2 | undefined,
  state: ValState,
): void {
  if (!options?.syntaxChecker) {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'no syntax checker provided');
    }
    return;
  }

  let rawResult: unknown;
  try {
    rawResult = options.syntaxChecker(scriptText);
  } catch {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'syntax checker threw');
    }
    return;
  }

  if (rawResult === null || rawResult === undefined) {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'syntax checker returned null/undefined');
    }
    return;
  }

  if (typeof rawResult !== 'object') {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', `syntax checker returned ${typeof rawResult}`);
    }
    return;
  }

  if (Array.isArray(rawResult)) {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'syntax checker returned array');
    }
    return;
  }

  const result = rawResult as Record<string, unknown>;

  const stateVal = result.state;
  if (!VALID_STATES.has(stateVal as string)) {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', `invalid syntax state "${String(stateVal)}"`);
    }
    return;
  }

  const engineVal = result.engine;
  if (engineVal !== undefined && typeof engineVal !== 'string') {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', `syntax checker engine must be string`);
    }
    return;
  }

  const msgVal = result.message;
  if (msgVal !== undefined && typeof msgVal !== 'string') {
    state.syntaxResult = { state: 'not_run' };
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', `syntax checker message must be string`);
    }
    return;
  }

  for (const k of Object.keys(result)) {
    if (!ALLOWED_RESULT_KEYS.has(k)) {
      state.syntaxResult = { state: 'not_run' };
      if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
        vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', `unexpected property "${k}" in syntax result`);
      }
      return;
    }
  }

  state.syntaxResult = {
    state: stateVal as PythonSyntaxState,
    engine: typeof engineVal === 'string' ? engineVal : undefined,
    message: typeof msgVal === 'string' ? msgVal : undefined,
  };

  if (stateVal === 'failed') {
    verror(state, 'SCRIPT_SYNTAX_INVALID', '$.scriptText', typeof msgVal === 'string' ? msgVal : 'syntax invalid');
  } else if (stateVal === 'not_run') {
    if (!state.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')) {
      vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'syntax checker returned not_run');
    }
  }
}

// ── Reconstruction (V35) ──

function validateReconstruction(
  c: Record<string, unknown>,
  plan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  state: ValState,
): void {
  let reconstructed: Record<string, unknown>;
  try {
    const core = buildScriptCandidateCoreV2(plan, buildContext);
    reconstructed = core as unknown as Record<string, unknown>;
  } catch (e) {
    verror(state, 'SCRIPT_RENDER_MISMATCH', '$.reconstruction', `reconstruction failed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const fields = [
    'contractId', 'contractVersion', 'remediationRef', 'inputReceiptRef', 'datasetFingerprint',
    'acceptedActionIds', 'rejectedActionIds', 'excludedActionIds', 'columnRefs',
    'rendererVersion', 'placeholderVocabularyVersion', 'scriptText', 'cleanDatasetFn',
  ];

  for (const field of fields) {
    const expected = reconstructed[field];
    const actual = c[field];

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      verror(state, 'SCRIPT_RENDER_MISMATCH', `$.${field}`, 'mismatch between candidate and reconstruction');
    }
  }
}

// ── Embedded validationResult deep validation ──

const VR_REQUIRED_KEYS = new Set(['valid', 'errors', 'warnings', 'pythonSyntax']);

function validateEmbeddedValidationResult(
  vr: unknown,
  state: ValState,
): void {
  if (!safeObj(vr, '$.validationResult', state)) return;

  const r = vr as Record<string, unknown>;

  for (const k of Object.keys(r)) {
    if (!VR_REQUIRED_KEYS.has(k)) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.${k}`, `unexpected property "${k}" in validationResult root`);
    }
  }

  for (const req of ['valid', 'errors', 'warnings', 'pythonSyntax']) {
    if (!(req in r)) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.${req}`, `missing required property "${req}"`);
    }
  }

  if (typeof r.valid !== 'boolean') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.valid', 'must be boolean');
  }

  if (!safeArray(r.errors, '$.validationResult.errors', state)) return;
  const errors = r.errors as unknown[];
  for (let i = 0; i < errors.length; i++) {
    if (!safeObj(errors[i], `$.validationResult.errors[${i}]`, state)) continue;
    const err = errors[i] as Record<string, unknown>;
    if (typeof err.code !== 'string' || err.code === '') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.errors[${i}].code`, 'must be non-empty string');
    }
    if (typeof err.path !== 'string') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.errors[${i}].path`, 'must be string');
    }
    if (typeof err.message !== 'string') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.errors[${i}].message`, 'must be string');
    }
    const allowedErrKeys = new Set(['code', 'path', 'message', 'value']);
    for (const k of Object.keys(err)) {
      if (!allowedErrKeys.has(k)) {
        verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.errors[${i}].${k}`, `unexpected property "${k}"`);
      }
    }
  }

  if (!safeArray(r.warnings, '$.validationResult.warnings', state)) return;
  const warnings = r.warnings as unknown[];
  for (let i = 0; i < warnings.length; i++) {
    if (!safeObj(warnings[i], `$.validationResult.warnings[${i}]`, state)) continue;
    const warn = warnings[i] as Record<string, unknown>;
    if (typeof warn.code !== 'string' || warn.code === '') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.warnings[${i}].code`, 'must be non-empty string');
    }
    if (typeof warn.path !== 'string') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.warnings[${i}].path`, 'must be string');
    }
    if (typeof warn.message !== 'string') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.warnings[${i}].message`, 'must be string');
    }
    const allowedWarnKeys = new Set(['code', 'path', 'message', 'value']);
    for (const k of Object.keys(warn)) {
      if (!allowedWarnKeys.has(k)) {
        verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.warnings[${i}].${k}`, `unexpected property "${k}"`);
      }
    }
  }

  if (safeObj(r.pythonSyntax, '$.validationResult.pythonSyntax', state)) {
    const ps = r.pythonSyntax as Record<string, unknown>;
    if (!VALID_STATES.has(ps.state as string)) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.pythonSyntax.state', `invalid state "${String(ps.state)}"`);
    }
    if (ps.engine !== undefined && typeof ps.engine !== 'string') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.pythonSyntax.engine', 'must be string or absent');
    }
    if (ps.message !== undefined && typeof ps.message !== 'string') {
      verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.pythonSyntax.message', 'must be string or absent');
    }
    const allowedPsKeys = new Set(['state', 'engine', 'message']);
    for (const k of Object.keys(ps)) {
      if (!allowedPsKeys.has(k)) {
        verror(state, 'SCRIPT_CONTRACT_INVALID', `$.validationResult.pythonSyntax.${k}`, `unexpected property "${k}"`);
      }
    }
  } else {
    if (r.pythonSyntax !== undefined) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.pythonSyntax', 'must be object or absent');
    }
  }
}

// ── Main Validator ──

export function validateScriptCandidateV2(
  candidate: unknown,
  remediationPlan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options?: ScriptValidationOptionsV2,
): ScriptValidationResultV2 {
  const state: ValState = {
    errors: [],
    warnings: [],
    syntaxResult: { state: 'not_run' },
  };

  try {
    const c = validateShape(candidate, false, state);
    if (!c) {
      return {
        valid: false,
        errors: state.errors,
        warnings: state.warnings,
        pythonSyntax: state.syntaxResult,
      };
    }

    validateCorrespondence(c, remediationPlan, buildContext, state);
    validatePartition(c, remediationPlan, buildContext, state);
    validateColumns(c, remediationPlan, buildContext, state);
    validateSecurity(c.scriptText as string, state);
    validateSyntax(c.scriptText as string, options, state);
    validateReconstruction(c, remediationPlan, buildContext, state);
  } catch (e) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$', `unexpected validation error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    valid: state.errors.length === 0,
    errors: state.errors,
    warnings: state.warnings,
    pythonSyntax: state.syntaxResult,
  };
}

// ── Contract Verifier ──

export function verifyScriptContractV2(
  contract: unknown,
  remediationPlan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options?: ScriptValidationOptionsV2,
): ScriptValidationResultV2 {
  const state: ValState = {
    errors: [],
    warnings: [],
    syntaxResult: { state: 'not_run' },
  };

  try {
    if (!safeObj(contract, '$', state)) {
      return {
        valid: false,
        errors: state.errors,
        warnings: state.warnings,
        pythonSyntax: state.syntaxResult,
      };
    }

    const ct = contract as Record<string, unknown>;

    if (!safeString(ct.scriptHash, '$.scriptHash', state)) {
      return {
        valid: false,
        errors: state.errors,
        warnings: state.warnings,
        pythonSyntax: state.syntaxResult,
      };
    }

    validateEmbeddedValidationResult(ct.validationResult, state);

    const c = validateShape(ct, true, state);
    if (!c) {
      return {
        valid: false,
        errors: state.errors,
        warnings: state.warnings,
        pythonSyntax: state.syntaxResult,
      };
    }

    validateCorrespondence(c, remediationPlan, buildContext, state);
    validatePartition(c, remediationPlan, buildContext, state);
    validateColumns(c, remediationPlan, buildContext, state);
    validateSecurity(c.scriptText as string, state);
    validateSyntax(c.scriptText as string, options, state);
    validateReconstruction(c, remediationPlan, buildContext, state);

    try {
      const computedHash = computeScriptHashV2(ct as unknown as ScriptContractCandidateV2);
      if (ct.scriptHash !== computedHash) {
        verror(state, 'SCRIPT_HASH_MISMATCH', '$.scriptHash', 'hash does not match recomputation');
      }
    } catch (e) {
      verror(state, 'SCRIPT_HASH_MISMATCH', '$.scriptHash', `hash computation error: ${e instanceof Error ? e.message : String(e)}`);
    }
  } catch (e) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$', `unexpected verification error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    valid: state.errors.length === 0,
    errors: state.errors,
    warnings: state.warnings,
    pythonSyntax: state.syntaxResult,
  };
}
