import {
  AIConfig,
  AuditExecutionEvidence,
  AuditReport,
  BenchmarkResult,
  DeterministicValidationReport,
  EvidenceManifest,
  HitlDecision,
  ImprovementRun,
  ScriptValidationResult,
} from '../types';
import type { DiagnosisExecutionResult, DiagnosisFailureEvidenceV2 } from '../contracts/llm';
import type { DiagnosticReport } from './diagnosticReport';
import { buildExportArtifactIdentity } from './exportArtifactIdentity';

export const AURA_EXPORT_CONTRACT_NAME = 'aura-technical-export';
export const AURA_EXPORT_CONTRACT_VERSION = '2.0';

const CANONICAL_BLOCKS = [
  'artifactIdentity',
  'manifest',
  'profile',
  'diagnosis',
  'script',
  'calibrationEvidence',
] as const;

export interface BuildAuraExportPackageParams {
  manifest: EvidenceManifest;
  profile: {
    report: AuditReport;
    auditEvidence: AuditExecutionEvidence | null;
  };
  deterministicValidation?: DeterministicValidationReport | null;
  diagnosticReport?: DiagnosticReport | null;
  hitlDecision?: HitlDecision | null;
  diagnosis: {
    status: 'valid' | 'invalid' | 'not_run';
    model: string;
    providerType: AIConfig['providerType'];
    diagnosisText: string;
    structuredDiagnosis?: DiagnosisExecutionResult | null;
    failureEvidence?: DiagnosisFailureEvidenceV2 | null;
    inputSnapshot?: Record<string, unknown> | null;
    executionReceipt?: Record<string, unknown> | null;
    rawResponseHash?: string | null;
  };
  script: {
    generatedScript: string;
    scriptValidation: ScriptValidationResult | null;
    approvedScript: string;
  };
  benchmarkResults: BenchmarkResult[];
  improvementRun?: ImprovementRun | null;
}

export const buildAuraExportPackage = ({
  manifest,
  profile,
  deterministicValidation,
  diagnosticReport = null,
  hitlDecision,
  diagnosis,
  script,
  benchmarkResults,
  improvementRun,
}: BuildAuraExportPackageParams) => {
  const receipt = diagnosis.executionReceipt as { receiptHash?: unknown } | null | undefined;
  const artifactIdentity = buildExportArtifactIdentity({
    report: profile.report,
    auditEvidence: profile.auditEvidence,
    diagnosticReport,
    diagnosisReceiptHash: typeof receipt?.receiptHash === 'string' ? receipt.receiptHash : null,
  });

  return {
  exportContract: {
    name: AURA_EXPORT_CONTRACT_NAME,
    version: AURA_EXPORT_CONTRACT_VERSION,
    generatedAt: manifest.generatedAt,
    canonicalBlocks: [...CANONICAL_BLOCKS],
    optionalBlocks: ['deterministicValidation', 'hitlDecision'],
    deprecatedBlocks: [
      {
        from: 'experiment',
        to: 'calibrationEvidence',
        removedIn: AURA_EXPORT_CONTRACT_VERSION,
        reason: 'calibrationEvidence separa clasificación, resumen, resultados y límites metodológicos.',
      },
    ],
    compatibility: {
      legacyAliasIncluded: false,
      migration: 'Leer calibrationEvidence.results en lugar de experiment.benchmarkResults y usar calibrationEvidence.summary para interpretar el nivel de evidencia.',
    },
  },
  artifactIdentity,
  manifest,
  profile,
  diagnosticReport,
  ...(deterministicValidation?.groundTruthMatched && {
    deterministicValidation,
  }),
  ...(hitlDecision && {
    hitlDecision,
  }),
  diagnosis,
  script,
  calibrationEvidence: {
    classification: 'experimental' as const,
    summary: manifest.calibrationSummary,
    results: benchmarkResults,
    improvementRun: improvementRun ?? null,
  },
  };
};
