export interface CsvParsedData {
  data: Record<string, any>[];
  meta: {
    delimiter: string;
    fields: string[];
    truncated: boolean;
  };
  errors: any[];
}

export enum IssueSeverity {
  CRITICAL = 'critical',   // Red
  WARNING = 'warning',     // Orange
  INFO = 'info',           // Yellow
  GOOD = 'good'            // Green
}

export enum IssueCategory {
  INTEGRITY = 'Integridad y Estructura',
  HYGIENE = 'Higiene de Texto',
  TYPES = 'Tipos de Datos e Inferencia',
  LOGIC = 'Validez y Lógica de Negocio',
  SEMANTIC = 'Semántica y Seguridad'
}

export interface QualityIssue {
  id: string;
  column?: string;
  ruleName: string;
  category: IssueCategory;
  description: string;
  severity: IssueSeverity;
  count: number;
  affectedPercentage: number;
  sampleValues: any[];
}

export interface ColumnStats {
  name: string;
  inferredType: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  nullCount: number;
  uniqueCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  zeros?: number;
  topFreq?: { value: string; count: number }[];
  sampleValues?: any[];
}

export interface ScoreDeduction {
  reason: string;
  points: number;
  category: IssueCategory;
}

export interface AuditReport {
  score: number; // 0 - 100
  rowCount: number;
  colCount: number;
  duplicateRows: number;
  issues: QualityIssue[];
  columnStats: Record<string, ColumnStats>;
  scoreBreakdown: ScoreDeduction[];
  delimiterDetected: string;
}

export interface AIConfig {
  apiKey: string;
  model: string;
  autoAnalyze: boolean;
}

export interface ExecutiveReportContent {
  title: string;
  domain_inferred: string;
  dataset_technical_description: string; // New: AI narration of the structure
  executive_summary: string;
  business_impact: string;
  key_findings: string[];
  recommendations: string[];
}