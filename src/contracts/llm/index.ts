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
  DiagnosisVisualizationV2,
  DiagnosisVisualizationDataSourceV2,
  DiagnosisVisualizationKindV2,
  DiagnosisPromptPackageV2,
  DiagnosisPromptOptionsV2,
  DiagnosisInputModeV2,
  DiagnosisInputPackageV2,
  InferenceSnapshotV1,
  ExecutionReceiptV1,
  DiagnosisErrorCode,
  DiagnosisError,
  DiagnosisExecutionResult,
  DiagnosisFailureEvidenceV2,
  RemediationActionTypeV2,
  RemediationParametersV2,
  RemediationContextV2,
  RemediationContextColumnV2,
  RemediationContextIssueV2,
  RemediationPlanV2,
  RemediationActionV2,
  RemediationErrorCode,
  ScriptContractV2,
  ScriptContractCandidateV2,
  ScriptExclusionReasonV2,
  ScriptExcludedActionV2,
  ColumnRegistryV2,
  CorrespondenceEvidenceV2,
  ScriptBuildContextV2,
  ColumnAccessSpecV2,
  ColumnAccessMode,
  PythonSyntaxState,
  ScriptValidationResultV2,
  ColumnResolutionFailureReasonV2,
} from './types';

export {
  buildDiagnosisInputPackageV2,
  DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE,
  exactDiagnosisPromptV2,
} from './diagnosisInputPackageV2';

export {
  buildExecutionReceiptV1,
  computeInferenceHash,
  validateExecutionReceiptIntegrityV1,
  validateExecutionReceiptV1,
} from './executionReceiptV1';

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
  isDiagnosisFailureEvidenceV2,
} from './types';

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
  buildCompactDiagnosisPromptV2,
  canonicalJson,
  buildEnvelopeRef,
  estimatePromptTokens,
  shouldUseCompactPrompt,
  CHROME_TOKEN_BUDGET,
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
  normalizeHumanReview,
  normalizeHumanReviewWithRawValidation,
  captureRawResponse,
  evaluateRawContractCompliance,
  computeMandatoryReviewIssueIds,
  HUMAN_REVIEW_NORMALIZATION_FIELD,
  HUMAN_REVIEW_NORMALIZATION_POLICY,
  HUMAN_REVIEW_NORMALIZATION_POLICY_VERSION,
  HUMAN_REVIEW_NORMALIZATION_REASON,
} from './humanReviewNormalizerV2';
export type {
  HumanReviewNormalizationEvidence,
  HumanReviewNormalizationResult,
  NormalizeHumanReviewResult,
  RawValidationResult,
} from './humanReviewNormalizerV2';

export {
  runStructuredDiagnosis,
} from './diagnosisSelector';
export type {
  StructuredDiagnosisResult,
  StructuredDiagnosisFailure,
  StructuredDiagnosisOutcome,
} from './diagnosisSelector';

// ── Remediation v2 ──
export {
  buildRemediationContext,
  buildDiagnosisRef,
} from './remediationContextV2';

export {
  lookupRemediationAction,
  isKnownRule,
} from './remediationPolicyV2';

export {
  buildRemediationPlanV2,
  buildRemediationPlanId,
} from './remediationBuilderV2';

export {
  validateRemediationPlanV2,
} from './remediationValidatorV2';

export {
  approveRemediationActionV2,
  rejectRemediationActionV2,
  resetRemediationActionV2,
} from './remediationApprovalV2';
export type {
  ApprovalResult,
} from './remediationApprovalV2';

// ── Script v2 (Phase 4) ──
export {
  PLACEHOLDER_VOCABULARY_V2,
  PLACEHOLDER_VOCABULARY_VERSION,
  PLACEHOLDER_COUNT,
} from './placeholderVocabulary';

export {
  resolveScriptColumn,
  buildColumnAccessSpec,
  buildColumnReadExpression,
  buildColumnWriteTarget,
  buildColumnRegistryV2,
  isColumnStructurallyRenderable,
} from './scriptColumnResolver';
export type { ColumnResolutionResult, RegistryBuildError, RegistryBuildResult } from './scriptColumnResolver';

export {
  buildScriptContext,
} from './scriptBuildContext';

// ── Script Renderer v2 (Phase 4 Loop 2) ──
export {
  SCRIPT_RENDERER_VERSION,
  renderActionV2,
  buildScriptHeader,
  buildScriptFooter,
  buildScriptText,
} from './scriptRendererV2';
export type { RenderableScriptActionV2, ScriptRendererErrorCode } from './scriptRendererV2';
export { ScriptRendererError } from './scriptRendererV2';

// ── Script Builder v2 (Phase 4 Loop 3) ──
export {
  SCRIPT_CONTRACT_VERSION,
  CLEAN_DATASET_FN,
  buildScriptCandidateCoreV2,
  buildScriptCandidateV2,
  buildScriptHashPayloadV2,
  computeScriptHashV2,
  finalizeScriptContractV2,
} from './scriptBuilderV2';
export type { ScriptContractCandidateCoreV2, ScriptCandidateBuildOptionsV2, ScriptBuilderErrorCode } from './scriptBuilderV2';
export { ScriptBuilderError } from './scriptBuilderV2';

// ── Script Error Codes (Phase 4 Loop 4) ──
export type { ScriptErrorCode, ScriptWarningCode } from './scriptErrorCodes';

// ── Script Validator v2 (Phase 4 Loop 4) ──
export {
  validateScriptCandidateV2,
  verifyScriptContractV2,
} from './scriptValidatorV2';
export type { PythonSyntaxCheckResultV2, ScriptValidationOptionsV2 } from './scriptValidatorV2';
