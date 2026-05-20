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

export type SemanticType = 'string' | 'number' | 'boolean' | 'date' | 'mixed' | 'email' | 'phone' | 'ip' | 'url' | 'currency' | 'percentage' | 'uuid' | 'zip';

export interface ColumnStats {
  name: string;
  inferredType: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  semanticType?: SemanticType;
  nullCount: number;
  uniqueCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  std?: number;
  cv?: number;
  skewness?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  lowerFence?: number;
  upperFence?: number;
  lowerFenceTukey?: number;
  upperFenceTukey?: number;
  outlierCount?: number;
  outlierSeverity?: 'INFO' | 'WARNING';
  outlierCountTukey?: number;
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

export interface ExecutionTraceEvent {
  stage: string;
  timestamp: string;
  elapsedMs: number;
  details?: Record<string, string | number | boolean | null | undefined>;
}

export interface AuditExecutionEvidence {
  id: string;
  fileName?: string;
  datasetFingerprint: string;
  startedAt: string;
  completedAt: string;
  parseDurationMs: number;
  auditDurationMs: number;
  totalDurationMs: number;
  rowsProcessed: number;
  columnsProcessed: number;
  delimiter: string;
  truncated: boolean;
  issueCount: number;
  score: number;
  trace: ExecutionTraceEvent[];
}

export interface ModelDownloadState {
  status: 'idle' | 'downloading' | 'ready' | 'error';
  progress: number;
  message: string;
}

export interface PromptContractConfig {
  objective: string;
  evidencePolicy: 'strict' | 'balanced';
  requireScriptReadiness: boolean;
  includeHumanReviewLabels: boolean;
  includeCopyPasteEvidence: boolean;
  extraInstructions?: string;
}

export interface AIConfig {
  model: string;
  temperature: number;
  autoAnalyze: boolean;
  providerType: 'cloud' | 'local' | 'chrome';
  cloudProvider?: CloudProvider;
  apiKey?: string;
  modelDownloadState?: Record<string, ModelDownloadState>;
  promptContract?: PromptContractConfig;
}

export type CloudProvider = 'google' | 'groq' | 'deepseek' | 'openrouter' | 'minimax' | 'nvidia';

export interface ExecutiveReportContent {
  title: string;
  domain_inferred: string;
  dataset_technical_description: string;
  executive_summary: string;
  business_impact: string;
  key_findings: string[];
  recommendations: string[];
  python_script?: string;
  remediation_actions?: RemediationAction[];
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
  providerType: 'local' | 'cloud' | 'chrome';
  cloudProvider?: string;  // Proveedor cloud específico
  inputMode: 'smart_sample' | 'prompt_libre';
  model: string;
  temperature: number;  // Temperatura usada en el experimento
  status: 'pending' | 'running' | 'completed' | 'error' | 'unavailable';
  latencyMs: number;
  firstTokenMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  formatCompliance: boolean;
  pythonScriptIncluded: boolean;
  hallucinatedColumns: string[];
  unsupportedClaims: number;
  evidenceStatus: EvidenceStatus;
  startedAt?: string;
  completedAt?: string;
  datasetFingerprint?: string;
  webGpuAvailable?: boolean;
  executionTrace?: ExecutionTraceEvent[];
  hallucinationReport?: HallucinationReportSummary;
  scriptValidation?: ScriptValidationResult;
  recommendedForRemediation?: boolean;
  compositeScore?: number;  // Score compuesto post-evaluación
  error?: string;
  timestamp: string;
}

export type EvidenceStatus = 'planned' | 'attempted_failed' | 'preliminary_valid' | 'formal_valid';

export type RemediationActionType =
  | 'trim_whitespace'
  | 'normalize_placeholders'
  | 'drop_exact_duplicates'
  | 'normalize_casing'
  | 'convert_disguised_numbers'
  | 'requires_human_review';

export interface RemediationAction {
  id: string;
  type: RemediationActionType;
  column?: string;
  description: string;
  sourceIssueId?: string;
  sourceRuleName?: string;
  safeToSimulate: boolean;
  requiresHumanReview?: boolean;
}

export interface ScriptValidationResult {
  valid: boolean;
  hasScript: boolean;
  invalidColumns: string[];
  destructiveOperations: string[];
  coveredIssueIds: string[];
  requiresHumanReview: boolean;
  warnings: string[];
}

export interface HallucinationReportSummary {
  hallucinatedColumns: string[];
  unsupportedClaimsCount: number;
  jsonCompliance: boolean;
  formatErrorCount: number;
  invalidScriptColumns: string[];
}

export interface HealthDelta {
  beforeScore: number;
  afterScore: number;
  scoreDelta: number;
  beforeCriticalIssues: number;
  afterCriticalIssues: number;
  criticalDelta: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  issueDelta: number;
  correctedRules: string[];
  unchangedRules: string[];
  requiresHumanReview: string[];
}

export interface ImprovementRun {
  id: string;
  fileName?: string;
  evidenceStatus: EvidenceStatus;
  auditEvidence?: AuditExecutionEvidence;
  initialReport: AuditReport;
  benchmarkResults: BenchmarkResult[];
  recommendedResult?: BenchmarkResult;
  generatedScript?: string;
  scriptValidation?: ScriptValidationResult;
  remediationActions: RemediationAction[];
  simulatedData?: Record<string, any>[];
  simulatedReport?: AuditReport;
  healthDelta?: HealthDelta;
  createdAt: string;
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
  readonly type: 'cloud' | 'local' | 'chrome';

  /** Análisis streaming (Tab IA del Dashboard) — Mecanismos M1-M4 */
  analyzeStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<ProviderMetrics>;

  /** Reporte ejecutivo JSON estructurado (PDF) — Mecanismo M5 */
  generateExecutiveReport(
    report: AuditReport
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }>;

  /** Reporte ejecutivo streaming con razonamiento visible */
  generateExecutiveReportStream(
    report: AuditReport,
    onChunk: (text: string) => void
  ): Promise<{ content: ExecutiveReportContent; metrics: ProviderMetrics }>;

  /** Respuesta libre para benchmarks de prompt no controlado */
  generateText(prompt: string): Promise<{ text: string; metrics: ProviderMetrics }>;

  /** Verifica si el proveedor está disponible en el entorno actual */
  isAvailable(): Promise<boolean>;

  /** Precarga el modelo en caché (solo local) */
  preloadModel?(onProgress?: (progress: number, message: string) => void): Promise<void>;

  /** Libera memoria (solo local) de WebGPU/VRAM */
  unloadModel?(): Promise<void>;
}
