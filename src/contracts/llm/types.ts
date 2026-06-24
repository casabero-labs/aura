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

// ── Remediation Contract ──
export interface RemediationPlanV2 {
  contractId: 'aura.remediation.v2';
  contractVersion: '2.0.0';
  diagnosisRef: string;
  plan: RemediationActionV2[];
  actionabilityMap: Record<string, Actionability>;
}

export interface RemediationActionV2 {
  actionId: string;
  issueId: string;
  ruleId: string;
  columnId: string | null;
  actionType: string;
  parameters: Record<string, unknown>;
  actionability: Actionability;
  evidenceRefs: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

// ── Script Contract ──
export interface ScriptContractV2 {
  contractId: 'aura.script.v2';
  contractVersion: '2.0.0';
  remediationRef: string;
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  rendererVersion: string;
  scriptHash: string;
  validationResult: ValidationResultV2;
  scriptText?: string;
  columnRefs: string[];
  cleanDatasetFn: string;
}
