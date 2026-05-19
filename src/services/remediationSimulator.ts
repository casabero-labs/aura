import { AuditReport, IssueCategory, RemediationAction, RemediationActionType } from '../types';

const PLACEHOLDERS = new Set(['', 'n/a', 'na', 'null', 'none', 'sin dato', 'sindato', '?', '-', '--', 'nan']);

const cloneRows = (data: Record<string, any>[]): Record<string, any>[] => {
  try {
    return structuredClone(data);
  } catch {
    return data.map((row) => JSON.parse(JSON.stringify(row)));
  }
};

const safeId = (prefix: string, value: string, index: number) =>
  `${prefix}-${value || 'dataset'}-${index}`.replace(/[^a-zA-Z0-9_-]+/g, '-');

const isNumericText = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' && /^-?\d+(?:[.,]\d+)?$/.test(value.trim());

const normalizeNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
};

const titleCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (match) => match.toUpperCase());

export const buildDeterministicRemediationActions = (report: AuditReport): RemediationAction[] => {
  const actions: RemediationAction[] = [];

  if (report.duplicateRows > 0) {
    actions.push({
      id: 'drop-exact-duplicates',
      type: 'drop_exact_duplicates',
      description: `Eliminar ${report.duplicateRows} filas duplicadas exactas en una copia simulada.`,
      safeToSimulate: true,
      sourceRuleName: 'Filas Duplicadas',
    });
  }

  report.issues.forEach((issue, index) => {
    if (!issue.column) return;

    const addAction = (type: RemediationActionType, description: string, safeToSimulate = true) => {
      actions.push({
        id: safeId(type, issue.column || issue.ruleName, index),
        type,
        column: issue.column,
        description,
        sourceIssueId: issue.id,
        sourceRuleName: issue.ruleName,
        safeToSimulate,
        requiresHumanReview: !safeToSimulate,
      });
    };

    if (issue.ruleName.includes('Espacios Fantasma') || issue.ruleName.includes('Espacios Múltiples')) {
      addAction('trim_whitespace', `Recortar espacios externos y compactar espacios internos en ${issue.column}.`);
    } else if (issue.ruleName.includes('Placeholders')) {
      addAction('normalize_placeholders', `Convertir placeholders toxicos de ${issue.column} a null.`);
    } else if (issue.ruleName.includes('Caos de Capitalización')) {
      addAction('normalize_casing', `Normalizar casing de ${issue.column} para reducir categorias duplicadas.`);
    } else if (issue.ruleName.includes('Números Disfrazados')) {
      addAction('convert_disguised_numbers', `Convertir textos numericos de ${issue.column} a number.`);
    } else if (
      issue.category === IssueCategory.SEMANTIC ||
      issue.ruleName.includes('Outliers') ||
      issue.ruleName.includes('PII') ||
      issue.ruleName.includes('Negativos')
    ) {
      addAction(
        'requires_human_review',
        `Revisar manualmente ${issue.column}: ${issue.description}`,
        false
      );
    }
  });

  return Array.from(new Map(actions.map((action) => [action.id, action])).values());
};

export const simulateRemediation = (
  data: Record<string, any>[],
  actions: RemediationAction[]
): { data: Record<string, any>[]; appliedActions: RemediationAction[]; skippedActions: RemediationAction[] } => {
  let rows = cloneRows(data);
  const appliedActions: RemediationAction[] = [];
  const skippedActions: RemediationAction[] = [];

  actions.forEach((action) => {
    if (!action.safeToSimulate) {
      skippedActions.push(action);
      return;
    }

    if (action.type === 'drop_exact_duplicates') {
      const seen = new Set<string>();
      rows = rows.filter((row) => {
        const signature = JSON.stringify(row);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
      appliedActions.push(action);
      return;
    }

    if (!action.column) {
      skippedActions.push(action);
      return;
    }

    rows = rows.map((row) => {
      const value = row[action.column as string];
      if (typeof value !== 'string') return row;

      if (action.type === 'trim_whitespace') {
        return { ...row, [action.column as string]: value.trim().replace(/\s+/g, ' ') };
      }

      if (action.type === 'normalize_placeholders') {
        const normalized = value.trim().toLowerCase();
        return { ...row, [action.column as string]: PLACEHOLDERS.has(normalized) ? null : value };
      }

      if (action.type === 'normalize_casing') {
        return { ...row, [action.column as string]: titleCase(value) };
      }

      if (action.type === 'convert_disguised_numbers' && isNumericText(value)) {
        return { ...row, [action.column as string]: normalizeNumber(value) };
      }

      return row;
    });
    appliedActions.push(action);
  });

  return { data: rows, appliedActions, skippedActions };
};
