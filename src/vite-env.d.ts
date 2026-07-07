/// <reference types="vite/client" />

// ── Phase 4 E2E Harness global typings ──

import type {
  DiagnosisExecutionResult,
  RemediationPlanV2,
  ScriptContractV2,
} from './contracts/llm/types';
import type { PipelineState } from './components/MainPipeline';
import type { AuditReport } from './types';

declare global {
  interface Window {
    __PHASE3_INJECT__?(diagnosis: DiagnosisExecutionResult, plan: RemediationPlanV2 | null, opts?: { analysisText?: string }): void;
    __PHASE3_SET_STATE__?(state: PipelineState): void;
    __PHASE4_INJECT__?(diagnosis: DiagnosisExecutionResult, plan: RemediationPlanV2 | null, opts?: { analysisText?: string }): void;
    __PHASE4_SET_STATE__?(state: PipelineState): void;
    __PHASE4_TAMPER_CONTRACT__?(patch: Partial<ScriptContractV2>): void;
    __PHASE4_GET_STATE__?(): Phase4State;
    __L9_SET_REPORT__?(report: AuditReport): void;
    __L9_SET_AUDIT_EVIDENCE__?(auditEvidence: import('./types').AuditExecutionEvidence): void;
    __L9_GET_STATE__?(): { hasAuditEvidence: boolean; hasReport: boolean; rowsProcessed: number; columnsProcessed: number; rowCount: number; colCount: number };
    __L9_PROCESS_CSV__?(csvContent: string, fileName?: string): Promise<{ rowsProcessed: number; columnsProcessed: number; score: number }>;
    __L9_GET_EXPORT_JSON__?(overriddenReport?: AuditReport): Record<string, unknown>;
  }
}

interface Phase4State {
  pipelineState: string;
  hasReport: boolean;
  hasContract: boolean;
  hasPlan: boolean;
  hasDiagnosis: boolean;
  fingerprint: string | null;
  contractHash: string | null;
  planId: string | null;
}
