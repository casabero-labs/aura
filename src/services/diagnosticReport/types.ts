import type { IssueCategory, IssueSeverity } from '../../types';

export type DiagnosticStatus =
  | 'deterministic_only'
  | 'llm_diagnosis_available'
  | 'llm_diagnosis_unavailable';

export type DiagnosisSummarySource =
  | 'structured_v2'
  | 'legacy_text'
  | 'unavailable';

export type DiagnosticConfidence = 'low' | 'medium' | 'high';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type RecommendationActionType =
  | 'inspect'
  | 'document'
  | 'transform_optional'
  | 'generate_script_optional'
  | 'do_not_auto_fix';

export type DiagnosticChartKind =
  | 'bar'
  | 'horizontal_bar'
  | 'pie'
  | 'table';

export type DiagnosticChartSource =
  | 'audit_report'
  | 'column_stats'
  | 'diagnosis';

export interface DiagnosticReport {
  metadata: DiagnosticReportMetadata;
  status: DiagnosticReportStatus;
  evidenceBase: DiagnosticEvidenceBase;
  diagnosisSummary: DiagnosticDiagnosisSummary;
  findingGroups: DiagnosticFindingGroups;
  recommendations: DiagnosticRecommendation[];
  chartSpecs: DiagnosticChartSpec[];
  exportReadiness: DiagnosticExportReadiness;
}

export interface DiagnosticReportMetadata {
  reportId: string;
  generatedAt: string;
  version: string;
  sourceDatasetFingerprint: string;
  fileName?: string;
  rowCount: number;
  colCount: number;
  delimiter: string;
  scoreBase: number;
  scoreModified: false;
}

export interface DiagnosticReportStatus {
  diagnosticStatus: DiagnosticStatus;
  scriptRecommended: boolean;
  scriptRequired: false;
  hitlRequiredForMainReport: false;
  hitlRequiredForRemediation: boolean;
}

export interface DiagnosticEvidenceBase {
  severityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  columnTypeCounts: Record<string, number>;
  semanticTypeCounts: Record<string, number>;
  duplicateRows: number;
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  topIssues: DiagnosticIssueSummary[];
  topNullColumns: DiagnosticNullColumnSummary[];
  topCardinalityColumns: DiagnosticCardinalityColumnSummary[];
  numericProfileSummary: DiagnosticNumericProfileSummary;
  outlierColumns: DiagnosticOutlierColumnSummary[];
}

export interface DiagnosticIssueSummary {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: IssueSeverity;
  category: IssueCategory;
  column?: string;
  count: number;
  affectedPercentage: number;
  description: string;
}

export interface DiagnosticNullColumnSummary {
  column: string;
  nullCount: number;
  nullPercentage: number;
  inferredType: string;
  semanticType?: string;
}

export interface DiagnosticCardinalityColumnSummary {
  column: string;
  uniqueCount: number;
  uniquePercentage: number;
  inferredType: string;
  semanticType?: string;
}

export interface DiagnosticNumericProfileSummary {
  numericColumns: number;
  columnsWithOutliers: number;
  columnsWithDistributionStats: number;
  averageNullPercentage: number;
}

export interface DiagnosticOutlierColumnSummary {
  column: string;
  outlierCount: number;
  outlierPercentage: number;
  outlierSeverity?: string;
  lowerFence?: number;
  upperFence?: number;
}

export interface DiagnosticDiagnosisSummary {
  source: DiagnosisSummarySource;
  provider: string | null;
  model: string | null;
  latencyMs?: number;
  evidenceEnvelopeRef?: string;
  promptHash?: string;
  executiveSummary: string;
  observations: DiagnosticObservation[];
  limitations: string[];
}

export interface DiagnosticObservation {
  id: string;
  sourceIssueId?: string;
  title: string;
  text: string;
  recommendation?: string;
  requiresHumanReview: boolean;
}

export interface DiagnosticFindingGroups {
  confirmedRisks: DiagnosticFinding[];
  possibleFalsePositiveCandidates: DiagnosticFinding[];
  humanReviewRequired: DiagnosticFinding[];
  optionalRemediationCandidates: DiagnosticFinding[];
}

export interface DiagnosticFinding {
  id: string;
  title: string;
  severity: IssueSeverity;
  category: IssueCategory;
  sourceIssueIds: string[];
  columns: string[];
  evidenceSummary: string;
  contextualInterpretation: string;
  confidence: DiagnosticConfidence;
  scoreModified: false;
  requiresHumanReview: boolean;
  canGenerateScript: boolean;
}

export interface DiagnosticRecommendation {
  id: string;
  priority: RecommendationPriority;
  title: string;
  rationale: string;
  actionType: RecommendationActionType;
  sourceIssueIds: string[];
  requiresScript: boolean;
  requiresHITL: boolean;
}

export interface DiagnosticChartSpec {
  id: string;
  title: string;
  description: string;
  kind: DiagnosticChartKind;
  data: Array<Record<string, string | number | boolean | null>>;
  xKey: string;
  yKey: string;
  valueSuffix?: string;
  source: DiagnosticChartSource;
  notes?: string[];
}

export interface DiagnosticExportReadiness {
  pdfReady: boolean;
  jsonReady: boolean;
  issuesCsvReady: boolean;
  scriptExportsReady: boolean;
  missingInputs: string[];
}
