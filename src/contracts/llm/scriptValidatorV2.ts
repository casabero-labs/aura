/**
 * Script Validator v2 — Phase 4 Loop 4.
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
  'contractId', 'contractVersion', 'remediationRef', 'datasetFingerprint',
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

  // V1 — required fields
  const expectedKeys = new Set(isFinal
    ? [...CANDIDATE_KEYS, ...CONTRACT_EXTRA_KEYS]
    : CANDIDATE_KEYS);

  // V5 — no extra properties
  for (const key of Object.keys(c)) {
    if (!expectedKeys.has(key)) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', `$.${key}`, `unexpected property "${key}"`);
    }
  }

  if (isFinal) {
    const allContractKeys = new Set([...CANDIDATE_KEYS, ...CONTRACT_EXTRA_KEYS]);
    for (const key of expectedKeys) {
      if (!(key in c)) {
        verror(state, 'SCRIPT_CONTRACT_INVALID', `$.${key}`, 'required field missing');
      }
    }
  }

  // V2 — contractId
  if (c.contractId !== 'aura.script.v2') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.contractId', `expected "aura.script.v2", got "${String(c.contractId)}"`);
  }

  // V3 — contractVersion
  if (c.contractVersion !== '2.0.0') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.contractVersion', `expected "2.0.0", got "${String(c.contractVersion)}"`);
  }

  // V6 — cleanDatasetFn
  if (c.cleanDatasetFn !== 'clean_dataset') {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.cleanDatasetFn', `expected "clean_dataset", got "${String(c.cleanDatasetFn)}"`);
  }

  // V7 — rendererVersion, placeholderVocabularyVersion
  if (c.rendererVersion !== SCRIPT_RENDERER_VERSION) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.rendererVersion', `expected "${SCRIPT_RENDERER_VERSION}"`);
  }
  if (c.placeholderVocabularyVersion !== PLACEHOLDER_VOCABULARY_VERSION) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.placeholderVocabularyVersion', `expected "${PLACEHOLDER_VOCABULARY_VERSION}"`);
  }

  // V4 — generatedAt ISO UTC canonical
  if (safeString(c.generatedAt, '$.generatedAt', state)) {
    const d = new Date(c.generatedAt as string);
    if (isNaN(d.getTime()) || d.toISOString() !== c.generatedAt) {
      verror(state, 'SCRIPT_CONTRACT_INVALID', '$.generatedAt', `not canonical ISO UTC: "${c.generatedAt}"`);
    }
  }

  // scriptText
  if (!safeString(c.scriptText, '$.scriptText', state)) return c;
  if (!(c.scriptText as string).includes('def clean_dataset(df):')) {
    verror(state, 'SCRIPT_CONTRACT_INVALID', '$.scriptText', 'missing def clean_dataset(df):');
  }

  // remediationRef
  safeString(c.remediationRef, '$.remediationRef', state);
  safeString(c.datasetFingerprint, '$.datasetFingerprint', state);

  // Arrays
  const acceptedIds = safeStrArray(c.acceptedActionIds, '$.acceptedActionIds', state);
  if (acceptedIds) safeNoDupIds(acceptedIds, '$.acceptedActionIds', state);

  const rejectedIds = safeStrArray(c.rejectedActionIds, '$.rejectedActionIds', state);
  if (rejectedIds) safeNoDupIds(rejectedIds, '$.rejectedActionIds', state);

  // excludedActionIds
  if (safeArray(c.excludedActionIds, '$.excludedActionIds', state)) {
    const exArr = c.excludedActionIds as unknown[];
    const seenEx = new Set<string>();
    for (let i = 0; i < exArr.length; i++) {
      if (safeObj(exArr[i], `$.excludedActionIds[${i}]`, state)) {
        const ex = exArr[i] as Record<string, unknown>;
        if (safeString(ex.actionId, `$.excludedActionIds[${i}].actionId`, state)) {
          const aid = ex.actionId as string;
          if (seenEx.has(aid)) {
            verror(state, 'SCRIPT_REFERENCE_INVALID', `$.excludedActionIds[${i}]`, `duplicate actionId "${aid}"`);
          }
          seenEx.add(aid);
        }
        if (!VALID_EXCLUSION_REASONS.has(ex.reason as string)) {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.excludedActionIds[${i}].reason`, `invalid reason "${String(ex.reason)}"`);
        }
        // No extra props in excluded
        for (const k of Object.keys(ex)) {
          if (k !== 'actionId' && k !== 'reason') {
            verror(state, 'SCRIPT_CONTRACT_INVALID', `$.excludedActionIds[${i}].${k}`, `unexpected property "${k}"`);
          }
        }
      }
    }
  }

  // columnRefs
  if (safeArray(c.columnRefs, '$.columnRefs', state)) {
    const colsArr = c.columnRefs as unknown[];
    const seenCols = new Set<string>();
    for (let i = 0; i < colsArr.length; i++) {
      if (safeObj(colsArr[i], `$.columnRefs[${i}]`, state)) {
        const col = colsArr[i] as Record<string, unknown>;
        safeString(col.columnId, `$.columnRefs[${i}].columnId`, state);
        safeString(col.name, `$.columnRefs[${i}].name`, state);
        if (typeof col.position !== 'number' || col.position < 0) {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.columnRefs[${i}].position`, `expected non-negative number`);
        }
        if (typeof col.duplicateOrdinal !== 'number' || col.duplicateOrdinal < 0) {
          verror(state, 'SCRIPT_CONTRACT_INVALID', `$.columnRefs[${i}].duplicateOrdinal`, `expected non-negative number`);
        }
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

        // Extra properties check
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

  // V8 — remediationRef
  if (c.remediationRef !== plan.planId) {
    verror(state, 'SCRIPT_REMEDIATION_MISMATCH', '$.remediationRef', `expected "${plan.planId}", got "${String(c.remediationRef)}"`);
  }

  // V9 — datasetFingerprint
  if (c.datasetFingerprint !== plan.datasetFingerprint) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.datasetFingerprint', `fingerprint mismatch`);
  }

  // Context
  if (!buildContext.correspondenceEvidence.valid) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.context', 'correspondenceEvidence.valid is false');
  }

  if (plan.datasetFingerprint !== buildContext.sourceDatasetFingerprint) {
    verror(state, 'SCRIPT_REFERENCE_INVALID', '$.context', 'fingerprint mismatch with context');
  }

  if (plan.evidenceEnvelopeRef !== buildContext.remediationContext.evidenceEnvelopeRef) {
    verror(state, 'SCRIPT_REMEDIATION_MISMATCH', '$.context', 'evidenceEnvelopeRef mismatch');
  }

  // V10-V12 — all IDs exist in plan
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

  // V13-V14 — exact coverage
  const allCovered = new Set([...acceptedIds, ...rejectedIds, ...excludedIds]);
  for (const action of plan.plan) {
    if (!allCovered.has(action.actionId)) {
      verror(state, 'SCRIPT_COVERAGE_INVALID', '$.plan', `action "${action.actionId}" not covered`);
    }
  }
  if (allCovered.size !== plan.plan.length) {
    verror(state, 'SCRIPT_COVERAGE_INVALID', '$.plan', 'extra actionIds not in plan');
  }

  // V15 — columnRefs match registry
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

// ── Custom sorting helpers based on columnId comparison ──
function compareColumnIdsStable(): number {
  // Implementation provided when needed for column ordering checks
  return 0;
}

// ── HITL / Partition Validation (V16-V21) ──

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

  // V16 — accepted must be approved
  for (const id of acceptedIds) {
    const action = planMap.get(id);
    if (action && action.approvalStatus !== 'approved') {
      verror(state, 'SCRIPT_APPROVAL_INVALID', `$.acceptedActionIds`, `"${id}" is not approved`);
    }
  }

  // V17 — rejected must be rejected
  for (const id of rejectedIds) {
    const action = planMap.get(id);
    if (action && action.approvalStatus !== 'rejected') {
      verror(state, 'SCRIPT_APPROVAL_INVALID', `$.rejectedActionIds`, `"${id}" is not rejected`);
    }
  }

  // V18 — rejected ∩ excluded = ∅
  for (const ex of excluded) {
    if (rejectedIds.has(ex.actionId)) {
      verror(state, 'SCRIPT_PARTITION_INVALID', `$.excludedActionIds`, `"${ex.actionId}" is both rejected and excluded`);
    }
  }

  // V19 — pending must be in excluded
  for (const action of plan.plan) {
    if (action.approvalStatus === 'pending') {
      const found = excluded.find(e => e.actionId === action.actionId);
      if (!found) {
        verror(state, 'SCRIPT_APPROVAL_INVALID', `$.plan`, `pending action "${action.actionId}" not in excluded`);
      } else if (found.reason !== 'pending') {
        verror(state, 'SCRIPT_APPROVAL_INVALID', `$.excludedActionIds`, `pending action "${action.actionId}" has reason "${found.reason}"`);
      }
    }
  }

  // V20 — requires_human_review never accepted
  for (const id of acceptedIds) {
    const action = planMap.get(id);
    if (action && action.actionType === 'requires_human_review') {
      verror(state, 'SCRIPT_APPROVAL_INVALID', `$.acceptedActionIds`, `"${id}" is requires_human_review`);
    }
  }

  // V21 — approved not-renderable should be excluded
  const registry = buildContext.columnRegistry;
  for (const action of plan.plan) {
    if (action.approvalStatus !== 'approved') continue;
    if (action.actionType === 'requires_human_review') continue;

    if (COLUMN_REQUIRED_ACTIONS.has(action.actionType)) {
      if (!action.columnId) {
        // missing column — should be in excluded
        const inAccepted = acceptedIds.has(action.actionId);
        const inExcluded = excluded.find(e => e.actionId === action.actionId);
        if (inAccepted) {
          verror(state, 'SCRIPT_APPROVAL_INVALID', `$.acceptedActionIds`, `"${action.actionId}" approved but missing column`);
        }
        if (inExcluded && inExcluded.reason !== 'missing_column') {
          verror(state, 'SCRIPT_APPROVAL_INVALID', `$.excludedActionIds`, `"${action.actionId}" wrong exclusion reason`);
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

  // Derive expected columnRefs from accepted actions
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

  // V22 — no ambiguous columns in accepted
  for (const [, col] of expectedCols) {
    if (col.isAmbiguous) {
      verror(state, 'SCRIPT_COLUMN_AMBIGUOUS', '$.columnRefs', `ambiguous column "${col.columnId}" referenced by accepted action`);
    }
  }

  // V25 — check columnRefs match expected (sorted by columnId)
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

  // columnRefs sorted by columnId
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

    // Single-line comment
    if (ch === '#' && (i === 0 || script[i - 1] !== '\\')) {
      result.push('#');
      i++;
      while (i < script.length && script[i] !== '\n') {
        result.push(' ');
        i++;
      }
      continue;
    }

    // Single-quoted string
    if (ch === "'") {
      if (script.startsWith("r'", i) || script.startsWith("R'", i)) {
        result.push(script[i]);
        i++;
      }
      result.push("'");
      i++;
      while (i < script.length) {
        if (script[i] === '\\') {
          result.push(' ');
          i++;
          if (i < script.length) { result.push(' '); i++; }
        } else if (script[i] === "'") {
          result.push("'");
          i++;
          break;
        } else {
          result.push(' ');
          i++;
        }
      }
      continue;
    }

    // Double-quoted string
    if (ch === '"') {
      if (script.startsWith('r"', i) || script.startsWith('R"', i)) {
        result.push(script[i]);
        i++;
      }
      result.push('"');
      i++;
      while (i < script.length) {
        if (script[i] === '\\') {
          result.push(' ');
          i++;
          if (i < script.length) { result.push(' '); i++; }
        } else if (script[i] === '"') {
          result.push('"');
          i++;
          break;
        } else {
          result.push(' ');
          i++;
        }
      }
      continue;
    }

    // Normal character — pass through
    result.push(ch);
    i++;
  }

  return result.join('');
}

// ── Security: Pattern Scanning on Masked Script ──

function scanMasked(masked: string): Set<string> {
  const tokens = new Set<string>();
  const re = /\b[a-z_]+\b|[a-z_]+\.[a-z_]+\.?/gi;
  let m;
  while ((m = re.exec(masked)) !== null) {
    tokens.add(m[0]);
  }
  return tokens;
}

function validateSecurity(scriptText: string, state: ValState): void {
  const masked = maskStringsAndComments(scriptText);
  const tokens = scanMasked(masked);

  // UNAUTHORIZED_IMPORT
  const unauthorizedImports = ['os', 'sys', 'subprocess', 'socket', 'requests', 'urllib', 'pathlib', 'io'];
  for (const imp of unauthorizedImports) {
    if (tokens.has(imp)) {
      const match = new RegExp(`\\b${imp}\\b`).exec(masked);
      if (match) {
        const context = masked.substring(Math.max(0, match.index - 5), match.index + imp.length + 5);
        if (!/["'#]/.test(context.replace(imp, '').trim())) {
          verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', `unauthorized import: ${imp}`);
        }
      }
    }
  }

  // from ... import
  if (/from\s+\w+\s+import/.test(masked)) {
    verror(state, 'SCRIPT_UNAUTHORIZED_IMPORT', '$.scriptText', 'from ... import not allowed');
  }

  // EXECUTABLE_CONTENT
  for (const kw of ['eval', 'exec', '__import__']) {
    const idx = masked.indexOf(kw);
    if (idx >= 0) {
      // Check it's not inside a string by verifying the token exists
      const re = new RegExp(`\\b${kw}\\(`, 'i');
      if (re.test(masked)) {
        verror(state, 'SCRIPT_EXECUTABLE_CONTENT', '$.scriptText', `executable content: ${kw}`);
      }
    }
  }

  // NETWORK_ACCESS
  for (const kw of ['subprocess', 'os.system', 'socket', 'requests', 'urllib', 'http.client']) {
    const re = new RegExp(kw.replace('.', '\\.'), 'i');
    if (re.test(masked)) {
      verror(state, 'SCRIPT_NETWORK_ACCESS', '$.scriptText', `network access: ${kw}`);
    }
  }

  // FILE_ACCESS
  for (const kw of ['open(', 'io.open(', 'pathlib', '__file__']) {
    const escaped = kw.replace('.', '\\.').replace('(', '\\(').replace('_', '_');
    if (new RegExp(escaped, 'i').test(masked)) {
      verror(state, 'SCRIPT_FILE_ACCESS', '$.scriptText', `file access: ${kw}`);
    }
  }

  // DESTRUCTIVE_OPERATION
  if (/inplace\s*=\s*True/i.test(masked)) {
    verror(state, 'SCRIPT_DESTRUCTIVE_OPERATION', '$.scriptText', 'inplace=True');
  }
  if (/\bdel\b/.test(masked)) {
    verror(state, 'SCRIPT_DESTRUCTIVE_OPERATION', '$.scriptText', 'del statement');
  }
}

// ── Syntax Validation (V32-V34) ──

function validateSyntax(
  scriptText: string,
  options: ScriptValidationOptionsV2 | undefined,
  state: ValState,
): void {
  if (!options?.syntaxChecker) {
    state.syntaxResult = { state: 'not_run' };
    vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'no syntax checker provided');
    return;
  }

  try {
    const result = options.syntaxChecker(scriptText);
    state.syntaxResult = result;

    if (result.state === 'failed') {
      verror(state, 'SCRIPT_SYNTAX_INVALID', '$.scriptText', result.message || 'syntax invalid');
    }
  } catch (e) {
    state.syntaxResult = {
      state: 'not_run',
      message: `checker threw: ${e instanceof Error ? e.message : String(e)}`,
    };
    vwarn(state, 'SCRIPT_SYNTAX_NOT_RUN', '$.syntax', 'syntax checker threw exception');
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
    'contractId', 'contractVersion', 'remediationRef', 'datasetFingerprint',
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

    // Validate scriptHash is present
    if (!safeString(ct.scriptHash, '$.scriptHash', state)) {
      return {
        valid: false,
        errors: state.errors,
        warnings: state.warnings,
        pythonSyntax: state.syntaxResult,
      };
    }

    // Validate validationResult embedded
    if (safeObj(ct.validationResult, '$.validationResult', state)) {
      const vr = ct.validationResult as Record<string, unknown>;
      if (typeof vr.valid !== 'boolean') {
        verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.valid', 'must be boolean');
      }
      if (!safeArray(vr.errors, '$.validationResult.errors', state)) {
        // handled
      }
      if (!safeArray(vr.warnings, '$.validationResult.warnings', state)) {
        // handled
      }
      if (safeObj(vr.pythonSyntax, '$.validationResult.pythonSyntax', state)) {
        const ps = vr.pythonSyntax as Record<string, unknown>;
        if (!['passed', 'failed', 'not_run'].includes(ps.state as string)) {
          verror(state, 'SCRIPT_CONTRACT_INVALID', '$.validationResult.pythonSyntax.state', 'invalid pythonSyntax state');
        }
      }
    }

    // Validate candidate shape from contract
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

    // Hash validation
    try {
      const computedHash = computeScriptHashV2(ct as unknown as ScriptContractCandidateV2);
      if (ct.scriptHash !== computedHash) {
        verror(state, 'SCRIPT_HASH_MISMATCH', '$.scriptHash', 'hash does not match recomputation');
      }
    } catch (e) {
      verror(state, 'SCRIPT_HASH_MISMATCH', '$.scriptHash', `hash computation error: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Don't trust embedded valid
    // Fresh result stands on its own
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
