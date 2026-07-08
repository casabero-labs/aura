import {
  AuditExecutionEvidence,
  AuditReport,
  ColumnStats,
  DeterministicValidationReport,
  IssueCategory,
  IssueSeverity,
  QualityIssue,
} from '../../types';
import type { DiagnosisExecutionResult } from '../../contracts/llm';
import type {
  DiagnosticCardinalityColumnSummary,
  DiagnosticChartSpec,
  DiagnosticDiagnosisSummary,
  DiagnosticEvidenceBase,
  DiagnosticFinding,
  DiagnosticFindingGroups,
  DiagnosticIssueSummary,
  DiagnosticNullColumnSummary,
  DiagnosticObservation,
  DiagnosticOutlierColumnSummary,
  DiagnosticRecommendation,
  DiagnosticReport,
  DiagnosticStatus,
} from './types';
import {
  buildLegacyExecutiveSummary,
  cleanDiagnosticText,
  splitDiagnosticSentences,
  truncatePresentationText,
} from './presentation';

const REPORT_VERSION = '0.1.0-l13b';
const TOP_ISSUES_LIMIT = 10;
const TOP_COLUMNS_LIMIT = 8;
const TOP_CHART_ROWS_LIMIT = 8;

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  [IssueSeverity.CRITICAL]: 0,
  [IssueSeverity.WARNING]: 1,
  [IssueSeverity.INFO]: 2,
  [IssueSeverity.GOOD]: 3,
};

const SCRIPTABLE_RULE_IDS = new Set([
  'rule:trim-whitespace',
  'rule:exact-duplicates',
  'rule:toxic-placeholders',
  'rule:capitalization-chaos',
  'rule:semantic-variants',
  'rule:double-spaces',
  'rule:disguised-numbers',
]);

export interface BuildDiagnosticReportParams {
  report: AuditReport;
  auditEvidence: AuditExecutionEvidence | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  aiAnalysis?: string;
  deterministicValidation?: DeterministicValidationReport | null;
  fileName?: string | null;
}

export const buildDiagnosticReport = ({
  report,
  auditEvidence,
  structuredDiagnosis = null,
  aiAnalysis = '',
  deterministicValidation = null,
  fileName = null,
}: BuildDiagnosticReportParams): DiagnosticReport => {
  const sourceDatasetFingerprint =
    auditEvidence?.datasetFingerprint ??
    `report-only-${stableHash([
      report.rowCount,
      report.colCount,
      report.score,
      report.issues.map((issue) => issue.id).join('|'),
    ].join(':'))}`;

  const evidenceBase = buildEvidenceBase(report);
  const diagnosisSummary = buildDiagnosisSummary({
    report,
    structuredDiagnosis,
    aiAnalysis,
    deterministicValidation,
  });
  const findingGroups = buildFindingGroups(report, structuredDiagnosis);
  const recommendations = buildRecommendations(report, findingGroups);
  const scriptRecommended =
    findingGroups.optionalRemediationCandidates.length > 0 ||
    recommendations.some((recommendation) => recommendation.requiresScript);

  const generatedAt =
    structuredDiagnosis?.diagnosis.generatedAt ??
    auditEvidence?.completedAt ??
    '1970-01-01T00:00:00.000Z';

  return {
    metadata: {
      reportId: `diag-report-${stableHash([
        sourceDatasetFingerprint,
        report.score,
        report.rowCount,
        report.colCount,
        diagnosisSummary.source,
        structuredDiagnosis?.diagnosis.responseId ?? '',
      ].join(':'))}`,
      generatedAt,
      version: REPORT_VERSION,
      sourceDatasetFingerprint,
      ...(fileName || auditEvidence?.fileName
        ? { fileName: fileName ?? auditEvidence?.fileName }
        : {}),
      rowCount: report.rowCount,
      colCount: report.colCount,
      delimiter: report.delimiterDetected,
      scoreBase: report.score,
      scoreModified: false,
    },
    status: {
      diagnosticStatus: getDiagnosticStatus(structuredDiagnosis, aiAnalysis),
      scriptRecommended,
      scriptRequired: false,
      hitlRequiredForMainReport: false,
      hitlRequiredForRemediation: scriptRecommended,
    },
    evidenceBase,
    diagnosisSummary,
    findingGroups,
    recommendations,
    chartSpecs: buildChartSpecs(evidenceBase),
    exportReadiness: {
      pdfReady: true,
      jsonReady: true,
      issuesCsvReady: true,
      scriptExportsReady: false,
      missingInputs: auditEvidence ? [] : ['auditEvidence'],
    },
  };
};

const buildEvidenceBase = (report: AuditReport): DiagnosticEvidenceBase => {
  const severityCounts = countIssuesBy(report.issues, (issue) => issue.severity);
  const categoryCounts = countIssuesBy(report.issues, (issue) => issue.category);
  const columns = Object.values(report.columnStats);
  const columnTypeCounts = countColumnsBy(columns, (column) => column.inferredType);
  const semanticTypeCounts = countColumnsBy(columns, (column) => column.semanticType ?? 'unknown');
  const topIssues = sortIssues(report.issues).slice(0, TOP_ISSUES_LIMIT).map(toIssueSummary);
  const topNullColumns = columns
    .map((column) => toNullColumnSummary(column, report.rowCount))
    .filter((column) => column.nullCount > 0)
    .sort((a, b) => b.nullPercentage - a.nullPercentage || b.nullCount - a.nullCount || a.column.localeCompare(b.column))
    .slice(0, TOP_COLUMNS_LIMIT);
  const topCardinalityColumns = columns
    .map((column) => toCardinalityColumnSummary(column, report.rowCount))
    .sort((a, b) => b.uniquePercentage - a.uniquePercentage || b.uniqueCount - a.uniqueCount || a.column.localeCompare(b.column))
    .slice(0, TOP_COLUMNS_LIMIT);
  const outlierColumns = columns
    .map((column) => toOutlierColumnSummary(column, report.rowCount))
    .filter((column): column is DiagnosticOutlierColumnSummary => column !== null)
    .sort((a, b) => b.outlierPercentage - a.outlierPercentage || b.outlierCount - a.outlierCount || a.column.localeCompare(b.column))
    .slice(0, TOP_COLUMNS_LIMIT);
  const numericColumns = columns.filter((column) => column.inferredType === 'number');
  const averageNullPercentage = columns.length === 0
    ? 0
    : round2(columns.reduce((sum, column) => sum + percentage(column.nullCount, report.rowCount), 0) / columns.length);

  return {
    severityCounts,
    categoryCounts,
    columnTypeCounts,
    semanticTypeCounts,
    duplicateRows: report.duplicateRows,
    totalIssues: report.issues.length,
    criticalIssues: severityCounts[IssueSeverity.CRITICAL] ?? 0,
    warningIssues: severityCounts[IssueSeverity.WARNING] ?? 0,
    infoIssues: severityCounts[IssueSeverity.INFO] ?? 0,
    topIssues,
    topNullColumns,
    topCardinalityColumns,
    numericProfileSummary: {
      numericColumns: numericColumns.length,
      columnsWithOutliers: outlierColumns.length,
      columnsWithDistributionStats: numericColumns.filter((column) => typeof column.mean === 'number' || typeof column.median === 'number').length,
      averageNullPercentage,
    },
    outlierColumns,
  };
};

const buildDiagnosisSummary = ({
  report,
  structuredDiagnosis,
  aiAnalysis,
  deterministicValidation,
}: {
  report: AuditReport;
  structuredDiagnosis: DiagnosisExecutionResult | null;
  aiAnalysis: string;
  deterministicValidation: DeterministicValidationReport | null;
}): DiagnosticDiagnosisSummary => {
  if (structuredDiagnosis) {
    const observations = structuredDiagnosis.diagnosis.diagnosisBlocks
      .slice(0, TOP_ISSUES_LIMIT)
      .map((block, index): DiagnosticObservation => ({
        id: `structured-observation-${index + 1}`,
        sourceIssueId: block.issueId,
        title: block.ruleId,
        text: truncateText(block.observation, 360),
        recommendation: truncateText(block.recommendation, 280),
        requiresHumanReview: structuredDiagnosis.diagnosis.issues.some(
          (issue) => issue.issueId === block.issueId && issue.requiresHumanReview,
        ),
      }));

    return {
      source: 'structured_v2',
      provider: structuredDiagnosis.metrics.provider,
      model: structuredDiagnosis.metrics.model,
      latencyMs: structuredDiagnosis.metrics.latencyMs,
      evidenceEnvelopeRef: structuredDiagnosis.evidenceEnvelopeRef,
      promptHash: structuredDiagnosis.promptHash,
      executiveSummary: buildStructuredExecutiveSummary(report, observations),
      observations,
      limitations: [
        ...structuredDiagnosis.diagnosis.limitations.map((limitation) => truncateText(limitation, 280)),
        'El diagnostico asistido contextualiza evidencia; no modifica score ni convierte interpretacion en validacion formal.',
        ...(deterministicValidation?.groundTruthMatched ? [] : ['Sin validacion determinista formal asociada a ground truth en este reporte.']),
      ],
    };
  }

  const legacyText = aiAnalysis.trim();
  if (legacyText.length > 0) {
    return {
      source: 'legacy_text',
      provider: null,
      model: null,
      executiveSummary: buildLegacyExecutiveSummary(report, legacyText),
      observations: splitLegacyObservations(legacyText),
      limitations: [
        'Diagnostico legacy en texto libre: no contiene referencias estructuradas verificables por contrato v2.',
        'El diagnostico asistido contextualiza evidencia; no modifica score ni convierte interpretacion en validacion formal.',
      ],
    };
  }

  return {
    source: 'unavailable',
    provider: null,
    model: null,
    executiveSummary: `Reporte construido con evidencia determinista: score ${report.score}/100, ${report.issues.length} hallazgos y ${report.duplicateRows} filas duplicadas.`,
    observations: [],
    limitations: [
      'Diagnostico asistido no disponible; reporte generado solo con evidencia determinista.',
      'Sin interpretacion contextual LLM. Revisar hallazgos con criterio de dominio antes de remediar.',
    ],
  };
};

const buildFindingGroups = (
  report: AuditReport,
  structuredDiagnosis: DiagnosisExecutionResult | null,
): DiagnosticFindingGroups => {
  const structuredReviewIssueIds = new Set(
    structuredDiagnosis?.diagnosis.issues
      .filter((issue) => issue.requiresHumanReview)
      .map((issue) => issue.issueId) ?? [],
  );
  const issueFindings = sortIssues(report.issues).map((issue) => issueToFinding(issue, structuredReviewIssueIds));
  const falsePositiveCandidates = buildFalsePositiveCandidates(report);
  const falsePositiveIds = new Set(falsePositiveCandidates.map((finding) => finding.id));
  const humanReviewRequired = dedupeFindings([
    ...issueFindings.filter((finding) => finding.requiresHumanReview),
    ...falsePositiveCandidates,
  ]);

  return {
    confirmedRisks: issueFindings
      .filter((finding) => finding.severity === IssueSeverity.CRITICAL || finding.severity === IssueSeverity.WARNING)
      .filter((finding) => !falsePositiveIds.has(finding.id)),
    possibleFalsePositiveCandidates: falsePositiveCandidates,
    humanReviewRequired,
    optionalRemediationCandidates: issueFindings.filter((finding) => finding.canGenerateScript),
  };
};

const buildFalsePositiveCandidates = (report: AuditReport): DiagnosticFinding[] => {
  const candidates: DiagnosticFinding[] = [];
  const columns = Object.values(report.columnStats);
  const issuesByColumn = new Map<string, QualityIssue[]>();

  for (const issue of report.issues) {
    if (!issue.column) continue;
    const existing = issuesByColumn.get(issue.column) ?? [];
    existing.push(issue);
    issuesByColumn.set(issue.column, existing);
  }

  for (const column of columns) {
    const name = column.name;
    const relatedIssues = issuesByColumn.get(name) ?? [];
    const sourceIssueIds = relatedIssues.map((issue) => issue.id);
    const normalized = normalizeName(name);
    const isUniqueish = report.rowCount > 0 && column.uniqueCount / report.rowCount >= 0.95;
    const isHighCardinality = report.rowCount > 0 && column.uniqueCount / report.rowCount >= 0.7;
    const isConstant = column.uniqueCount <= 1;
    const isMoneyOutlier = isMoneyLike(normalized) && (column.outlierCount ?? 0) > 0;
    const isIdentifierLike = isIdentifierName(normalized);
    const isDescriptorLike = isDescriptorName(normalized);
    const hasAllowedNegativeContext = allowsNegativeValues(normalized);

    if (isMoneyOutlier) {
      candidates.push(falsePositiveFinding({
        id: `fp-outlier-${slugify(name)}`,
        title: `${name}: posible falso positivo contextual en outliers monetarios`,
        category: firstCategory(relatedIssues, IssueCategory.TYPES),
        severity: firstSeverity(relatedIssues, IssueSeverity.WARNING),
        columns: [name],
        sourceIssueIds,
        evidenceSummary: `${name} registra ${column.outlierCount ?? 0} outlier(s). Es posible que valores altos sean tarifas, costos o precios validos del dominio.`,
        contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
      }));
    }

    if (isUniqueish && isIdentifierLike) {
      candidates.push(falsePositiveFinding({
        id: `fp-unique-id-${slugify(name)}`,
        title: `${name}: columna unica o casi unica compatible con identificador`,
        category: firstCategory(relatedIssues, IssueCategory.SEMANTIC),
        severity: firstSeverity(relatedIssues, IssueSeverity.INFO),
        columns: [name],
        sourceIssueIds,
        evidenceSummary: `${name} tiene ${column.uniqueCount} valores unicos sobre ${report.rowCount} filas.`,
        contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
      }));
    }

    if (isConstant) {
      candidates.push(falsePositiveFinding({
        id: `fp-constant-${slugify(name)}`,
        title: `${name}: columna constante que podria ser metadata`,
        category: firstCategory(relatedIssues, IssueCategory.INTEGRITY),
        severity: firstSeverity(relatedIssues, IssueSeverity.INFO),
        columns: [name],
        sourceIssueIds,
        evidenceSummary: `${name} tiene un unico valor distinto; podria representar lote, fuente o metadata.`,
        contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
      }));
    }

    if ((column.min as number | undefined) !== undefined && typeof column.min === 'number' && column.min < 0 && hasAllowedNegativeContext) {
      candidates.push(falsePositiveFinding({
        id: `fp-negative-${slugify(name)}`,
        title: `${name}: negativos posiblemente validos por contexto`,
        category: firstCategory(relatedIssues, IssueCategory.LOGIC),
        severity: firstSeverity(relatedIssues, IssueSeverity.INFO),
        columns: [name],
        sourceIssueIds,
        evidenceSummary: `${name} contiene valores negativos y su nombre sugiere delta, diferencia, balance, potencia, corriente, flujo o saldo.`,
        contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
      }));
    }

    if (isHighCardinality && (isIdentifierLike || isDescriptorLike)) {
      candidates.push(falsePositiveFinding({
        id: `fp-high-cardinality-${slugify(name)}`,
        title: `${name}: alta cardinalidad con apariencia de identificador o descriptor`,
        category: firstCategory(relatedIssues, IssueCategory.SEMANTIC),
        severity: firstSeverity(relatedIssues, IssueSeverity.INFO),
        columns: [name],
        sourceIssueIds,
        evidenceSummary: `${name} tiene ${column.uniqueCount} valores unicos; puede ser identificador, nombre, ticket, codigo o descriptor granular.`,
        contextualInterpretation: 'posible falso positivo contextual; requiere revisión humana; no modifica score; no corregir automáticamente.',
      }));
    }
  }

  return dedupeFindings(candidates).slice(0, TOP_ISSUES_LIMIT);
};

const buildRecommendations = (
  report: AuditReport,
  findingGroups: DiagnosticFindingGroups,
): DiagnosticRecommendation[] => {
  const recommendations: DiagnosticRecommendation[] = [];
  const issues = report.issues;
  const nullIssues = issues.filter((issue) => isNullIssue(issue));
  const outlierIssues = issues.filter((issue) => isOutlierIssue(issue));
  const piiIssues = issues.filter((issue) => issue.ruleId === 'rule:pii-detected' || issue.category === IssueCategory.SEMANTIC && /pii|privacidad|email|phone|telefono/i.test(issue.ruleName + issue.description));
  const constantColumns = Object.values(report.columnStats).filter((column) => column.uniqueCount <= 1);
  const uniqueIdentifierColumns = Object.values(report.columnStats).filter((column) => {
    const uniqueRatio = report.rowCount === 0 ? 0 : column.uniqueCount / report.rowCount;
    return uniqueRatio >= 0.95 && isIdentifierName(normalizeName(column.name));
  });

  if (nullIssues.length > 0) {
    recommendations.push({
      id: 'rec-inspect-critical-nulls',
      priority: nullIssues.some((issue) => issue.severity === IssueSeverity.CRITICAL) ? 'high' : 'medium',
      title: 'Inspeccionar patron de ausencia antes de imputar',
      rationale: 'Los nulos pueden indicar ausencia informativa, sesgo de captura o campos no aplicables. No deben imputarse sin revisar el contexto.',
      actionType: 'inspect',
      sourceIssueIds: nullIssues.map((issue) => issue.id),
      requiresScript: false,
      requiresHITL: false,
    });
  }

  if (outlierIssues.length > 0 || findingGroups.possibleFalsePositiveCandidates.some((finding) => finding.id.startsWith('fp-outlier-'))) {
    recommendations.push({
      id: 'rec-review-outliers-context',
      priority: 'medium',
      title: 'Revisar contexto de outliers antes de recortar o capar',
      rationale: 'Valores extremos pueden ser errores o eventos validos del dominio. La revision humana debe preceder cualquier transformacion.',
      actionType: 'do_not_auto_fix',
      sourceIssueIds: outlierIssues.map((issue) => issue.id),
      requiresScript: false,
      requiresHITL: true,
    });
  }

  if (uniqueIdentifierColumns.length > 0) {
    recommendations.push({
      id: 'rec-document-unique-identifiers',
      priority: 'medium',
      title: 'No eliminar automaticamente columnas unicas si son identificadores',
      rationale: `${uniqueIdentifierColumns.map((column) => column.name).slice(0, 4).join(', ')} pueden ser llaves, tickets o codigos necesarios para trazabilidad.`,
      actionType: 'document',
      sourceIssueIds: [],
      requiresScript: false,
      requiresHITL: true,
    });
  }

  if (constantColumns.length > 0) {
    recommendations.push({
      id: 'rec-review-constant-metadata',
      priority: 'low',
      title: 'Revisar columnas constantes como posible metadata',
      rationale: `${constantColumns.map((column) => column.name).slice(0, 4).join(', ')} pueden describir fuente, lote, periodo o configuracion del dataset.`,
      actionType: 'document',
      sourceIssueIds: [],
      requiresScript: false,
      requiresHITL: true,
    });
  }

  if (piiIssues.length > 0) {
    recommendations.push({
      id: 'rec-apply-privacy-policy',
      priority: 'high',
      title: 'Aplicar politica de privacidad o anonimizacion segun objetivo',
      rationale: 'Los campos con posible PII requieren decision de uso, minimizacion o anonimizacion antes de compartir o publicar evidencia.',
      actionType: 'do_not_auto_fix',
      sourceIssueIds: piiIssues.map((issue) => issue.id),
      requiresScript: false,
      requiresHITL: true,
    });
  }

  if (findingGroups.optionalRemediationCandidates.length > 0) {
    recommendations.push({
      id: 'rec-generate-script-optional',
      priority: 'low',
      title: 'Generar script solo como rama opcional de remediacion',
      rationale: 'El reporte principal no requiere script. Si se decide remediar, el script debe quedar como anexo revisado humanamente.',
      actionType: 'generate_script_optional',
      sourceIssueIds: findingGroups.optionalRemediationCandidates.flatMap((finding) => finding.sourceIssueIds),
      requiresScript: true,
      requiresHITL: true,
    });
  }

  return recommendations;
};

const buildChartSpecs = (evidenceBase: DiagnosticEvidenceBase): DiagnosticChartSpec[] => [
  {
    id: 'severity_counts',
    title: 'Hallazgos por severidad',
    description: 'Conteo de hallazgos deterministas agrupados por severidad.',
    kind: 'bar',
    data: Object.entries(evidenceBase.severityCounts).map(([severity, count]) => ({ severity, count })),
    xKey: 'severity',
    yKey: 'count',
    source: 'audit_report',
  },
  {
    id: 'category_counts',
    title: 'Hallazgos por categoria',
    description: 'Conteo de hallazgos deterministas agrupados por categoria.',
    kind: 'horizontal_bar',
    data: Object.entries(evidenceBase.categoryCounts).map(([category, count]) => ({ category, count })),
    xKey: 'count',
    yKey: 'category',
    source: 'audit_report',
  },
  {
    id: 'column_type_counts',
    title: 'Columnas por tipo inferido',
    description: 'Distribucion de tipos inferidos desde el perfil tecnico base.',
    kind: 'pie',
    data: Object.entries(evidenceBase.columnTypeCounts).map(([type, count]) => ({ type, count })),
    xKey: 'type',
    yKey: 'count',
    source: 'column_stats',
  },
  {
    id: 'top_null_columns',
    title: 'Columnas con mas nulos',
    description: 'Columnas ordenadas por porcentaje de nulos.',
    kind: 'horizontal_bar',
    data: evidenceBase.topNullColumns.slice(0, TOP_CHART_ROWS_LIMIT).map((column) => ({
      column: column.column,
      nullCount: column.nullCount,
      nullPercentage: column.nullPercentage,
    })),
    xKey: 'nullPercentage',
    yKey: 'column',
    valueSuffix: '%',
    source: 'column_stats',
  },
  {
    id: 'top_affected_issues',
    title: 'Hallazgos con mayor afectacion',
    description: 'Hallazgos ordenados por severidad y porcentaje afectado.',
    kind: 'table',
    data: evidenceBase.topIssues.slice(0, TOP_CHART_ROWS_LIMIT).map((issue) => ({
      id: issue.id,
      ruleName: issue.ruleName,
      severity: issue.severity,
      affectedPercentage: issue.affectedPercentage,
      column: issue.column ?? null,
    })),
    xKey: 'ruleName',
    yKey: 'affectedPercentage',
    valueSuffix: '%',
    source: 'audit_report',
  },
  {
    id: 'top_cardinality_columns',
    title: 'Columnas con mayor cardinalidad',
    description: 'Columnas ordenadas por porcentaje de valores unicos.',
    kind: 'horizontal_bar',
    data: evidenceBase.topCardinalityColumns.slice(0, TOP_CHART_ROWS_LIMIT).map((column) => ({
      column: column.column,
      uniqueCount: column.uniqueCount,
      uniquePercentage: column.uniquePercentage,
    })),
    xKey: 'uniquePercentage',
    yKey: 'column',
    valueSuffix: '%',
    source: 'column_stats',
  },
];

const getDiagnosticStatus = (
  structuredDiagnosis: DiagnosisExecutionResult | null,
  aiAnalysis: string,
): DiagnosticStatus => {
  if (structuredDiagnosis || aiAnalysis.trim().length > 0) {
    return 'llm_diagnosis_available';
  }
  return 'deterministic_only';
};

const sortIssues = (issues: QualityIssue[]) =>
  [...issues].sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    b.affectedPercentage - a.affectedPercentage ||
    b.count - a.count ||
    a.id.localeCompare(b.id),
  );

const toIssueSummary = (issue: QualityIssue): DiagnosticIssueSummary => ({
  id: issue.id,
  ruleId: issue.ruleId,
  ruleName: issue.ruleName,
  severity: issue.severity,
  category: issue.category,
  ...(issue.column ? { column: issue.column } : {}),
  count: issue.count,
  affectedPercentage: round2(issue.affectedPercentage),
  description: truncateText(issue.description, 360),
});

const toNullColumnSummary = (column: ColumnStats, rowCount: number): DiagnosticNullColumnSummary => ({
  column: column.name,
  nullCount: column.nullCount,
  nullPercentage: round2(percentage(column.nullCount, rowCount)),
  inferredType: column.inferredType,
  ...(column.semanticType ? { semanticType: column.semanticType } : {}),
});

const toCardinalityColumnSummary = (column: ColumnStats, rowCount: number): DiagnosticCardinalityColumnSummary => ({
  column: column.name,
  uniqueCount: column.uniqueCount,
  uniquePercentage: round2(percentage(column.uniqueCount, rowCount)),
  inferredType: column.inferredType,
  ...(column.semanticType ? { semanticType: column.semanticType } : {}),
});

const toOutlierColumnSummary = (column: ColumnStats, rowCount: number): DiagnosticOutlierColumnSummary | null => {
  const outlierCount = column.outlierCount ?? column.outlierCountTukey ?? 0;
  if (column.inferredType !== 'number' || outlierCount <= 0) return null;
  return {
    column: column.name,
    outlierCount,
    outlierPercentage: round2(percentage(outlierCount, rowCount)),
    ...(column.outlierSeverity ? { outlierSeverity: column.outlierSeverity } : {}),
    ...(typeof column.lowerFence === 'number' ? { lowerFence: column.lowerFence } : {}),
    ...(typeof column.upperFence === 'number' ? { upperFence: column.upperFence } : {}),
  };
};

const issueToFinding = (issue: QualityIssue, structuredReviewIssueIds: Set<string>): DiagnosticFinding => {
  const canGenerateScript = isScriptableIssue(issue);
  const requiresHumanReview =
    issue.severity === IssueSeverity.CRITICAL ||
    issue.category === IssueCategory.SEMANTIC ||
    issue.automaticAuthorization?.authorized === false ||
    structuredReviewIssueIds.has(issue.id);

  return {
    id: `finding-${slugify(issue.id)}`,
    title: `${issue.ruleName}${issue.column ? ` en ${issue.column}` : ''}`,
    severity: issue.severity,
    category: issue.category,
    sourceIssueIds: [issue.id],
    columns: issue.column ? [issue.column] : [],
    evidenceSummary: `${issue.count} registro(s), ${round2(issue.affectedPercentage)}% afectado. ${truncateText(issue.description, 220)}`,
    contextualInterpretation: 'Riesgo observado por regla determinista. El diagnostico asistido puede contextualizarlo, pero no modifica score.',
    confidence: issue.severity === IssueSeverity.CRITICAL ? 'high' : issue.severity === IssueSeverity.WARNING ? 'medium' : 'low',
    scoreModified: false,
    requiresHumanReview,
    canGenerateScript,
  };
};

const falsePositiveFinding = (finding: Omit<DiagnosticFinding, 'confidence' | 'scoreModified' | 'requiresHumanReview' | 'canGenerateScript'>): DiagnosticFinding => ({
  ...finding,
  confidence: 'low',
  scoreModified: false,
  requiresHumanReview: true,
  canGenerateScript: false,
});

const splitLegacyObservations = (legacyText: string): DiagnosticObservation[] => {
  const clean = cleanDiagnosticText(legacyText);
  if (!clean) return [];
  return splitDiagnosticSentences(clean, 8)
    .filter(Boolean)
    .slice(0, 6)
    .map((sentence, index) => ({
      id: `legacy-observation-${index + 1}`,
      title: `Observacion legacy ${index + 1}`,
      text: truncatePresentationText(sentence, 320),
      requiresHumanReview: true,
    }));
};

const buildStructuredExecutiveSummary = (
  report: AuditReport,
  observations: DiagnosticObservation[],
) => {
  const lead = `Diagnostico estructurado construido sobre ${report.issues.length} hallazgo(s) determinista(s), score base ${report.score}/100.`;
  if (observations.length === 0) return lead;
  return `${lead} Observacion principal: ${observations[0].text}`;
};

const isScriptableIssue = (issue: QualityIssue) =>
  SCRIPTABLE_RULE_IDS.has(issue.ruleId) && issue.automaticAuthorization?.authorized !== false;

const isNullIssue = (issue: QualityIssue) =>
  issue.ruleId === 'rule:null-values' || /nul|missing|ausencia/i.test(issue.ruleName + issue.description);

const isOutlierIssue = (issue: QualityIssue) =>
  issue.ruleId === 'rule:mild-outliers' ||
  issue.ruleId === 'rule:extreme-outliers' ||
  /outlier|atipic|extrem/i.test(issue.ruleName + issue.description);

const countIssuesBy = (
  issues: QualityIssue[],
  getKey: (issue: QualityIssue) => string,
) => issues.reduce<Record<string, number>>((counts, issue) => {
  const key = getKey(issue);
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const countColumnsBy = (
  columns: ColumnStats[],
  getKey: (column: ColumnStats) => string,
) => columns.reduce<Record<string, number>>((counts, column) => {
  const key = getKey(column);
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const dedupeFindings = (findings: DiagnosticFinding[]) => {
  const seen = new Set<string>();
  const result: DiagnosticFinding[] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    result.push(finding);
  }
  return result;
};

const firstCategory = (issues: QualityIssue[], fallback: IssueCategory) =>
  issues[0]?.category ?? fallback;

const firstSeverity = (issues: QualityIssue[], fallback: IssueSeverity) =>
  issues[0]?.severity ?? fallback;

const percentage = (value: number, total: number) =>
  total <= 0 ? 0 : (value / total) * 100;

const round2 = (value: number) => Math.round(value * 100) / 100;

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const slugify = (value: string) =>
  normalizeName(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';

const isMoneyLike = (name: string) =>
  /\b(money|fare|fee|tarifa|costo|cost|precio|price|amount|monto|valor|revenue|income|salary)\b/.test(name);

const isIdentifierName = (name: string) =>
  /\b(id|identifier|identificador|uuid|codigo|code|ticket|passengerid|passenger_id|key|folio|serial)\b/.test(name);

const isDescriptorName = (name: string) =>
  /\b(name|nombre|descriptor|description|descripcion|ticket|code|codigo)\b/.test(name);

const allowsNegativeValues = (name: string) =>
  /\b(delta|diff|difference|balance|power|current|flow|potencia|corriente|flujo|saldo)\b/.test(name);

const stableHash = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
