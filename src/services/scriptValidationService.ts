import { AuditReport, ScriptValidationResult } from '../types';
import { validateScriptColumns } from './benchmark/hallucinationDetector';

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\.drop\s*\(/i, label: 'drop' },
  { pattern: /dropna\s*\(/i, label: 'dropna' },
  { pattern: /drop_duplicates\s*\(/i, label: 'drop_duplicates' },
  { pattern: /del\s+df\[/i, label: 'delete_column' },
  { pattern: /inplace\s*=\s*True/i, label: 'inplace_mutation' },
];

const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const hasColumnTrace = (script: string, column: string): boolean => {
  const normScript = script.toLowerCase();
  const normColumn = column.toLowerCase();
  
  if (!normColumn) return false;
  
  // 1. Intentar buscarla entre comillas: 'col', "col", `col` (acceso a clave de pandas)
  const quotedRegex = new RegExp("['\"\\`]" + escapeRegExp(normColumn) + "['\"\\`]", 'i');
  if (quotedRegex.test(normScript)) return true;
  
  // 2. Si es un identificador estándar, verificar límites de palabra exactos \b
  if (/^[a-zA-Z0-9_]+$/.test(normColumn)) {
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegExp(normColumn)}\\b`, 'i');
    return wordBoundaryRegex.test(normScript);
  }
  
  // 3. De lo contrario, buscar como subcadena simple
  return normScript.includes(normColumn);
};

const hasRuleTrace = (script: string, ruleName: string): boolean => {
  const normScript = script.toLowerCase();
  const normRule = ruleName.toLowerCase();
  if (!normRule) return false;
  
  if (/^[a-zA-Z0-9_]+$/.test(normRule)) {
    const regex = new RegExp(`\\b${escapeRegExp(normRule)}\\b`, 'i');
    return regex.test(normScript);
  }
  return normScript.includes(normRule);
};

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

  const coveredIssueIds = report.issues
    .filter((issue) => {
      const columnMatch = issue.column ? hasColumnTrace(scriptText, issue.column) : false;
      const ruleMatch = hasRuleTrace(scriptText, issue.ruleName);
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
