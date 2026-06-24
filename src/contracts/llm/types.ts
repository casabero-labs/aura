/**
 * Contracts v2 — Shared types.
 * Fase 1: typed, versioned infrastructure. No Ollama, no production activation.
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
  schema: Record<string, unknown>;
  createdAt: string;
  compatibility: CompatibilityDescriptor;
  validationResult: ValidationResultSummary;
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
  columnId: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'good';
  count: number;
  affectedPercentage: number;
  evidenceRefs: string[];
  actionability: Actionability;
}

export type Actionability = 'auto_safe' | 'review_only' | 'not_actionable';

export interface EvidenceV2 {
  samples: EvidenceSampleV2[];
  columnStats: Record<string, ColumnStatsV2>;
}

export interface EvidenceSampleV2 {
  evidenceRef: string;
  issueId: string;
  columnId: string;
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
  excludedByBudget: BudgetExclusionV2[];
}

export interface BudgetExclusionV2 {
  reason: string;
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
