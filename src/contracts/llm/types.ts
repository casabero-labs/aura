/**
 * Contracts v2 — Shared types (Phase 1B).
 */

// ── Contract Identifiers ──
export type ContractId =
  | 'aura.evidence.v2'
  | 'aura.diagnosis.v2'
  | 'aura.remediation.v2'
  | 'aura.script.v2';

export interface ContractMetadata {
  contractId: ContractId;
  version: string;
  taskType: string;
  schema: SchemaV2;
  createdAt: string;
  compatibility: CompatibilityDescriptor;
  validationResult: ValidationResultSummary;
}

export interface SchemaV2 {
  type: 'object';
  required: string[];
  properties: Record<string, SchemaPropertyV2>;
}

export interface SchemaPropertyV2 {
  type: string;
  enum?: string[];
  format?: string;
  nullable?: boolean;
}

export interface CompatibilityDescriptor {
  minContractsVersion: string;
  maxContractsVersion: string;
  breaks: string[];
  migrations: string[];
}

export interface ValidationResultSummary {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Issue Scope ──
export type IssueScope = 'dataset' | 'column';

// ── Column References ──
export interface ColumnRef {
  columnId: string;
  name: string;
  position: number;
  duplicateOrdinal: number;
  pythonLiteral: string;
  isAmbiguous: boolean;
  isDuplicate: boolean;
  isReservedWord: boolean;
}

export interface AmbiguousLookupError {
  columnId: string;
  name: string;
  matches: ColumnRef[];
  reason: 'duplicate_name' | 'ambiguous_name' | 'reserved_word';
}

// ── Inclusion Reason (for manifests) ──
export type ExclusionReason =
  | 'explicit_exclusion'
  | 'privacy_policy'
  | 'budget_limit'
  | 'ambiguous_column'
  | 'missing_reference'
  | 'unsupported_scope';

// ── Evidence Envelope V2 ──
export interface EvidenceEnvelopeV2 {
  contractId: 'aura.evidence.v2';
  contractVersion: '2.0.0';
  untrustedContent: true;
  datasetFingerprint: DatasetFingerprintV2;
  privacyPolicy: PrivacyPolicyV2;
  datasetSummary: DatasetSummaryV2;
  columns: ColumnRef[];
  issues: EvidenceIssueV2[];
  evidence: EvidenceV2;
  selectionManifest: SelectionManifestV2;
  truncationManifest: TruncationManifestV2;
}

export interface DatasetFingerprintV2 {
  sha256: string;
  rowCount: number;
  colCount: number;
  delimiter: string;
  generatedAt: string;
}

export interface DatasetSummaryV2 {
  rowCount: number;
  colCount: number;
  delimiter: string;
  duplicateRows: number;
  score: number;
}

export interface EvidenceIssueV2 {
  issueId: string;
  ruleId: string;
  ruleName: string;
  description: string;
  columnId: string | null;
  scope: IssueScope;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'good';
  count: number;
  affectedPercentage: number;
  evidenceRefs: string[];
  actionability: Actionability;
  automaticAuthorization: AutomaticAuthorization;
}

export type Actionability = 'auto_safe' | 'review_only' | 'not_actionable';

export interface AutomaticAuthorization {
  actionType: string;
  authorized: boolean;
  conditionsMet: string[];
  reason: string;
}

export interface ActionabilityRule {
  ruleId: string;
  defaultActionability: Actionability;
  allowedAutomaticAction: string | null;
  authorizationConditions: string[];
  requiresHumanReview: boolean;
  scope: IssueScope;
}

export interface EvidenceV2 {
  samples: EvidenceSampleV2[];
  columnStats: Record<string, ColumnStatsV2>;
}

export interface EvidenceSampleV2 {
  evidenceRef: string;
  issueId: string;
  columnId: string | null;
  values: (string | number | null)[];
  metadata: Record<string, unknown>;
}

export interface ColumnStatsV2 {
  columnId: string;
  inferredType: string;
  semanticType: string;
  distinctCount: number;
  nullCount: number;
  nullPercentage: number;
  topValues: TopValueV2[];
  stats: Record<string, number>;
}

export interface TopValueV2 {
  value: string;
  count: number;
  percentage: number;
}

export interface SelectionManifestV2 {
  rationale: string;
  includedColumns: number;
  excludedColumns: number;
  includedIssues: number;
  excludedIssues: number;
  excludedByBudget: ManifestExclusionV2[];
}

export interface ManifestExclusionV2 {
  reason: ExclusionReason;
  resource: 'column' | 'issue' | 'sample';
  name: string;
  detail: string;
}

export interface TruncationManifestV2 {
  truncatedColumns: TruncatedItemV2[];
  truncatedIssues: TruncatedItemV2[];
  truncatedSamples: TruncatedItemV2[];
  truncatedTopValues: TruncatedItemV2[];
  truncatedCharacters: TruncatedItemV2[];
}

export interface TruncatedItemV2 {
  id: string;
  name: string;
  resource: string;
  reason: ExclusionReason;
  allowed: number;
  actual: number;
  excess: number;
}

// ── Privacy Policy ──
export type PrivacyLevel = 'local_full' | 'cloud_minimized' | 'cloud_no_samples';

export interface PrivacyPolicyV2 {
  level: PrivacyLevel;
  rules: PrivacyRuleV2[];
}

export interface PrivacyRuleV2 {
  type: 'redact' | 'hash' | 'omit' | 'limit';
  target: 'column' | 'issue' | 'sample' | 'value';
  detail: string;
}

// ── PII Detection ──
export interface PIIConfig {
  semanticTypes: string[];
  categoryPatterns: RegExp[];
  columnNamePatterns: RegExp[];
  genericPatterns: RegExp[];
}

// ── Token Budget ──
export interface TokenBudgetV2 {
  budgetId: string;
  maxColumns: number;
  maxIssues: number;
  maxSamplesPerIssue: number;
  maxTopValues: number;
  maxCharacters: number;
  limits: Record<string, number>;
}

// ── Validation ──
export interface ValidationErrorV2 {
  code: string;
  path: string;
  message: string;
  value: unknown;
}

export interface ValidationResultV2 {
  valid: boolean;
  errors: ValidationErrorV2[];
  warnings: ValidationErrorV2[];
}

// ── Build Options ──
export interface EvidenceEnvelopeOptionsV2 {
  privacyLevel: PrivacyLevel;
  tokenBudget?: Partial<TokenBudgetV2>;
  excludeColumns?: string[];
  excludeIssues?: string[];
  datasetSha256: string;
  delimiter: string;
}

export interface BuildErrorV2 {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

// ── Diagnosis Contract ──
export interface DiagnosisResponseV2 {
  contractId: 'aura.diagnosis.v2';
  contractVersion: '2.0.0';
  evidenceEnvelopeRef: string;
  responseId: string;
  issues: DiagnosisIssueV2[];
  diagnosisBlocks: DiagnosisBlockV2[];
  visualizations?: DiagnosisVisualizationV2[];
  limitations: string[];
  generatedAt: string;
}

export interface DiagnosisIssueV2 {
  issueId: string;
  evidenceRefs: string[];
  hypothesis: string;
  confidence: number;
  requiresHumanReview: boolean;
  limits: string[];
}

export interface DiagnosisBlockV2 {
  issueId: string;
  ruleId: string;
  columnId: string | null;
  scope: IssueScope;
  observation: string;
  recommendation: string;
}

export type DiagnosisVisualizationKindV2 =
  | 'bar'
  | 'horizontal_bar'
  | 'pie'
  | 'table';

export type DiagnosisVisualizationDataSourceV2 =
  | 'severity_counts'
  | 'category_counts'
  | 'column_type_counts'
  | 'top_null_columns'
  | 'top_affected_issues'
  | 'top_cardinality_columns';

export interface DiagnosisVisualizationV2 {
  visualizationId: string;
  includeInPdf: boolean;
  dataSource: DiagnosisVisualizationDataSourceV2;
  kind: DiagnosisVisualizationKindV2;
  title: string;
  rationale: string;
  issueIds: string[];
}

// ── Diagnosis Prompt Types ──
export interface DiagnosisPromptPackageV2 {
  contractId: 'aura.diagnosis.v2';
  contractVersion: '2.0.0';
  evidenceEnvelopeRef: string;
  promptVersion: string;
  promptHash: string;
  systemInstruction: string;
  userPayload: string;
  responseSchema: Record<string, unknown>;
  generatedAt: string;
}

export interface DiagnosisPromptOptionsV2 {
  maxConfidence?: number;
}

export type DiagnosisInputModeV2 = 'prompt_libre' | 'smart_sample' | 'recommended';

export interface DiagnosisInputPackageV2 {
  contractId: 'aura.input-snapshot.v2';
  contractVersion: '2.0.0';
  inputMode: DiagnosisInputModeV2;
  includedSections: string[];
  systemInstruction: string;
  userPayload: string;
  responseSchema: Record<string, unknown>;
  evidenceEnvelopeRef: string;
  promptVersion: string;
  promptHash: string;
  responseSchemaHash: string;
  inputHash: string;
}

export interface InferenceSnapshotV1 {
  temperature: number;
  topP: number;
  think: false;
  numCtx: number;
  numPredict: number;
  seed: number | null;
  keepAlive: string;
  timeoutSeconds: number;
}

export interface ExecutionReceiptV1 {
  contractId: 'aura.execution-receipt.v1';
  contractVersion: '1.0.0';
  requestedInputMode: DiagnosisInputModeV2;
  effectiveInputMode: DiagnosisInputModeV2;
  includedSections: string[];
  evidenceEnvelopeRef: string;
  promptVersion: string;
  promptHash: string;
  inputHash: string;
  responseSchemaHash: string;
  provider: string;
  requestedModel: string;
  /**
   * `null` when the provider failed before reporting a model identity
   * (transport error, malformed response, or empty stream). Callers must
   * not invent a value — the absence is part of the contract.
   */
  observedModel: string | null;
  modelDigest: string | null;
  inferenceHash: string;
  startedAt: string;
  completedAt: string;
  rawResponseHash: string;
  validationStatus: 'valid' | 'invalid';
  validationErrorCodes: string[];
  receiptHash: string;
}

// ── Diagnosis Error Codes ──
export type DiagnosisErrorCode =
  | 'DIAGNOSIS_JSON_INVALID'
  | 'DIAGNOSIS_SCHEMA_INVALID'
  | 'DIAGNOSIS_REFERENCE_INVALID'
  | 'DIAGNOSIS_ENVELOPE_MISMATCH'
  | 'DIAGNOSIS_REVIEW_DOWNGRADE'
  | 'DIAGNOSIS_EXECUTABLE_CONTENT'
  | 'DIAGNOSIS_ADAPTER_ERROR'
  | 'CONTRACTS_V2_DISABLED';

export interface DiagnosisError {
  code: DiagnosisErrorCode;
  message: string;
  path: string;
  details: unknown;
}

// ── Remediation Action Types ──

export type RemediationActionTypeV2 =
  | 'trim_whitespace'
  | 'drop_exact_duplicates'
  | 'normalize_placeholders'
  | 'normalize_casing'
  | 'convert_disguised_numbers'
  | 'requires_human_review';

// ── Remediation Parameters (discriminated by action type) ──

export interface TrimWhitespaceParams {
  trimEdges: true;
  collapseInternalWhitespace: boolean;
}

export interface DropExactDuplicatesParams {
  keep: 'first';
}

export interface NormalizePlaceholdersParams {
  strategy: 'controlled_vocabulary';
  replacement: null;
}

export interface NormalizeCasingParams {
  strategy: 'title_case' | 'lowercase';
}

export interface ConvertDisguisedNumbersParams {
  decimalSeparator: 'auto';
  errors: 'coerce';
}

export interface RequiresHumanReviewParams {
  reasonCode:
    | 'unknown_rule'
    | 'ambiguous_column'
    | 'review_only_rule'
    | 'diagnosis_requires_review'
    | 'authorization_missing'
    | 'no_safe_transform';
}

export type RemediationParametersV2 =
  | TrimWhitespaceParams
  | DropExactDuplicatesParams
  | NormalizePlaceholdersParams
  | NormalizeCasingParams
  | ConvertDisguisedNumbersParams
  | RequiresHumanReviewParams;

// ── Remediation Context (minimized, no samples/text/keys) ──

export interface RemediationContextColumnV2 {
  columnId: string;
  name: string;
  position: number;
  duplicateOrdinal: number;
  isAmbiguous: boolean;
  isDuplicate: boolean;
}

export interface RemediationContextIssueV2 {
  issueId: string;
  ruleId: string;
  columnId: string | null;
  scope: 'dataset' | 'column';
  evidenceRefs: string[];
  actionability: Actionability;
  automaticAuthorization: AutomaticAuthorization;
}

export interface RemediationContextV2 {
  evidenceEnvelopeRef: string;
  inputReceiptRef?: string;
  datasetFingerprint: string;
  columns: RemediationContextColumnV2[];
  issues: RemediationContextIssueV2[];
}

// ── Remediation Error Codes ──

export type RemediationErrorCode =
  | 'REMEDIATION_SCHEMA_INVALID'
  | 'REMEDIATION_REFERENCE_INVALID'
  | 'REMEDIATION_DIAGNOSIS_MISMATCH'
  | 'REMEDIATION_ACTION_NOT_ALLOWED'
  | 'REMEDIATION_ACTIONABILITY_UPGRADE'
  | 'REMEDIATION_ACTION_ID_INVALID'
  | 'REMEDIATION_COVERAGE_INVALID'
  | 'REMEDIATION_APPROVAL_INVALID'
  | 'CONTRACTS_V2_DISABLED';

// ── Remediation Contract ──
export interface RemediationPlanV2 {
  contractId: 'aura.remediation.v2';
  contractVersion: '2.0.0';
  planId: string;
  diagnosisRef: string;
  evidenceEnvelopeRef: string;
  inputReceiptRef?: string;
  inputTrace?: {
    inputMode: DiagnosisInputModeV2;
    promptHash: string;
    inputHash: string;
    evidenceEnvelopeRef: string;
  };
  datasetFingerprint: string;
  plan: RemediationActionV2[];
  actionabilityMap: Record<string, Actionability>;
  exclusions: Array<{
    issueId: string;
    reason: 'not_actionable';
  }>;
  generatedAt: string;
}

export interface RemediationActionV2 {
  actionId: string;
  issueId: string;
  ruleId: string;
  columnId: string | null;
  actionType: RemediationActionTypeV2;
  parameters: RemediationParametersV2;
  actionability: Actionability;
  evidenceRefs: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

// ── DiagnosisExecutionResult (with optional remediation context) ──
export interface DiagnosisExecutionResult {
  version: 2;
  diagnosis: DiagnosisResponseV2;
  metrics: {
    latencyMs: number;
    tokensGenerated: number;
    firstTokenMs?: number;
    model: string;
    provider: string;
    isLocal: boolean;
  };
  promptHash: string;
  evidenceEnvelopeRef: string;
  promptVersion: string;
  rawResponseHash: string;
  inputMode?: DiagnosisInputModeV2;
  inputHash?: string;
  inputSnapshot?: DiagnosisInputPackageV2;
  executionReceipt?: ExecutionReceiptV1;
  remediationContext?: RemediationContextV2;
}

/**
 * Structured evidence from a failed V2 diagnosis.
 * Contains the input snapshot, an invalid execution receipt, and the codes
 * that explain why the diagnosis could not complete.
 * This is a separate contract from {@link DiagnosisExecutionResult} so
 * consumers (MainPipeline, diagnosticReportBuilder, exportPackage) can
 * distinguish success from failure without inspecting null fields.
 */
export interface DiagnosisFailureEvidenceV2 {
  contractId: 'aura.diagnosis-failure-evidence.v2';
  code: string;
  message: string;
  path: string;
  inputSnapshot: DiagnosisInputPackageV2;
  executionReceipt: ExecutionReceiptV1;
  rawResponseHash: string;
}

export const isDiagnosisFailureEvidenceV2 = (
  value: unknown,
): value is DiagnosisFailureEvidenceV2 =>
  typeof value === 'object'
  && value !== null
  && (value as Record<string, unknown>).contractId === 'aura.diagnosis-failure-evidence.v2';

// ── Script Exclusion (Phase 4) ──
export type ScriptExclusionReasonV2 =
  | 'pending'
  | 'ambiguous_column'
  | 'missing_column'
  | 'unsupported_action';

export interface ScriptExcludedActionV2 {
  actionId: string;
  reason: ScriptExclusionReasonV2;
}

// ── Column Registry (Phase 4) ──
export interface ColumnRegistryV2 {
  orderedColumns: readonly ColumnRef[];
  byColumnId: ReadonlyMap<string, ColumnRef>;
  byName: ReadonlyMap<string, readonly ColumnRef[]>;
}

// ── Column Resolution Failure Reasons (Phase 4) ──
export type ColumnResolutionFailureReasonV2 =
  | 'context_invalid'
  | 'missing_column'
  | 'ambiguous_column';

// ── Correspondence Evidence (Phase 4) ──
export interface CorrespondenceEvidenceV2 {
  fingerprintMatch: boolean;
  columnsMatch: boolean;
  missingColumnIds: readonly string[];
  unexpectedColumnIds: readonly string[];
  mismatchedColumns: readonly string[];
  columnsFromContext: number;
  columnsInRegistry: number;
  valid: boolean;
}

// ── Script Build Context (Phase 4) ──
export interface ScriptBuildContextV2 {
  remediationContext: RemediationContextV2;
  sourceDatasetFingerprint: string;
  columnRegistry: ColumnRegistryV2;
  correspondenceEvidence: CorrespondenceEvidenceV2;
}

// ── Column Access Spec (Phase 4) ──
export type ColumnAccessMode = 'label' | 'position';

export interface ColumnAccessSpecV2 {
  columnId: string;
  pythonLiteral: string;
  accessMode: ColumnAccessMode;
  position: number;
  duplicateOrdinal: number;
  readExpression: string;
  writeTarget: string;
}

// ── Python Syntax State (Phase 4) ──
export type PythonSyntaxState = 'passed' | 'failed' | 'not_run';

// ── Script Validation Result (Phase 4) ──
export interface ScriptValidationResultV2 extends ValidationResultV2 {
  pythonSyntax: {
    state: PythonSyntaxState;
    engine?: string;
    message?: string;
  };
}

// ── Script Contract Candidate (Phase 4) ──
export interface ScriptContractCandidateV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';
  remediationRef: string;
  inputReceiptRef?: string;
  inputTrace?: RemediationPlanV2['inputTrace'];
  datasetFingerprint: string;
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  excludedActionIds: ScriptExcludedActionV2[];
  columnRefs: ColumnRef[];
  rendererVersion: string;
  placeholderVocabularyVersion: string;
  scriptText: string;
  cleanDatasetFn: string;
  generatedAt: string;
}

// ── Script Contract (Phase 4) ──
export interface ScriptContractV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';
  remediationRef: string;
  inputReceiptRef?: string;
  inputTrace?: RemediationPlanV2['inputTrace'];
  datasetFingerprint: string;
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  excludedActionIds: ScriptExcludedActionV2[];
  columnRefs: ColumnRef[];
  rendererVersion: string;
  placeholderVocabularyVersion: string;
  scriptText: string;
  cleanDatasetFn: string;
  scriptHash: string;
  validationResult: ScriptValidationResultV2;
  generatedAt: string;
}
