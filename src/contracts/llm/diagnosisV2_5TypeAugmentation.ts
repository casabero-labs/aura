import type { ProjectedDiagnosisPipelineEvidenceV1 } from './diagnosisProjectedPipelineV2_5';

declare module './types' {
  interface ExecutionReceiptV1 {
    evidenceAliasContract?: 'aura.evidence-alias.v1';
    evidenceAliasMapHash?: string;
    projectionHash?: string;
    resolvedCitationsHash?: string;
  }

  interface DiagnosisExecutionResult {
    evidenceResolution?: ProjectedDiagnosisPipelineEvidenceV1;
  }
}

export {};
