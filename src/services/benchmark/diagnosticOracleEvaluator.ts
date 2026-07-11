import type { OE4InputMode } from './finalEvaluationProtocol';

export interface FindingSetMetrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export type DiagnosticReachability =
  | 'engine_exposed'
  | 'engine_supported_not_exposed'
  | 'out_of_engine_scope';

export interface DiagnosticOracleFindingV1 {
  key: string;
  canonicalRuleId: string;
  columnId: string | null;
  scope: 'column' | 'dataset';
  reachability: DiagnosticReachability;
  primaryEligible: boolean;
  visibleEvidenceModes: OE4InputMode[];
  sourceIssueIds: string[];
}

export interface DiagnosticOracleV1 {
  coverage: {
    totalSourceIssues: number;
  };
  findings: DiagnosticOracleFindingV1[];
}

export interface PredictedDiagnosticFinding {
  ruleId: string;
  columnId: string | null;
  scope: 'column' | 'dataset';
  issueId?: string | null;
  evidenceRefs?: readonly string[];
  badSampleRefs?: readonly string[];
}

export interface DiagnosticOracleEvaluationInput {
  oracle: DiagnosticOracleV1;
  inputMode: OE4InputMode;
  knownColumns: readonly string[];
  predictions: readonly PredictedDiagnosticFinding[];
  contractCompliant: boolean;
  contractErrors?: readonly string[];
  unsupportedClaims?: readonly string[];
}

export interface DiagnosticOracleEvaluation {
  engineCoverage: number;
  primary: FindingSetMetrics;
  evidenceFidelity: number | null;
  extendedDiscoveryKeys: string[];
  contract: {
    compliant: boolean;
    errors: string[];
  };
  anchoring: {
    score: number;
    earnedAnchors: number;
    possibleAnchors: number;
  };
  hallucinations: {
    inventedColumns: string[];
    inventedRuleIds: string[];
    unknownFindingKeys: string[];
    unsupportedClaims: string[];
    total: number;
  };
}

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right));

const ratio = (numerator: number, denominator: number, emptyValue: number): number =>
  denominator === 0 ? emptyValue : numerator / denominator;

export const evaluateFindings = (
  expectedKeys: readonly string[],
  predictedKeys: readonly string[],
): FindingSetMetrics => {
  const expected = new Set(uniqueSorted(expectedKeys));
  const predicted = new Set(uniqueSorted(predictedKeys));
  const tp = [...predicted].filter((key) => expected.has(key)).length;
  const fp = predicted.size - tp;
  const fn = expected.size - tp;
  const bothEmpty = expected.size === 0 && predicted.size === 0;
  const precision = ratio(tp, predicted.size, bothEmpty ? 1 : 0);
  const recall = ratio(tp, expected.size, 1);
  const f1 = precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);

  return { tp, fp, fn, precision, recall, f1 };
};

export const diagnosticFindingKey = (
  finding: Pick<PredictedDiagnosticFinding, 'ruleId' | 'columnId' | 'scope'>,
): string => `${finding.ruleId}|${finding.columnId ?? ''}|${finding.scope}`;

const columnParts = (columnId: string | null): string[] =>
  columnId === null
    ? []
    : columnId.split(',').map((column) => column.trim()).filter(Boolean);

const calculateEngineCoverage = (oracle: DiagnosticOracleV1): number => {
  const coveredSourceIssues = new Set(
    oracle.findings
      .filter((finding) => finding.reachability !== 'out_of_engine_scope')
      .flatMap((finding) => finding.sourceIssueIds),
  );
  return ratio(coveredSourceIssues.size, oracle.coverage.totalSourceIssues, 0);
};

export const evaluateDiagnosticOracle = (
  input: DiagnosticOracleEvaluationInput,
): DiagnosticOracleEvaluation => {
  const oracleByKey = new Map(input.oracle.findings.map((finding) => [finding.key, finding]));
  const primaryKeys = input.oracle.findings
    .filter((finding) => finding.primaryEligible)
    .map((finding) => finding.key);
  const primaryKeySet = new Set(primaryKeys);
  const knownRuleIds = new Set(input.oracle.findings.map((finding) => finding.canonicalRuleId));
  const knownColumns = new Set(input.knownColumns);
  const predictionKeys = input.predictions.map(diagnosticFindingKey);

  const extendedDiscoveryKeys = uniqueSorted(predictionKeys.filter((key) => {
    const oracleFinding = oracleByKey.get(key);
    return oracleFinding !== undefined && !oracleFinding.primaryEligible;
  }));
  const unknownFindingKeys = uniqueSorted(predictionKeys.filter((key) => !oracleByKey.has(key)));
  const primaryPredictions = predictionKeys.filter((key) => primaryKeySet.has(key));
  const primary = evaluateFindings(primaryKeys, [...primaryPredictions, ...unknownFindingKeys]);

  const visibleEvidenceKeys = new Set(
    input.oracle.findings
      .filter((finding) => finding.visibleEvidenceModes.includes(input.inputMode))
      .map((finding) => finding.key),
  );
  const evidenceAnchoredKeys = new Set(
    input.predictions
      .filter((prediction) => (prediction.evidenceRefs?.length ?? 0) > 0)
      .map(diagnosticFindingKey)
      .filter((key) => visibleEvidenceKeys.has(key)),
  );
  const evidenceFidelity = visibleEvidenceKeys.size === 0
    ? null
    : evidenceAnchoredKeys.size / visibleEvidenceKeys.size;

  const inventedColumns = uniqueSorted(input.predictions.flatMap((prediction) =>
    columnParts(prediction.columnId).filter((column) => !knownColumns.has(column))));
  const inventedRuleIds = uniqueSorted(input.predictions
    .map((prediction) => prediction.ruleId)
    .filter((ruleId) => !knownRuleIds.has(ruleId)));
  const unsupportedClaims = uniqueSorted(input.unsupportedClaims ?? []);

  let earnedAnchors = 0;
  let possibleAnchors = 0;
  for (const prediction of input.predictions) {
    const key = diagnosticFindingKey(prediction);
    const oracleFinding = oracleByKey.get(key);
    const predictionColumns = columnParts(prediction.columnId);
    const columnValid = prediction.scope === 'dataset'
      ? predictionColumns.every((column) => knownColumns.has(column))
      : predictionColumns.length === 1 && predictionColumns.every((column) => knownColumns.has(column));

    possibleAnchors += 3;
    if (prediction.issueId?.trim()) earnedAnchors += 1;
    if (oracleFinding?.canonicalRuleId === prediction.ruleId) earnedAnchors += 1;
    if (oracleFinding !== undefined && columnValid) earnedAnchors += 1;

    if (input.inputMode !== 'prompt_libre') {
      possibleAnchors += 1;
      if ((prediction.evidenceRefs?.length ?? 0) > 0) earnedAnchors += 1;
    }
    if (input.inputMode === 'recommended') {
      possibleAnchors += 1;
      if ((prediction.badSampleRefs?.length ?? 0) > 0) earnedAnchors += 1;
    }
  }

  const hallucinationTotal = inventedColumns.length
    + inventedRuleIds.length
    + unknownFindingKeys.length
    + unsupportedClaims.length;

  return {
    engineCoverage: calculateEngineCoverage(input.oracle),
    primary,
    evidenceFidelity,
    extendedDiscoveryKeys,
    contract: {
      compliant: input.contractCompliant,
      errors: uniqueSorted(input.contractErrors ?? []),
    },
    anchoring: {
      score: ratio(earnedAnchors, possibleAnchors, 0),
      earnedAnchors,
      possibleAnchors,
    },
    hallucinations: {
      inventedColumns,
      inventedRuleIds,
      unknownFindingKeys,
      unsupportedClaims,
      total: hallucinationTotal,
    },
  };
};
