/// <reference types="vite/client" />

// ── Phase 4 E2E Harness global typings ──

import type {
  DiagnosisExecutionResult,
  RemediationPlanV2,
  ScriptContractV2,
} from './contracts/llm/types';
import type { PipelineState } from './components/MainPipeline';

declare global {
  interface Window {
    __PHASE3_INJECT__?(diagnosis: DiagnosisExecutionResult, plan: RemediationPlanV2 | null, opts?: { analysisText?: string }): void;
    __PHASE3_SET_STATE__?(state: PipelineState): void;
    __PHASE4_INJECT__?(diagnosis: DiagnosisExecutionResult, plan: RemediationPlanV2 | null, opts?: { analysisText?: string }): void;
    __PHASE4_SET_STATE__?(state: PipelineState): void;
    __PHASE4_TAMPER_CONTRACT__?(patch: Partial<ScriptContractV2>): void;
    __PHASE4_SYNC_FP__?(fingerprint: string): void;
  }
}
