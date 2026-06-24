/**
 * Contracts v2 — Fase 1 index.
 *
 * Barrel export. All public APIs are gated behind CONTRACTS_V2_ENABLED.
 *
 * Production continues using Contracts v1 until Phase 1 is reviewed and approved.
 */

export type {
  ContractId,
  ContractMetadata,
  CompatibilityDescriptor,
  ValidationResultSummary,
  ColumnRef,
  EvidenceEnvelopeV2,
  DatasetFingerprintV2,
  DatasetSummaryV2,
  EvidenceIssueV2,
  Actionability,
  EvidenceV2,
  EvidenceSampleV2,
  ColumnStatsV2,
  TopValueV2,
  SelectionManifestV2,
  BudgetExclusionV2,
  TruncationManifestV2,
  TruncatedItemV2,
  PrivacyLevel,
  PrivacyPolicyV2,
  PrivacyRuleV2,
  TokenBudgetV2,
  ValidationErrorV2,
  ValidationResultV2,
  EvidenceEnvelopeOptionsV2,
} from './types';

export {
  buildColumnRegistry,
  getColumnById,
  getColumnsByName,
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
  allowsRawSamples,
  allowsTopValues,
  requiresHash,
  parsePrivacyLevel,
} from './privacyPolicy';

export {
  buildTokenBudget,
  createTruncationManifest,
  applyColumnLimit,
  applyIssueLimit,
  applySampleLimit,
  applyTopValuesLimit,
  applyCharacterLimit,
  defaultBudget,
  estimateCharCount,
} from './tokenBudget';

export {
  validateEnvelope,
  validateIssue,
  validateColumnRef,
  validateEvidenceRefs,
  validatePrivacyPolicy,
  validateTokenBudget,
  aggregateResults,
} from './validators';
