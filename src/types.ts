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
  providerType: 'cloud' | 'local';  // Capa 0: Selección de infraestructura
}

export interface ExecutiveReportContent {
  title: string;
  domain_inferred: string;
  dataset_technical_description: string;
  executive_summary: string;
  business_impact: string;
  key_findings: string[];
  recommendations: string[];
  python_script?: string;
}

// --- Capa 2: Abstracción del Proveedor de IA ---

/**
 * Métricas de rendimiento por ejecución del proveedor.
 * Utilizadas en el benchmark multi-modelo (OE2).
 */
export interface ProviderMetrics {
  provider: string;
  model: string;
  latencyMs: number;
  firstTokenMs: number;
  tokensGenerated: number;
  isLocal: boolean;
  timestamp: string;
}

export interface BenchmarkResult {
  id: string;
  provider: string;
  providerType: 'local' | 'cloud';
  inputMode: 'smart_sample' | 'prompt_libre';
  model: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'unavailable';
  latencyMs: number;
  firstTokenMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  formatCompliance: boolean;
  pythonScriptIncluded: boolean;
  hallucinatedColumns: string[];
  unsupportedClaims: number;
  error?: string;
  timestamp: string;
}

/**
 * Interfaz abstracta para proveedores de IA.
 * Permite intercambiar Gemini Cloud ↔ WebLLM Local
 * sin modificar la lógica de la aplicación.
 * 
 * Referencia: §3.3.3 Capa 2 — Estabilidad Cognitiva
 */
export interface AIProvider {
  readonly name: string;
  readonly type: 'cloud' | 'local';

  /** Análisis streaming (Tab IA del Dashboard) — Mecanismos M1-M4 */
  analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<ProviderMetrics>;

  /** Reporte ejecutivo JSON estructurado (PDF) — Mecanismo M5 */
  generateExecutiveReport(
    report: AuditReport
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }>;

  /** Respuesta libre para benchmarks de prompt no controlado */
  generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }>;

  /** Verifica si el proveedor está disponible en el entorno actual */
  isAvailable(): Promise<boolean>;
}
