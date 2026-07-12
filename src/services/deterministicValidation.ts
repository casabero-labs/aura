import {
  AuditReport,
  DeterministicGroundTruth,
  DeterministicValidationReport,
  IssueCategory,
  PerRuleMetrics,
  RuleGroundTruth,
} from '../types';

// ─── Ground Truth Fixtures ───

export const SYNTHETIC_GROUND_TRUTH: DeterministicGroundTruth = {
  datasetName: 'synthetic_ground_truth.csv',
  totalRows: 15,
  matchFieldSet: ['id', 'nombre', 'edad', 'salario', 'email', 'departamento', 'fecha_ingreso', 'estado', 'ip_acceso'],
  rulesExpected: [
    {
      ruleIdPrefix: 'integrity-dupes',
      ruleName: 'R01 — Filas Duplicadas',
      category: IssueCategory.INTEGRITY,
      expectedTP: 1,
      expectedFP: 0,
      description: 'Fila 5 es duplicado exacto de Fila 1',
    },
    {
      ruleIdPrefix: 'integrity-null-nombre',
      ruleName: 'R02 — Valores Nulos (nombre)',
      category: IssueCategory.INTEGRITY,
      expectedTP: 1,
      expectedFP: 0,
      column: 'nombre',
      description: 'Fila 7 no tiene nombre (campo vacío)',
    },
    {
      ruleIdPrefix: 'integrity-null-edad',
      ruleName: 'R02 — Valores Nulos (edad)',
      category: IssueCategory.INTEGRITY,
      expectedTP: 1,
      expectedFP: 0,
      column: 'edad',
      description: 'Fila 11: edad = N/A detectado como nulo',
    },
    {
      ruleIdPrefix: 'integrity-null-email',
      ruleName: 'R02 — Valores Nulos (email)',
      category: IssueCategory.INTEGRITY,
      expectedTP: 1,
      expectedFP: 0,
      column: 'email',
      description: 'Fila 12: email = NULL detectado como nulo',
    },
    {
      ruleIdPrefix: 'integrity-null-estado',
      ruleName: 'R02 — Valores Nulos (estado)',
      category: IssueCategory.INTEGRITY,
      expectedTP: 1,
      expectedFP: 0,
      column: 'estado',
      description: 'Fila 13: estado = N/A detectado como nulo',
    },
    {
      ruleIdPrefix: 'hygiene-moji-nombre',
      ruleName: 'R06 — Mojibake / Encoding Roto',
      category: IssueCategory.HYGIENE,
      expectedTP: 1,
      expectedFP: 0,
      column: 'nombre',
      description: 'Fila 6: Luis GarcÃ­a',
    },
    {
      ruleIdPrefix: 'hygiene-toxic-',
      ruleName: 'R08 — Placeholders Tóxicos',
      category: IssueCategory.HYGIENE,
      expectedTP: 3,
      expectedFP: 0,
      description: 'Fila 11 (edad: N/A), Fila 12 (email: NULL), Fila 13 (estado: N/A) — 3 instancias en 3 columnas',
    },
    {
      ruleIdPrefix: 'logic-neg-salario',
      ruleName: 'R14 — Negativos Imposibles',
      category: IssueCategory.LOGIC,
      expectedTP: 1,
      expectedFP: 0,
      column: 'salario',
      description: 'Fila 3: salario = -1500',
    },
    {
      ruleIdPrefix: 'logic-outlier-',
      ruleName: 'R15 — Outliers Extremos (IQR 3×)',
      category: IssueCategory.LOGIC,
      expectedTP: 3,
      expectedFP: 0,
      description: 'Fila 8 (edad 150) + Fila 9 (salario 9999999.99 con 2 outliers) = 3 instancias detectadas',
    },
    {
      ruleIdPrefix: 'logic-email-email',
      ruleName: 'R03 — Formato Email Inválido',
      category: IssueCategory.LOGIC,
      expectedTP: 1,
      expectedFP: 0,
      column: 'email',
      description: 'Fila 4: ana.torres@empresa sin TLD válido. NULL en fila 12 es excluido por check de toxic',
    },
    {
      ruleIdPrefix: 'logic-mixed-date-fecha_ingreso',
      ruleName: 'R12 — Formatos de Fecha Mixtos',
      category: IssueCategory.LOGIC,
      expectedTP: 1,
      expectedFP: 0,
      column: 'fecha_ingreso',
      description: 'Fila 10: MM/DD/YYYY, resto ISO. min(isoCount, dmyCount) = 1',
    },
    {
      ruleIdPrefix: 'sec-pii-ip_acceso',
      ruleName: 'R19 — Datos Sensibles (PII)',
      category: IssueCategory.SEMANTIC,
      expectedTP: 15,
      expectedFP: 0,
      column: 'ip_acceso',
      description: '15 filas contienen direcciones IPv4',
    },
  ],
};

export const TITANIC_GROUND_TRUTH: DeterministicGroundTruth = {
  datasetName: 'titanic.csv',
  totalRows: 891,
  matchFieldSet: ['PassengerId', 'Survived', 'Pclass', 'Name', 'Sex', 'Age', 'SibSp', 'Parch', 'Ticket', 'Fare', 'Cabin', 'Embarked'],
  rulesExpected: [
    {
      ruleIdPrefix: 'integrity-null-Age',
      ruleName: 'R02 — Valores Nulos (Age)',
      category: IssueCategory.INTEGRITY,
      expectedTP: 177,
      expectedFP: 0,
      column: 'Age',
      description: '177 valores nulos en Age',
    },
    {
      ruleIdPrefix: 'integrity-null-Cabin',
      ruleName: 'R02 — Valores Nulos (Cabin)',
      category: IssueCategory.INTEGRITY,
      expectedTP: 687,
      expectedFP: 0,
      column: 'Cabin',
      description: '687 valores nulos en Cabin',
    },
    {
      ruleIdPrefix: 'logic-outlier-tukey-Fare',
      ruleName: 'RTukey — Outliers Leves (Fare)',
      category: IssueCategory.LOGIC,
      expectedTP: 63,
      expectedFP: 0,
      column: 'Fare',
      description: 'Fare tiene outliers leves según Tukey 1.5× IQR',
    },
  ],
};

const KNOWN_GROUND_TRUTHS: DeterministicGroundTruth[] = [
  SYNTHETIC_GROUND_TRUTH,
  TITANIC_GROUND_TRUTH,
];

// ─── Matching ───

export const matchGroundTruth = (fields: string[]): DeterministicGroundTruth | null => {
  const fieldSet = new Set(fields);
  for (const gt of KNOWN_GROUND_TRUTHS) {
    const matches = gt.matchFieldSet.filter((f) => fieldSet.has(f)).length;
    const ratio = matches / gt.matchFieldSet.length;
    if (ratio >= 0.8) return gt;
  }
  return null;
};

// ─── Per-Rule Metrics Calculation ───

export const computePerRuleMetrics = (
  report: AuditReport,
  groundTruth: DeterministicGroundTruth
): PerRuleMetrics[] => {
  const metrics: PerRuleMetrics[] = [];
  const matchedRulePrefixes = new Set<string>();

  for (const gtRule of groundTruth.rulesExpected) {
    let actualDetected = 0;

    for (const issue of report.issues) {
      if (issue.id.startsWith(gtRule.ruleIdPrefix)) {
        if (!gtRule.column || issue.column === gtRule.column) {
          actualDetected += issue.count;
        }
      }
    }

    // Binary detection: did the rule fire? (1) or not? (0)
    const detected = actualDetected > 0 ? 1 : 0;
    const expected = gtRule.expectedTP > 0 ? 1 : 0;

    const tp = (detected === 1 && expected === 1) ? 1 : 0;
    const fn = (detected === 0 && expected === 1) ? 1 : 0;
    const fp = (detected === 1 && expected === 0) ? 1 : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    let status: PerRuleMetrics['status'];
    if (gtRule.expectedFP > 0 && fp === 1 && tp === 0) {
      status = 'expected_fp';
    } else if (tp === 1 && fp === 0 && fn === 0) {
      status = 'match';
    } else if (tp === 0 && fn === 1) {
      status = 'missed';
    } else if (tp === 0 && fp === 1) {
      status = 'unexpected_fp';
    } else {
      status = 'partial';
    }

    matchedRulePrefixes.add(gtRule.ruleIdPrefix);

    metrics.push({
      ruleId: gtRule.ruleIdPrefix,
      ruleName: gtRule.ruleName,
      category: gtRule.category,
      tp, fp, fn, precision, recall, f1,
      expectedTP: gtRule.expectedTP,
      actualDetected,
      status,
    });
  }

  // Detect unexpected FPs (rules fired that were NOT expected)
  for (const issue of report.issues) {
    const alreadyMatched = [...matchedRulePrefixes].some((prefix) => issue.id.startsWith(prefix));
    if (!alreadyMatched) {
      // Only report if it's not a trivial info-level issue
      const actualDetected = issue.count;
      metrics.push({
        ruleId: issue.id,
        ruleName: issue.ruleName,
        category: issue.category,
        // PerRuleMetrics is binary. The number of affected occurrences remains
        // available in actualDetected and must never be mixed into binary FP.
        tp: 0, fp: 1, fn: 0,
        precision: 0, recall: 1, f1: 0,
        expectedTP: 0,
        actualDetected,
        status: 'unexpected_fp',
      });
    }
  }

  return metrics;
};

export const buildDeterministicValidationReport = (
  report: AuditReport,
  groundTruth: DeterministicGroundTruth | null
): DeterministicValidationReport => {
  if (!groundTruth) {
    return {
      datasetName: 'Desconocido',
      groundTruthMatched: false,
      perRuleMetrics: [],
      summary: {
        totalTP: 0, totalFP: 0, totalFN: 0,
        macroPrecision: 0, macroRecall: 0, macroF1: 0,
        rulesMatched: 0, rulesPartial: 0, rulesMissed: 0, rulesUnexpectedFP: 0,
      },
    };
  }

  const perRuleMetrics = computePerRuleMetrics(report, groundTruth);

  const totalTP = perRuleMetrics.reduce((sum, m) => sum + m.tp, 0);
  const totalFP = perRuleMetrics.reduce((sum, m) => sum + m.fp, 0);
  const totalFN = perRuleMetrics.reduce((sum, m) => sum + m.fn, 0);

  const expectedRules = perRuleMetrics.filter((m) => m.status !== 'unexpected_fp');
  const macroPrecision = expectedRules.length > 0
    ? expectedRules.reduce((sum, m) => sum + m.precision, 0) / expectedRules.length
    : 0;
  const macroRecall = expectedRules.length > 0
    ? expectedRules.reduce((sum, m) => sum + m.recall, 0) / expectedRules.length
    : 0;
  const macroF1 = macroPrecision + macroRecall > 0
    ? (2 * macroPrecision * macroRecall) / (macroPrecision + macroRecall)
    : 0;

  return {
    datasetName: groundTruth.datasetName,
    groundTruthMatched: true,
    perRuleMetrics,
    summary: {
      totalTP, totalFP, totalFN,
      macroPrecision, macroRecall, macroF1,
      rulesMatched: perRuleMetrics.filter((m) => m.status === 'match').length,
      rulesPartial: perRuleMetrics.filter((m) => m.status === 'partial').length,
      rulesMissed: perRuleMetrics.filter((m) => m.status === 'missed').length,
      rulesUnexpectedFP: perRuleMetrics.filter((m) => m.status === 'unexpected_fp').length,
    },
  };
};

// ─── Threshold Documentation ───

export const DETERMINISTIC_THRESHOLDS = {
  nullPercentage: { critical: 20, warning: 5, description: '% nulos por columna' },
  constantColumn: { minRows: 10, description: 'Mínimo de filas para reportar columna constante' },
  outlierIQR: { extreme: 3.0, mild: 1.5, description: 'Multiplicadores IQR para outliers' },
  futureDateDays: { ahead: 30, description: 'Días futuros para considerar fecha irrealista' },
  textOverflow: { maxChars: 300, description: 'Caracteres máximos antes de reportar desbordamiento' },
  phoneVariance: { threshold: 0.1, description: '% de teléfonos con longitud distinta a la moda' },
  duplicateSeverity: { description: 'Penalización proporcional al % de duplicados (máx 15 pts)' },
  scoreAdjustment: {
    smallDataset: { rows: 100, multiplier: 1.5, description: 'Penalización extra para datasets < 100 filas' },
    largeDataset: { rows: 10000, multiplier: 0.5, description: 'Penalización reducida para datasets > 10k filas' },
  },
  severityWeights: {
    CRITICAL: 1.5, WARNING: 1.0, INFO: 0.5, GOOD: 0.0,
    description: 'Pesos de severidad para scoring compuesto',
  },
  categoryWeights: {
    INTEGRITY: 1.2, LOGIC: 1.2, TYPES: 1.0, HYGIENE: 0.8, SEMANTIC: 0.7,
    description: 'Pesos de categoría para scoring compuesto',
  },
  sampling: {
    fingerprintRows: 25, fingerprintTail: 5,
    semanticSample: 100,
    description: 'Muestreo para fingerprint y detección semántica',
  },
  capChaosExclusion: { maxPct: 0.8, description: '% de unicidad para excluir detección de caos de capitalización' },
  temporalRedundancy: { minComparable: 10, matchThreshold: 0.95, description: 'Umbral para redundancia temporal derivable' },
  catLongTail: { minRows: 30, minUnique: 20, cardinalityRatio: 0.35, topFreqCoverage: 0.6, description: 'Umbrales para cola larga categórica' },
  burnedRange: { threshold: 0.6, maxUnique: 20, description: 'Umbrales para rangos demográficos quemados' },
  semanticDuplicate: { matchThreshold: 0.95, minComparable: 10, description: 'Umbral para duplicidad semántica de columnas' },
};
