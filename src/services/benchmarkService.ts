import { AIConfig, AuditReport, BenchmarkResult } from '../types';
import { createAIProvider } from './aiProvider';

const extractScriptColumns = (script: string): string[] => {
  const matches = script.matchAll(/df\[['"]([^'"]+)['"]\]/g);
  return Array.from(new Set(Array.from(matches, match => match[1])));
};

const extractMentionedColumns = (text: string): string[] => {
  const quoted = Array.from(text.matchAll(/[`'"]([A-Za-z_][\w .-]{1,60})[`'"]/g), match => match[1]);
  return Array.from(new Set([...quoted, ...extractScriptColumns(text)]));
};

const detectHallucinatedColumns = (report: AuditReport, text?: string): string[] => {
  if (!text) return [];
  const knownColumns = new Set(Object.keys(report.columnStats));
  const knownIssueNames = new Set(report.issues.map(issue => issue.ruleName));
  return extractMentionedColumns(text)
    .filter(column => !knownColumns.has(column))
    .filter(column => !knownIssueNames.has(column))
    .filter(column => !['dataset.csv', 'df', 'python', 'pandas'].includes(column.toLowerCase()));
};

const buildLoosePrompt = (report: AuditReport): string => {
  const columnNames = Object.keys(report.columnStats).join(', ');
  return `
Analiza este dataset y entrega un diagnostico de calidad de datos con recomendaciones y, si aplica, codigo Python/Pandas.

Columnas disponibles:
${columnNames}

Contexto minimo:
- Filas: ${report.rowCount}
- Columnas: ${report.colCount}
- Score actual: ${report.score}/100

No recibiras reglas activadas ni muestras problematicas. Debes inferir los problemas probables a partir del esquema.
Responde en español.
  `;
};

export const runBenchmarkForConfig = async (
  report: AuditReport,
  config: AIConfig,
  inputMode: BenchmarkResult['inputMode'] = 'smart_sample'
): Promise<BenchmarkResult> => {
  const provider = createAIProvider(config);
  const baseResult = {
    id: `${config.providerType}-${config.model}-${Date.now()}`,
    provider: provider.name,
    providerType: config.providerType,
    inputMode,
    model: config.model,
    latencyMs: 0,
    firstTokenMs: 0,
    tokensGenerated: 0,
    tokensPerSecond: 0,
    formatCompliance: false,
    pythonScriptIncluded: false,
    hallucinatedColumns: [],
    unsupportedClaims: 0,
    timestamp: new Date().toISOString()
  };

  const isAvailable = await provider.isAvailable();
  if (!isAvailable) {
    return {
      ...baseResult,
      status: 'unavailable',
      error: config.providerType === 'local'
        ? 'WebGPU no disponible en este navegador.'
        : 'API key cloud no configurada.'
    };
  }

  try {
    if (inputMode === 'prompt_libre') {
      const { text, metrics } = await provider.generateText(buildLoosePrompt(report));
      const tokensPerSecond = metrics.latencyMs > 0
        ? Number((metrics.tokensGenerated / (metrics.latencyMs / 1000)).toFixed(2))
        : 0;
      const hallucinatedColumns = detectHallucinatedColumns(report, text);

      return {
        ...baseResult,
        status: 'completed',
        latencyMs: metrics.latencyMs,
        firstTokenMs: metrics.firstTokenMs,
        tokensGenerated: metrics.tokensGenerated,
        tokensPerSecond,
        formatCompliance: false,
        pythonScriptIncluded: text.includes('import pandas') || text.includes('pd.'),
        hallucinatedColumns,
        unsupportedClaims: hallucinatedColumns.length,
        timestamp: metrics.timestamp
      };
    }

    const { content, metrics } = await provider.generateExecutiveReport(report);
    const script = content.python_script || '';
    const serializedContent = JSON.stringify(content);
    const tokensPerSecond = metrics.latencyMs > 0
      ? Number((metrics.tokensGenerated / (metrics.latencyMs / 1000)).toFixed(2))
      : 0;
    const hallucinatedColumns = detectHallucinatedColumns(report, serializedContent);

    return {
      ...baseResult,
      status: 'completed',
      latencyMs: metrics.latencyMs,
      firstTokenMs: metrics.firstTokenMs,
      tokensGenerated: metrics.tokensGenerated,
      tokensPerSecond,
      formatCompliance: Boolean(
        content.title &&
        content.domain_inferred &&
        content.executive_summary &&
        Array.isArray(content.key_findings) &&
        Array.isArray(content.recommendations)
      ),
      pythonScriptIncluded: script.includes('import pandas') || script.includes('pd.'),
      hallucinatedColumns,
      unsupportedClaims: hallucinatedColumns.length,
      timestamp: metrics.timestamp
    };
  } catch (error: any) {
    return {
      ...baseResult,
      status: 'error',
      error: error?.message || 'Error desconocido durante benchmark.'
    };
  }
};
