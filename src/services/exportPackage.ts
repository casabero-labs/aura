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

export const AURA_EXPORT_CONTRACT_NAME = 'aura-technical-export';
export const AURA_EXPORT_CONTRACT_VERSION = '2.0';

const CANONICAL_BLOCKS = [
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
  hitlDecision?: HitlDecision | null;
  diagnosis: {
    model: string;
    providerType: AIConfig['providerType'];
    diagnosisText: string;
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
  hitlDecision,
  diagnosis,
  script,
  benchmarkResults,
  improvementRun,
}: BuildAuraExportPackageParams) => ({
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
  manifest,
  profile,
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
});
