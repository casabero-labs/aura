/**
 * Contracts v2 — Phase 1B index.
 * Barrel export. All behind CONTRACTS_V2_ENABLED gate.
 */

export { sha256hex, sha256short, KNOWN_VECTORS, setForcePureJS } from './hash';

export type {
  ContractId,
  ContractMetadata,
  SchemaV2,
  SchemaPropertyV2,
  CompatibilityDescriptor,
  ValidationResultSummary,
  IssueScope,
  ColumnRef,
  AmbiguousLookupError,
  EvidenceEnvelopeV2,
  DatasetFingerprintV2,
  DatasetSummaryV2,
  EvidenceIssueV2,
  Actionability,
  AutomaticAuthorization,
  ActionabilityRule,
  EvidenceV2,
  EvidenceSampleV2,
  ColumnStatsV2,
  TopValueV2,
  SelectionManifestV2,
  ManifestExclusionV2,
  ExclusionReason,
  TruncationManifestV2,
  TruncatedItemV2,
  PrivacyLevel,
  PrivacyPolicyV2,
  PrivacyRuleV2,
  PIIConfig,
  TokenBudgetV2,
  ValidationErrorV2,
  ValidationResultV2,
  EvidenceEnvelopeOptionsV2,
  BuildErrorV2,
  DiagnosisResponseV2,
  DiagnosisIssueV2,
  DiagnosisBlockV2,
  DiagnosisPromptPackageV2,
  DiagnosisPromptOptionsV2,
  DiagnosisErrorCode,
  DiagnosisError,
  DiagnosisExecutionResult,
  RemediationPlanV2,
  RemediationActionV2,
  ScriptContractV2,
} from './types';

export type { DiagnosisParseOutcome } from './diagnosisParserV2';

export {
  buildColumnRegistry,
  getColumnById,
  getColumnsByName,
  resolveColumn,
  validateColumnId,
  getColumnsRequiringReview,
  getInjectionRiskColumns,
  generateSafeColumnDict,
} from './columnRegistry';

export {
  REGISTRY,
  getContract,
  isRegisteredContract,
  listContracts,
  validateAgainstContract,
  isContractsV2Enabled,
} from './contractRegistry';

export {
  buildEvidenceEnvelopeV2,
} from './evidenceEnvelopeV2';
export type { AuditReportInput } from './evidenceEnvelopeV2';

export {
  buildPrivacyPolicy,
  buildPIIConfig,
  isPII,
  shouldHashColumn,
  redactValue,
  hashValue,
  allowsRawSamples,
  allowsTopValues,
  parsePrivacyLevel,
} from './privacyPolicy';

export {
  buildTokenBudget,
  createTruncationManifest,
  logColumnExclusion,
  logIssueExclusion,
  logSampleTruncation,
  logTopValueTruncation,
  logCharacterTruncation,
  applySlice,
  enforceCharacterBudget,
  estimateCharCount,
  defaultBudget,
} from './tokenBudget';

export {
  validateEnvelope,
  validateIssue,
  validateColumnRef,
  validateEvidenceRefs,
  validatePrivacyPolicy,
  validateTokenBudget,
  validatePrivacyCompliance,
  aggregateResults,
} from './validators';

// ── Diagnosis v2 ──
export {
  buildDiagnosisPromptV2,
  canonicalJson,
  buildEnvelopeRef,
} from './diagnosisPromptV2';

export {
  parseDiagnosisResponseV2,
} from './diagnosisParserV2';

export {
  validateDiagnosisResponseV2,
} from './diagnosisValidatorV2';

export {
  Errors as DiagnosisErrors,
  diagnosisError,
} from './diagnosisV2Errors';

export {
  runDiagnosisPipeline,
  diagnoseWithV2,
} from './diagnosisPipelineV2';
export type {
  DiagnosisAdapter,
  DiagnosisPipelineResult,
  DiagnosisPipelineFailure,
  DiagnosisPipelineOutcome,
} from './diagnosisPipelineV2';

export {
  runStructuredDiagnosis,
} from './diagnosisSelector';
export type {
  StructuredDiagnosisResult,
  StructuredDiagnosisFailure,
  StructuredDiagnosisOutcome,
} from './diagnosisSelector';
