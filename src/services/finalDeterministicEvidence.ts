import type { AuditReport, DeterministicGroundTruth, PerRuleMetrics, QualityIssue } from '../types';
import {
  computePerRuleMetrics,
  SYNTHETIC_GROUND_TRUTH,
  TITANIC_GROUND_TRUTH,
} from './deterministicValidation';

export interface Phase8DiagnosticFinding {
  key: string;
  canonicalRuleId: string;
  columnId: string | null;
  scope: 'column' | 'dataset';
  classification: 'deterministic_expected' | 'cognitive_expected' | 'human_review_expected';
  reachability: 'engine_exposed' | 'engine_supported_not_exposed' | 'out_of_engine_scope';
  sourceIssueIds: string[];
}

export interface Phase8DiagnosticOracle {
  oracleId: string;
  version: string;
  findings: Phase8DiagnosticFinding[];
}

export interface CsvParseWarning {
  type: string;
  code: string;
  row?: number;
  message: string;
}

interface DatasetAuditInput {
  relativePath: string;
  sha256: string;
  report: AuditReport;
  parseWarnings: CsvParseWarning[];
}

interface Phase8AuditInput extends DatasetAuditInput {
  oracle: Phase8DiagnosticOracle;
}

export interface FinalDeterministicEvidenceInput {
  generatedAt: string;
  engineCommit: string;
  datasets: {
    synthetic: DatasetAuditInput;
    titanic: DatasetAuditInput;
    phase8: Phase8AuditInput;
  };
}

export type PrecisionKind =
  | 'scoped_with_explicit_negatives'
  | 'conditional_no_negative_labels';

export interface BinaryRuleMetrics {
  unit: 'rule_activation';
  evaluatedRules: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  precisionKind: PrecisionKind;
}

export interface OccurrenceCounts {
  unit: 'issue_occurrences_not_unique_rows';
  expectedPositiveOccurrences: number;
  detectedOccurrencesOnExpectedKeys: number;
  knownFalsePositiveOccurrences: number;
  exactRowMatchingAvailable: false;
}

export interface FinalRuleEvidence {
  ruleKey: string;
  ruleName: string;
  expectedOccurrences: number;
  detectedOccurrences: number;
  tp: number;
  fp: number;
  fn: number;
  status: PerRuleMetrics['status'];
  reachability?: Phase8DiagnosticFinding['reachability'];
}

export interface AdditionalDetection {
  ruleId: string;
  ruleName: string;
  column: string | null;
  detectedOccurrences: number;
}

export interface FinalDeterministicDatasetEvidence {
  id: 'synthetic_ground_truth' | 'titanic' | 'controlled_customers_phase8';
  relativePath: string;
  sha256: string;
  rows: number;
  columns: number;
  auraScore: number;
  parseWarnings: CsvParseWarning[];
  groundTruthScope: string;
  binaryRuleMetrics: BinaryRuleMetrics;
  occurrenceCounts: OccurrenceCounts;
  perRule: FinalRuleEvidence[];
  additionalDetections: AdditionalDetection[];
  limitations: string[];
}

export interface FinalDeterministicEvidence {
  schemaVersion: '1.0.0';
  evidenceId: 'aura.final-deterministic-evidence.v1';
  supersedes: ['experiments/results/deterministic_validation.json'];
  generatedAt: string;
  engineCommit: string;
  methodology: {
    primaryUnit: 'binary_rule_activation';
    occurrenceUnit: 'issue_occurrences_not_unique_rows';
    unannotatedDetections: 'reported_unscored';
    formulas: {
      precision: 'TP / (TP + FP)';
      recall: 'TP / (TP + FN)';
      f1: '2 * precision * recall / (precision + recall)';
    };
  };
  datasets: FinalDeterministicDatasetEvidence[];
  limitations: string[];
}

const safeRatio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 1;

const binaryMetrics = (
  evaluatedRules: number,
  tp: number,
  fp: number,
  fn: number,
  precisionKind: PrecisionKind,
): BinaryRuleMetrics => {
  const precision = safeRatio(tp, tp + fp);
  const recall = safeRatio(tp, tp + fn);
  const f1 = precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;
  return {
    unit: 'rule_activation',
    evaluatedRules,
    tp,
    fp,
    fn,
    precision,
    recall,
    f1,
    precisionKind,
  };
};

const toAdditionalDetection = (metric: PerRuleMetrics): AdditionalDetection => ({
  ruleId: metric.ruleId,
  ruleName: metric.ruleName,
  column: null,
  detectedOccurrences: metric.actualDetected,
});

const buildKnownDatasetEvidence = (
  id: 'synthetic_ground_truth' | 'titanic',
  input: DatasetAuditInput,
  groundTruth: DeterministicGroundTruth,
  groundTruthScope: string,
  precisionKind: PrecisionKind,
  limitations: string[],
): FinalDeterministicDatasetEvidence => {
  const allMetrics = computePerRuleMetrics(input.report, groundTruth);
  const scoredMetrics = allMetrics.filter((metric) => metric.status !== 'unexpected_fp');
  const additionalDetections = allMetrics
    .filter((metric) => metric.status === 'unexpected_fp')
    .map(toAdditionalDetection)
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const groundTruthByPrefix = new Map(
    groundTruth.rulesExpected.map((rule) => [rule.ruleIdPrefix, rule]),
  );

  const tp = scoredMetrics.reduce((total, metric) => total + metric.tp, 0);
  const fp = scoredMetrics.reduce((total, metric) => total + metric.fp, 0);
  const fn = scoredMetrics.reduce((total, metric) => total + metric.fn, 0);

  return {
    id,
    relativePath: input.relativePath,
    sha256: input.sha256,
    rows: input.report.rowCount,
    columns: input.report.colCount,
    auraScore: input.report.score,
    parseWarnings: input.parseWarnings,
    groundTruthScope,
    binaryRuleMetrics: binaryMetrics(scoredMetrics.length, tp, fp, fn, precisionKind),
    occurrenceCounts: {
      unit: 'issue_occurrences_not_unique_rows',
      expectedPositiveOccurrences: groundTruth.rulesExpected.reduce(
        (total, rule) => total + rule.expectedTP,
        0,
      ),
      detectedOccurrencesOnExpectedKeys: scoredMetrics
        .filter((metric) => (groundTruthByPrefix.get(metric.ruleId)?.expectedTP ?? 0) > 0)
        .reduce((total, metric) => total + metric.actualDetected, 0),
      knownFalsePositiveOccurrences: scoredMetrics
        .filter((metric) => (groundTruthByPrefix.get(metric.ruleId)?.expectedFP ?? 0) > 0)
        .reduce((total, metric) => total + metric.actualDetected, 0),
      exactRowMatchingAvailable: false,
    },
    perRule: scoredMetrics.map((metric) => ({
      ruleKey: metric.ruleId,
      ruleName: metric.ruleName,
      expectedOccurrences: groundTruthByPrefix.get(metric.ruleId)?.expectedTP ?? 0,
      detectedOccurrences: metric.actualDetected,
      tp: metric.tp,
      fp: metric.fp,
      fn: metric.fn,
      status: metric.status,
    })),
    additionalDetections,
    limitations,
  };
};

export const canonicalizePhase8Issue = (issue: QualityIssue): string | null => {
  const column = issue.column;
  if (!column) return null;

  const mappings: Array<[string, string]> = [
    ['integrity-null-', 'rule:null-values'],
    ['hygiene-ghost-', 'rule:trim-whitespace'],
    ['hygiene-toxic-', 'rule:toxic-placeholders'],
    ['hygiene-case-', 'rule:capitalization-chaos'],
    ['logic-neg-', 'rule:impossible-negatives'],
  ];
  for (const [prefix, canonicalRule] of mappings) {
    if (issue.id.startsWith(prefix)) return `${canonicalRule}|${column}|column`;
  }
  if (issue.id === 'logic-email-email') return 'rule:invalid-email|email|column';
  return null;
};

const buildPhase8Evidence = (input: Phase8AuditInput): FinalDeterministicDatasetEvidence => {
  const expectedFindings = input.oracle.findings.filter(
    (finding) => finding.classification === 'deterministic_expected',
  );
  const expectedKeys = new Set(expectedFindings.map((finding) => finding.key));
  const detectedByKey = new Map<string, number>();

  for (const issue of input.report.issues) {
    const key = canonicalizePhase8Issue(issue);
    if (key) detectedByKey.set(key, (detectedByKey.get(key) ?? 0) + issue.count);
  }

  const perRule: FinalRuleEvidence[] = expectedFindings.map((finding) => {
    const detectedOccurrences = detectedByKey.get(finding.key) ?? 0;
    const detected = detectedOccurrences > 0;
    return {
      ruleKey: finding.key,
      ruleName: finding.canonicalRuleId,
      expectedOccurrences: finding.sourceIssueIds.length,
      detectedOccurrences,
      tp: detected ? 1 : 0,
      fp: 0,
      fn: detected ? 0 : 1,
      status: detected ? 'match' : 'missed',
      reachability: finding.reachability,
    };
  });
  const tp = perRule.reduce((total, rule) => total + rule.tp, 0);
  const fn = perRule.reduce((total, rule) => total + rule.fn, 0);
  const additionalDetections = input.report.issues
    .filter((issue) => {
      const key = canonicalizePhase8Issue(issue);
      return !key || !expectedKeys.has(key);
    })
    .map((issue) => ({
      ruleId: issue.id,
      ruleName: issue.ruleName,
      column: issue.column ?? null,
      detectedOccurrences: issue.count,
    }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  return {
    id: 'controlled_customers_phase8',
    relativePath: input.relativePath,
    sha256: input.sha256,
    rows: input.report.rowCount,
    columns: input.report.colCount,
    auraScore: input.report.score,
    parseWarnings: input.parseWarnings,
    groundTruthScope: `${input.oracle.oracleId}@${input.oracle.version}; 29 claves deterministas canónicas de 51 incidencias fuente`,
    binaryRuleMetrics: binaryMetrics(perRule.length, tp, 0, fn, 'conditional_no_negative_labels'),
    occurrenceCounts: {
      unit: 'issue_occurrences_not_unique_rows',
      expectedPositiveOccurrences: expectedFindings.reduce(
        (total, finding) => total + finding.sourceIssueIds.length,
        0,
      ),
      detectedOccurrencesOnExpectedKeys: perRule.reduce(
        (total, rule) => total + rule.detectedOccurrences,
        0,
      ),
      knownFalsePositiveOccurrences: 0,
      exactRowMatchingAvailable: false,
    },
    perRule,
    additionalDetections,
    limitations: [
      'El ground truth no contiene reglas negativas exhaustivas; precisión=1,00 es condicional al conjunto puntuado.',
      'Las 51 incidencias deterministas se agregan en 29 claves regla-columna; no se evalúa coincidencia exacta por fila.',
      'Las detecciones adicionales se reportan sin puntuarlas como FP porque el ground truth no es exhaustivo para reglas no declaradas.',
    ],
  };
};

export const buildFinalDeterministicEvidence = (
  input: FinalDeterministicEvidenceInput,
): FinalDeterministicEvidence => ({
  schemaVersion: '1.0.0',
  evidenceId: 'aura.final-deterministic-evidence.v1',
  supersedes: ['experiments/results/deterministic_validation.json'],
  generatedAt: input.generatedAt,
  engineCommit: input.engineCommit,
  methodology: {
    primaryUnit: 'binary_rule_activation',
    occurrenceUnit: 'issue_occurrences_not_unique_rows',
    unannotatedDetections: 'reported_unscored',
    formulas: {
      precision: 'TP / (TP + FP)',
      recall: 'TP / (TP + FN)',
      f1: '2 * precision * recall / (precision + recall)',
    },
  },
  datasets: [
    buildKnownDatasetEvidence(
      'synthetic_ground_truth',
      input.datasets.synthetic,
      SYNTHETIC_GROUND_TRUTH,
      '13 reglas predeclaradas, incluida 1 regla negativa conocida',
      'scoped_with_explicit_negatives',
      ['La evaluación es binaria por activación; los conteos agregados no prueban coincidencia exacta por fila.'],
    ),
    buildKnownDatasetEvidence(
      'titanic',
      input.datasets.titanic,
      TITANIC_GROUND_TRUTH,
      '3 reglas positivas predeclaradas; ground truth deliberadamente parcial',
      'conditional_no_negative_labels',
      [
        'El ground truth solo cubre tres reglas positivas; precisión=1,00 es condicional y no estima falsos positivos globales.',
        'Las detecciones adicionales se reportan sin puntuarlas por falta de etiquetas negativas exhaustivas.',
      ],
    ),
    buildPhase8Evidence(input.datasets.phase8),
  ],
  limitations: [
    'Los conteos de ocurrencias pueden solaparse entre reglas y no representan filas únicas.',
    'Las métricas TP/FP/FN principales son binarias por activación de regla y no deben mezclarse con conteos de ocurrencias.',
    'Las detecciones no anotadas se reportan como no puntuadas; ausencia en un ground truth parcial no prueba falsedad.',
    'El score de salud de AURA es descriptivo y no equivale a precisión, recall ni F1.',
  ],
});

const percentage = (value: number): string => `${(value * 100).toFixed(2)}%`;

export const renderFinalDeterministicEvidenceMarkdown = (
  evidence: FinalDeterministicEvidence,
): string => {
  const lines = [
    '# Evidencia determinista final de AURA',
    '',
    `- Evidencia: \`${evidence.evidenceId}\``,
    `- Generada: ${evidence.generatedAt}`,
    `- Commit del motor: \`${evidence.engineCommit}\``,
    `- Sustituye: \`${evidence.supersedes[0]}\``,
    '- Unidad primaria: activación binaria de regla',
    '- Detecciones no anotadas: reportadas aparte, sin puntuación',
    '',
    '## Resultados comparables',
    '',
    '| Dataset | Filas | Score AURA | Reglas | TP | FP | FN | Precisión | Recall | F1 | Adicionales no puntuadas |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...evidence.datasets.map((dataset) => [
      `| ${dataset.id}`,
      dataset.rows,
      dataset.auraScore,
      dataset.binaryRuleMetrics.evaluatedRules,
      dataset.binaryRuleMetrics.tp,
      dataset.binaryRuleMetrics.fp,
      dataset.binaryRuleMetrics.fn,
      percentage(dataset.binaryRuleMetrics.precision),
      percentage(dataset.binaryRuleMetrics.recall),
      percentage(dataset.binaryRuleMetrics.f1),
      `${dataset.additionalDetections.length} |`,
    ].join(' | ')),
    '',
    '> Precisión `conditional_no_negative_labels` significa que no existen etiquetas negativas exhaustivas; no debe presentarse como precisión global del motor.',
    '',
    '## Reproducción byte a byte',
    '',
    '```bash',
    'cd /Users/casabero/Documents/GitHub/aura/src',
    `AURA_EVIDENCE_COMMIT=${evidence.engineCommit} AURA_EVIDENCE_GENERATED_AT=${evidence.generatedAt} npm run evidence:deterministic`,
    '```',
    '',
  ];

  for (const dataset of evidence.datasets) {
    const missed = dataset.perRule.filter((rule) => rule.fn > 0);
    lines.push(
      `## ${dataset.id}`,
      '',
      `- Archivo: \`${dataset.relativePath}\``,
      `- SHA-256: \`${dataset.sha256}\``,
      `- Alcance del ground truth: ${dataset.groundTruthScope}`,
      `- Interpretación de precisión: \`${dataset.binaryRuleMetrics.precisionKind}\``,
      `- Advertencias de parseo CSV: ${dataset.parseWarnings.length}`,
      `- Ocurrencias positivas esperadas: ${dataset.occurrenceCounts.expectedPositiveOccurrences}`,
      `- Ocurrencias detectadas sobre claves esperadas: ${dataset.occurrenceCounts.detectedOccurrencesOnExpectedKeys}`,
      `- Ocurrencias de FP conocidos: ${dataset.occurrenceCounts.knownFalsePositiveOccurrences}`,
      `- Reglas omitidas: ${missed.length > 0 ? missed.map((rule) => `\`${rule.ruleKey}\``).join(', ') : 'ninguna'}`,
      '',
      'Limitaciones:',
      '',
      ...dataset.limitations.map((limitation) => `- ${limitation}`),
      '',
    );
  }

  lines.push(
    '## Interpretación para el TFM',
    '',
    '- El fixture sintético permite medir activaciones esperadas y un falso positivo conocido dentro de un alcance cerrado.',
    '- Titanic confirma tres detecciones positivas, pero su ground truth parcial no permite estimar precisión global.',
    '- Phase 8 mide cobertura determinista sobre 29 claves canónicas: las capacidades cognitivas y HITL quedan fuera de este F1.',
    '- Ninguna cifra histórica debe reemplazar estos resultados sin regenerar este artefacto.',
    `- El archivo \`${evidence.supersedes[0]}\` queda como histórico y no debe citarse como resultado actual.`,
    '',
    '## Limitaciones generales',
    '',
    ...evidence.limitations.map((limitation) => `- ${limitation}`),
    '',
  );

  return lines.join('\n');
};
