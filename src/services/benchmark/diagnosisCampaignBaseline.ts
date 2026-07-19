export interface DiagnosisCampaignRunLike {
  runId: string;
  modelId: string;
  inputMode: string;
  status: string;
  diagnosis?: {
    status?: string;
    error?: { code?: string } | null;
    validationErrors?: Array<{ code?: string }>;
    metrics?: {
      outputTokens?: number | null;
      promptTokens?: number | null;
      totalDurationMs?: number | null;
    } | null;
  } | null;
  automaticEvaluation?: {
    diagnosis?: {
      contractCompliant?: boolean;
      inventedColumns?: unknown[];
      unsupportedClaims?: unknown[];
    } | null;
  } | null;
}

export interface DiagnosisCampaignArtifactLike {
  campaign?: { campaignId?: string };
  generatedAt?: string;
  runs: DiagnosisCampaignRunLike[];
}

interface NumericSummary {
  count: number;
  min: number | null;
  median: number | null;
  mean: number | null;
  max: number | null;
}

interface RunAggregate {
  runCount: number;
  completedRuns: number;
  failedRuns: number;
  contractEvaluatedRuns: number;
  contractCompliantRuns: number;
  claimCount: number;
  outputTokens: NumericSummary;
  promptTokens: NumericSummary;
  latencyMs: NumericSummary;
}

export interface DiagnosisCampaignBaselineV1 {
  contractId: 'aura.diagnosis-campaign-baseline.v1';
  contractVersion: '1.0.0';
  campaignId: string | null;
  sourceGeneratedAt: string | null;
  totals: RunAggregate;
  byModel: Record<string, RunAggregate>;
  byModelAndInput: Record<string, RunAggregate>;
  validation: {
    failedRuns: Array<{
      runId: string;
      modelId: string;
      inputMode: string;
      firstBlockingCode: string | null;
      codes: string[];
      errorOccurrences: number;
      additionalOccurrencesAfterFirstBlocker: number;
    }>;
    runsWithCode: Record<string, number>;
    occurrencesByCode: Record<string, number>;
    firstBlockingCodes: Record<string, number>;
    totalErrorOccurrences: number;
    additionalOccurrencesAfterFirstBlocker: number;
    rootCauseClassification: 'not_inferred';
  };
  tokenComparison: {
    v2OutputTokens: NumericSummary;
    v3SimulatedOutputTokens: null;
    status: 'pending_v3_serializer';
  };
}

const numericSummary = (values: Array<number | null | undefined>): NumericSummary => {
  const sorted = values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return { count: 0, min: null, median: null, mean: null, max: null };
  const midpoint = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
  return {
    count: sorted.length,
    min: sorted[0],
    median,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    max: sorted[sorted.length - 1],
  };
};

const claimCount = (run: DiagnosisCampaignRunLike): number => {
  const evaluation = run.automaticEvaluation?.diagnosis;
  return (evaluation?.inventedColumns?.length ?? 0)
    + (evaluation?.unsupportedClaims?.length ?? 0);
};

const aggregateRuns = (runs: DiagnosisCampaignRunLike[]): RunAggregate => {
  const contractEvaluated = runs.filter(
    (run) => typeof run.automaticEvaluation?.diagnosis?.contractCompliant === 'boolean',
  );
  return {
    runCount: runs.length,
    completedRuns: runs.filter((run) => run.status === 'completed').length,
    failedRuns: runs.filter((run) => run.status !== 'completed').length,
    contractEvaluatedRuns: contractEvaluated.length,
    contractCompliantRuns: contractEvaluated.filter(
      (run) => run.automaticEvaluation?.diagnosis?.contractCompliant === true,
    ).length,
    claimCount: runs.reduce((sum, run) => sum + claimCount(run), 0),
    outputTokens: numericSummary(runs.map((run) => run.diagnosis?.metrics?.outputTokens)),
    promptTokens: numericSummary(runs.map((run) => run.diagnosis?.metrics?.promptTokens)),
    latencyMs: numericSummary(runs.map((run) => run.diagnosis?.metrics?.totalDurationMs)),
  };
};

const groupRuns = (
  runs: DiagnosisCampaignRunLike[],
  keyOf: (run: DiagnosisCampaignRunLike) => string,
): Record<string, RunAggregate> => {
  const groups = new Map<string, DiagnosisCampaignRunLike[]>();
  for (const run of runs) {
    const key = keyOf(run);
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, groupedRuns]) => [key, aggregateRuns(groupedRuns)]),
  );
};

const increment = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/**
 * Separates terminal failed runs from validation-error occurrences. This is
 * intentionally the opposite of treating every derived validator message as
 * an independent failed run.
 */
export const buildDiagnosisCampaignBaseline = (
  artifact: DiagnosisCampaignArtifactLike,
): DiagnosisCampaignBaselineV1 => {
  if (!artifact || !Array.isArray(artifact.runs)) {
    throw new Error('Campaign artifact must contain a runs array.');
  }

  const failedRuns = artifact.runs.filter((run) => run.status !== 'completed');
  const runsWithCode: Record<string, number> = {};
  const occurrencesByCode: Record<string, number> = {};
  const firstBlockingCodes: Record<string, number> = {};
  let totalErrorOccurrences = 0;
  let additionalOccurrencesAfterFirstBlocker = 0;

  const failedRunDetails = failedRuns.map((run) => {
    const validationCodes = (run.diagnosis?.validationErrors ?? [])
      .map((error) => error.code)
      .filter((code): code is string => typeof code === 'string' && code.length > 0);
    const terminalCode = run.diagnosis?.error?.code;
    const codes = [...new Set([
      ...(typeof terminalCode === 'string' ? [terminalCode] : []),
      ...validationCodes,
    ])];
    const firstBlockingCode = typeof terminalCode === 'string'
      ? terminalCode
      : validationCodes[0] ?? null;

    for (const code of codes) increment(runsWithCode, code);
    for (const code of validationCodes) increment(occurrencesByCode, code);
    if (firstBlockingCode) increment(firstBlockingCodes, firstBlockingCode);

    const errorOccurrences = validationCodes.length > 0
      ? validationCodes.length
      : firstBlockingCode ? 1 : 0;
    const additional = Math.max(0, errorOccurrences - (firstBlockingCode ? 1 : 0));
    totalErrorOccurrences += errorOccurrences;
    additionalOccurrencesAfterFirstBlocker += additional;

    return {
      runId: run.runId,
      modelId: run.modelId,
      inputMode: run.inputMode,
      firstBlockingCode,
      codes,
      errorOccurrences,
      additionalOccurrencesAfterFirstBlocker: additional,
    };
  });

  const totals = aggregateRuns(artifact.runs);
  return {
    contractId: 'aura.diagnosis-campaign-baseline.v1',
    contractVersion: '1.0.0',
    campaignId: artifact.campaign?.campaignId ?? null,
    sourceGeneratedAt: artifact.generatedAt ?? null,
    totals,
    byModel: groupRuns(artifact.runs, (run) => run.modelId),
    byModelAndInput: groupRuns(
      artifact.runs,
      (run) => `${run.modelId}::${run.inputMode}`,
    ),
    validation: {
      failedRuns: failedRunDetails,
      runsWithCode,
      occurrencesByCode,
      firstBlockingCodes,
      totalErrorOccurrences,
      additionalOccurrencesAfterFirstBlocker,
      rootCauseClassification: 'not_inferred',
    },
    tokenComparison: {
      v2OutputTokens: totals.outputTokens,
      v3SimulatedOutputTokens: null,
      status: 'pending_v3_serializer',
    },
  };
};
