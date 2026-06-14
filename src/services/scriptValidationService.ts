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
  script?: string,
  origin?: ScriptValidationResult['scriptOrigin']
): ScriptValidationResult => {
  const hasScript = Boolean(script?.trim());
  const effectiveOrigin = origin || (hasScript ? 'model' : 'pending');

  if (!hasScript) {
    return {
      valid: false,
      hasScript: false,
      invalidColumns: [],
      destructiveOperations: [],
      coveredIssueIds: [],
      uncoveredIssueIds: report.issues.map((i) => i.id),
      coveragePercentage: 0,
      safetyScore: 0,
      scriptOrigin: effectiveOrigin,
      hasPandasImport: false,
      requiresHumanReview: true,
      warnings: ['No se genero script Python/Pandas.'],
    };
  }

  const scriptText = script || '';
  const columnValidation = validateScriptColumns(report, scriptText);
  const destructiveOperations = DESTRUCTIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(scriptText))
    .map(({ label }) => label);

  const hasPandasImport = scriptText.includes('import pandas') || scriptText.includes('pd.');

  const coveredIssueIds = report.issues
    .filter((issue) => {
      const columnMatch = issue.column ? hasColumnTrace(scriptText, issue.column) : false;
      const ruleMatch = hasRuleTrace(scriptText, issue.ruleName);
      return columnMatch || ruleMatch;
    })
    .map((issue) => issue.id);

  const uncoveredIssueIds = report.issues
    .filter((issue) => !coveredIssueIds.includes(issue.id))
    .map((issue) => issue.id);

  const coveragePercentage = report.issues.length > 0
    ? Math.round((coveredIssueIds.length / report.issues.length) * 100)
    : 100;

  // ── Safety Score (0-100) ──
  // Columns valid: 30 pts
  const columnScore = columnValidation.valid ? 30 : Math.max(0, 30 - columnValidation.invalidColumns.length * 10);
  // Coverage: 30 pts (proportional to covered issues)
  const coverageScore = report.issues.length > 0
    ? Math.round((coveredIssueIds.length / report.issues.length) * 30)
    : 30;
  // No destructive ops: 25 pts
  const destructiveScore = destructiveOperations.length === 0 ? 25 : Math.max(0, 25 - destructiveOperations.length * 10);
  // Pandas import: 15 pts
  const pandasScore = hasPandasImport ? 15 : 0;

  const safetyScore = Math.max(0, Math.min(100, columnScore + coverageScore + destructiveScore + pandasScore));

  const warnings = [
    ...(!hasPandasImport ? ['El script no evidencia uso de Pandas.'] : []),
    ...(destructiveOperations.length > 0 ? ['El script contiene operaciones destructivas o mutaciones directas.'] : []),
    ...(columnValidation.invalidColumns.length > 0 ? ['El script referencia columnas que no existen en el AuditReport.'] : []),
    ...(coveredIssueIds.length === 0 ? ['No se pudo trazar el script contra hallazgos detectados en el perfil determinista.'] : []),
    ...(coveragePercentage < 50 ? [`Cobertura baja: solo ${coveragePercentage}% de los hallazgos tienen traza en el script.`] : []),
    ...(effectiveOrigin === 'deterministic' ? ['Script generado por respaldo determinista, no por LLM.'] : []),
  ];

  return {
    valid: columnValidation.valid && coveredIssueIds.length > 0 && destructiveOperations.length === 0,
    hasScript: true,
    invalidColumns: columnValidation.invalidColumns,
    destructiveOperations,
    coveredIssueIds,
    uncoveredIssueIds,
    coveragePercentage,
    safetyScore,
    scriptOrigin: effectiveOrigin,
    hasPandasImport,
    requiresHumanReview: destructiveOperations.length > 0 || warnings.length > 0 || safetyScore < 60,
    warnings,
  };
};
