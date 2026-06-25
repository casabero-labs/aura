/**
 * Script Error Codes — Phase 4 Loop 4.
 *
 * Closed vocabulary of error and warning codes for script validation.
 */

import type { PythonSyntaxState } from './types';

// ── Error Codes ──

export type ScriptErrorCode =
  | 'SCRIPT_CONTRACT_INVALID'
  | 'SCRIPT_REFERENCE_INVALID'
  | 'SCRIPT_REMEDIATION_MISMATCH'
  | 'SCRIPT_APPROVAL_INVALID'
  | 'SCRIPT_COVERAGE_INVALID'
  | 'SCRIPT_PARTITION_INVALID'
  | 'SCRIPT_COLUMN_AMBIGUOUS'
  | 'SCRIPT_HASH_MISMATCH'
  | 'SCRIPT_RENDER_MISMATCH'
  | 'SCRIPT_EXECUTABLE_CONTENT'
  | 'SCRIPT_SYNTAX_INVALID'
  | 'SCRIPT_UNAUTHORIZED_IMPORT'
  | 'SCRIPT_NETWORK_ACCESS'
  | 'SCRIPT_FILE_ACCESS'
  | 'SCRIPT_DESTRUCTIVE_OPERATION'
  | 'CONTRACTS_V2_DISABLED';

// ── Warning Codes ──

export type ScriptWarningCode =
  | 'SCRIPT_SYNTAX_NOT_RUN';

// ── Helper ──

export type { PythonSyntaxState };
