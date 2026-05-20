import { AIConfig, AuditReport, BenchmarkResult, ExecutionTraceEvent } from '../types';
import { createAIProvider } from './aiProvider';
import { detectHallucinations } from './benchmark/hallucinationDetector';
import { createTraceRecorder, fingerprintReport } from './executionEvidence';
import { deriveEvidenceStatus } from './improvementService';
import { buildAnalysisPrompt, buildScriptPrompt, extractPythonScript } from './providers/prompts';
import { validateCleaningScript } from './scriptValidationService';

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
  inputMode: BenchmarkResult['inputMode'] = 'smart_sample',
  onTrace?: (event: ExecutionTraceEvent) => void
): Promise<BenchmarkResult> => {
  const provider = createAIProvider(config);
  const trace = createTraceRecorder();
  const mark = (stage: string, details?: ExecutionTraceEvent['details']) => {
    trace.mark(stage, details);
    onTrace?.(trace.events[trace.events.length - 1]);
  };
  const startedAt = new Date().toISOString();
  const datasetFingerprint = fingerprintReport(report);
  const webGpuAvailable = typeof navigator !== 'undefined' && Boolean((navigator as any).gpu);
  mark('benchmark.created', {
    providerType: config.providerType,
    model: config.model,
    inputMode,
    rows: report.rowCount,
    columns: report.colCount,
    reportFingerprint: datasetFingerprint,
  });
  if (config.providerType === 'local') {
    mark('webgpu.preflight', { navigatorGpu: webGpuAvailable });
  }
  const baseResult: Omit<BenchmarkResult, 'status'> = {
    id: `${config.providerType}-${config.model}-${Date.now()}`,
    provider: provider.name,
    providerType: config.providerType,
    cloudProvider: config.cloudProvider,
    inputMode,
    model: config.model,
    temperature: config.temperature,
    latencyMs: 0,
    firstTokenMs: 0,
    tokensGenerated: 0,
    tokensPerSecond: 0,
    formatCompliance: false,
    pythonScriptIncluded: false,
    hallucinatedColumns: [],
    unsupportedClaims: 0,
    evidenceStatus: 'planned',
    startedAt,
    datasetFingerprint,
    webGpuAvailable: config.providerType === 'local' ? webGpuAvailable : undefined,
    executionTrace: trace.events,
    timestamp: new Date().toISOString()
  };

  mark('provider.availability.start');
  const isAvailable = await provider.isAvailable();
  mark('provider.availability.end', { available: isAvailable });
  if (!isAvailable) {
    return {
      ...baseResult,
      status: 'unavailable',
      evidenceStatus: 'attempted_failed',
      completedAt: new Date().toISOString(),
      executionTrace: trace.events,
      error: config.providerType === 'local'
        ? 'Proveedor local no disponible: WebGPU, adapter o modelo no pudo inicializarse.'
        : 'API key cloud no configurada.'
    };
  }

  try {
    if (inputMode === 'prompt_libre') {
      mark('provider.generateText.start');
      const { text, metrics } = await provider.generateText(buildLoosePrompt(report));
      mark('provider.generateText.end', {
        latencyMs: metrics.latencyMs,
        firstTokenMs: metrics.firstTokenMs,
        tokensGenerated: metrics.tokensGenerated,
        outputChars: text.length,
      });
      const tokensPerSecond = metrics.latencyMs > 0
        ? Number((metrics.tokensGenerated / (metrics.latencyMs / 1000)).toFixed(2))
        : 0;
      const hallucinationReport = detectHallucinations(report, text);
      const scriptValidation = validateCleaningScript(report, text);
      const result: BenchmarkResult = {
        ...baseResult,
        status: 'completed',
        latencyMs: metrics.latencyMs,
        firstTokenMs: metrics.firstTokenMs,
        tokensGenerated: metrics.tokensGenerated,
        tokensPerSecond,
        formatCompliance: false,
        pythonScriptIncluded: text.includes('import pandas') || text.includes('pd.'),
        hallucinatedColumns: hallucinationReport.hallucinatedColumns,
        unsupportedClaims: hallucinationReport.unsupportedClaims.length,
        hallucinationReport: {
          hallucinatedColumns: hallucinationReport.hallucinatedColumns,
          unsupportedClaimsCount: hallucinationReport.unsupportedClaims.length,
          jsonCompliance: hallucinationReport.jsonCompliance,
          formatErrorCount: hallucinationReport.formatErrors.length,
          invalidScriptColumns: hallucinationReport.invalidScriptColumns,
        },
        scriptValidation,
        completedAt: new Date().toISOString(),
        executionTrace: trace.events,
        timestamp: metrics.timestamp
      };

      return {
        ...result,
        evidenceStatus: deriveEvidenceStatus(result)
      };
    }

    mark('provider.diagnosisContract.start');
    const diagnosisPrompt = buildAnalysisPrompt(report, config.promptContract);
    const { text: diagnosisText, metrics: diagnosisMetrics } = await provider.generateText(diagnosisPrompt);
    mark('provider.diagnosisContract.end', {
      latencyMs: diagnosisMetrics.latencyMs,
      firstTokenMs: diagnosisMetrics.firstTokenMs,
      tokensGenerated: diagnosisMetrics.tokensGenerated,
      outputChars: diagnosisText.length,
    });

    mark('provider.scriptContract.start');
    const scriptPrompt = buildScriptPrompt(report, diagnosisText, config.promptContract);
    const { text: scriptText, metrics: scriptMetrics } = await provider.generateText(scriptPrompt);
    mark('provider.scriptContract.end', {
      latencyMs: scriptMetrics.latencyMs,
      firstTokenMs: scriptMetrics.firstTokenMs,
      tokensGenerated: scriptMetrics.tokensGenerated,
      outputChars: scriptText.length,
    });

    const script = extractPythonScript(scriptText);
    const serializedContent = JSON.stringify({ diagnosisText, script });
    const totalLatencyMs = diagnosisMetrics.latencyMs + scriptMetrics.latencyMs;
    const totalTokens = diagnosisMetrics.tokensGenerated + scriptMetrics.tokensGenerated;
    const firstTokenMs = diagnosisMetrics.firstTokenMs || scriptMetrics.firstTokenMs;
    const tokensPerSecond = totalLatencyMs > 0
      ? Number((totalTokens / (totalLatencyMs / 1000)).toFixed(2))
      : 0;
    const hallucinationReport = detectHallucinations(report, serializedContent, script);
    const scriptValidation = validateCleaningScript(report, script);
    const result: BenchmarkResult = {
      ...baseResult,
      status: 'completed',
      latencyMs: totalLatencyMs,
      firstTokenMs,
      tokensGenerated: totalTokens,
      tokensPerSecond,
      formatCompliance: Boolean(
        diagnosisText.includes('## Estado de ejecucion') ||
        diagnosisText.includes('## Hallazgos respaldados') ||
        diagnosisText.includes('## Criterios para generar script')
      ),
      pythonScriptIncluded: script.includes('import pandas') || script.includes('pd.'),
      hallucinatedColumns: hallucinationReport.hallucinatedColumns,
      unsupportedClaims: hallucinationReport.unsupportedClaims.length,
      hallucinationReport: {
        hallucinatedColumns: hallucinationReport.hallucinatedColumns,
        unsupportedClaimsCount: hallucinationReport.unsupportedClaims.length,
        jsonCompliance: hallucinationReport.jsonCompliance,
        formatErrorCount: hallucinationReport.formatErrors.length,
        invalidScriptColumns: hallucinationReport.invalidScriptColumns,
      },
      scriptValidation,
      completedAt: new Date().toISOString(),
      executionTrace: trace.events,
      timestamp: scriptMetrics.timestamp
    };

    return {
      ...result,
      evidenceStatus: deriveEvidenceStatus(result)
    };
  } catch (error: any) {
    mark('benchmark.error', { message: error?.message || 'Error desconocido durante benchmark.' });
    return {
      ...baseResult,
      status: 'error',
      evidenceStatus: 'attempted_failed',
      completedAt: new Date().toISOString(),
      executionTrace: trace.events,
      error: error?.message || 'Error desconocido durante benchmark.'
    };
  }
};
