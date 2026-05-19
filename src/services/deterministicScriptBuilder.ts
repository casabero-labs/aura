import { AuditReport, ProviderMetrics, RemediationAction } from '../types';
import { buildDeterministicRemediationActions } from './remediationSimulator';

const quote = (value: string) => JSON.stringify(value);

const actionComment = (action: RemediationAction) => {
  const source = action.sourceRuleName ? `regla=${action.sourceRuleName}` : 'regla=perfil determinista';
  const issue = action.sourceIssueId ? ` issue=${action.sourceIssueId}` : '';
  return `# ${source}${issue} :: ${action.description}`;
};

export const buildDeterministicCleaningScript = (report: AuditReport): string => {
  const actions = buildDeterministicRemediationActions(report);
  const lines: string[] = [
    'import pandas as pd',
    'import numpy as np',
    '',
    '# Script base generado por AURA desde hallazgos deterministas.',
    '# Ejecutar sobre una copia del DataFrame original: df_clean = df.copy()',
    'df_clean = df.copy()',
    '',
  ];

  if (actions.length === 0) {
    lines.push(
      '# No se generaron transformaciones automáticas.',
      '# El perfil no activó reglas con corrección segura.',
      ''
    );
  }

  actions.forEach((action) => {
    lines.push(actionComment(action));

    if (!action.safeToSimulate || action.type === 'requires_human_review') {
      lines.push('# Requiere criterio humano antes de transformar esta columna.');
      lines.push('');
      return;
    }

    if (action.type === 'drop_exact_duplicates') {
      lines.push('df_clean = df_clean.drop_duplicates().copy()');
      lines.push('');
      return;
    }

    if (!action.column) {
      lines.push('# Accion omitida: no hay columna asociada.');
      lines.push('');
      return;
    }

    const column = quote(action.column);

    if (action.type === 'trim_whitespace') {
      lines.push(`df_clean[${column}] = df_clean[${column}].astype('string').str.strip().str.replace(r'\\s+', ' ', regex=True)`);
    } else if (action.type === 'normalize_placeholders') {
      lines.push(`df_clean[${column}] = df_clean[${column}].replace(['', 'n/a', 'N/A', 'na', 'NA', 'null', 'NULL', 'none', 'None', '?', '-', '--'], np.nan)`);
    } else if (action.type === 'normalize_casing') {
      lines.push(`df_clean[${column}] = df_clean[${column}].astype('string').str.strip().str.title()`);
    } else if (action.type === 'convert_disguised_numbers') {
      lines.push(`df_clean[${column}] = pd.to_numeric(df_clean[${column}].astype('string').str.replace(',', '.', regex=False), errors='coerce')`);
    }

    lines.push('');
  });

  lines.push('# Resultado: df_clean contiene las transformaciones seguras propuestas por AURA.');
  return lines.join('\n').trimEnd();
};

export const buildFallbackScriptMetrics = (): ProviderMetrics => ({
  provider: 'AURA',
  model: 'deterministic-script-builder',
  latencyMs: 0,
  firstTokenMs: 0,
  tokensGenerated: 0,
  isLocal: true,
  timestamp: new Date().toISOString(),
});
