export interface RemediationOracleLinkV1 {
  diagnosticKey: string;
  expectedActions: string[];
  allowedActions: string[];
  forbiddenActions: string[];
}

export interface RemediationOracleV1 {
  links: RemediationOracleLinkV1[];
}

export interface PredictedRemediationAction {
  diagnosticKey: string;
  actionType: string;
}

export interface ScriptOracleEvaluationInput {
  oracle: RemediationOracleV1;
  scriptText: string;
  contractValid: boolean;
  syntaxValid: boolean;
  knownColumns: readonly string[];
  referencedColumns: readonly string[];
  actions: readonly PredictedRemediationAction[];
}

export interface ScriptOracleEvaluation {
  contractValid: boolean;
  syntaxValid: boolean;
  safe: boolean;
  invalidColumns: string[];
  dangerousImports: string[];
  dangerousOperations: string[];
  coveredActions: string[];
  missingActions: string[];
  unsupportedActions: string[];
  coverage: number;
  eligibleForHumanReview: boolean;
}

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right));

const actionKey = (diagnosticKey: string, actionType: string): string =>
  `${diagnosticKey}=>${actionType}`;

const detectDangerousImports = (scriptText: string): string[] => {
  const allowed = new Set(['pandas', 'numpy']);
  const imported: string[] = [];
  for (const line of scriptText.split(/\r?\n/)) {
    const direct = /^\s*import\s+([a-zA-Z0-9_.]+)/.exec(line);
    const from = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+/.exec(line);
    const moduleName = direct?.[1] ?? from?.[1];
    if (moduleName && !allowed.has(moduleName.split('.')[0])) imported.push(moduleName);
  }
  return uniqueSorted(imported);
};

const DANGEROUS_OPERATION_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['dynamic_execution', /\b(?:eval|exec|compile|__import__)\s*\(/],
  ['filesystem', /\bopen\s*\(|\bos\.|\bpathlib\b|\bshutil\b|\.remove\s*\(|\.unlink\s*\(/],
  ['network', /\b(?:requests|socket|urllib|httpx|aiohttp)\b/],
  ['process', /\bsubprocess\b|\bos\.system\s*\(/],
];

const detectDangerousOperations = (scriptText: string): string[] =>
  DANGEROUS_OPERATION_PATTERNS
    .filter(([, pattern]) => pattern.test(scriptText))
    .map(([label]) => label);

export const evaluateScriptOracle = (
  input: ScriptOracleEvaluationInput,
): ScriptOracleEvaluation => {
  const knownColumns = new Set(input.knownColumns);
  const invalidColumns = uniqueSorted(input.referencedColumns.filter((column) => !knownColumns.has(column)));
  const dangerousImports = detectDangerousImports(input.scriptText);
  const dangerousOperations = detectDangerousOperations(input.scriptText);
  const hasEntrypoint = /\bdef\s+clean_dataset\s*\(\s*df\s*\)\s*:/.test(input.scriptText);
  const syntaxValid = input.syntaxValid && hasEntrypoint;
  const oracleByKey = new Map(input.oracle.links.map((link) => [link.diagnosticKey, link]));

  const coveredActions: string[] = [];
  const unsupportedActions: string[] = [];
  for (const action of input.actions) {
    const link = oracleByKey.get(action.diagnosticKey);
    const key = actionKey(action.diagnosticKey, action.actionType);
    if (
      link === undefined
      || !link.allowedActions.includes(action.actionType)
      || link.forbiddenActions.includes(action.actionType)
    ) {
      unsupportedActions.push(key);
      continue;
    }
    if (link.expectedActions.includes(action.actionType)) coveredActions.push(key);
  }

  const coveredSet = new Set(coveredActions);
  const expectedActions = input.oracle.links.flatMap((link) =>
    link.expectedActions.map((actionType) => actionKey(link.diagnosticKey, actionType)));
  const missingActions = expectedActions.filter((key) => !coveredSet.has(key));
  const safe = invalidColumns.length === 0
    && dangerousImports.length === 0
    && dangerousOperations.length === 0
    && unsupportedActions.length === 0;
  const normalizedCovered = uniqueSorted(coveredActions);
  const normalizedMissing = uniqueSorted(missingActions);
  const normalizedUnsupported = uniqueSorted(unsupportedActions);
  const coverage = expectedActions.length === 0 ? 1 : normalizedCovered.length / expectedActions.length;
  const eligibleForHumanReview = input.contractValid
    && syntaxValid
    && safe
    && normalizedMissing.length === 0;

  return {
    contractValid: input.contractValid,
    syntaxValid,
    safe,
    invalidColumns,
    dangerousImports,
    dangerousOperations,
    coveredActions: normalizedCovered,
    missingActions: normalizedMissing,
    unsupportedActions: normalizedUnsupported,
    coverage,
    eligibleForHumanReview,
  };
};
