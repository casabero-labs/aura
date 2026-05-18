import { AuditReport, ScriptValidationResult } from '../types';
import { validateScriptColumns } from './benchmark/hallucinationDetector';

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\.drop\s*\(/i, label: 'drop' },
  { pattern: /dropna\s*\(/i, label: 'dropna' },
  { pattern: /drop_duplicates\s*\(/i, label: 'drop_duplicates' },
  { pattern: /del\s+df\[/i, label: 'delete_column' },
  { pattern: /inplace\s*=\s*True/i, label: 'inplace_mutation' },
];

const normalize = (value: string) => value.toLowerCase();

export const validateCleaningScript = (
  report: AuditReport,
  script?: string
): ScriptValidationResult => {
  const hasScript = Boolean(script?.trim());
  if (!hasScript) {
    return {
      valid: false,
      hasScript: false,
      invalidColumns: [],
      destructiveOperations: [],
      coveredIssueIds: [],
      requiresHumanReview: true,
      warnings: ['No se genero script Python/Pandas.'],
    };
  }

  const scriptText = script || '';
  const columnValidation = validateScriptColumns(report, scriptText);
  const destructiveOperations = DESTRUCTIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(scriptText))
    .map(({ label }) => label);

  const normalizedScript = normalize(scriptText);
  const coveredIssueIds = report.issues
    .filter((issue) => {
      const columnMatch = issue.column ? normalizedScript.includes(normalize(issue.column)) : false;
      const ruleMatch = normalizedScript.includes(normalize(issue.ruleName));
      return columnMatch || ruleMatch;
    })
    .map((issue) => issue.id);

  const warnings = [
    ...(!scriptText.includes('import pandas') && !scriptText.includes('pd.') ? ['El script no evidencia uso de Pandas.'] : []),
    ...(destructiveOperations.length > 0 ? ['El script contiene operaciones destructivas o mutaciones directas.'] : []),
    ...(columnValidation.invalidColumns.length > 0 ? ['El script referencia columnas que no existen en el AuditReport.'] : []),
    ...(coveredIssueIds.length === 0 ? ['No se pudo trazar el script contra issues detectados por Capa 1.'] : []),
  ];

  return {
    valid: columnValidation.valid && coveredIssueIds.length > 0,
    hasScript: true,
    invalidColumns: columnValidation.invalidColumns,
    destructiveOperations,
    coveredIssueIds,
    requiresHumanReview: destructiveOperations.length > 0 || warnings.length > 0,
    warnings,
  };
};
