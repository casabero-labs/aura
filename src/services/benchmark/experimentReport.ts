import type {
  ExperimentCampaignV1,
  ExperimentRunV1,
} from './experimentTypes';
import {
  validateExperimentCampaignV1,
  validateExperimentRunV1,
} from './experimentGuards';
import {
  aggregateExperimentRuns,
  type ExperimentAggregation,
} from './experimentAggregation';
import type { CellRepresentative } from './representativeSelector';
import { FINAL_EVALUATION_PROTOCOL } from './finalEvaluationProtocol';
import {
  buildExperimentDecisionSupport,
  type ExperimentDecisionSupport,
} from './experimentDecisionSupport';

export interface FormalValidityResult {
  valid: boolean;
  reasons: string[];
}

export interface ExperimentCampaignEvidenceDocumentV1 {
  contractId: 'aura.oe4-campaign-evidence.v1';
  contractVersion: '1.0.0';
  generatedAt: string;
  campaign: ExperimentCampaignV1;
  runs: ExperimentRunV1[];
  aggregation: ExperimentAggregation;
  decisionSupport: ExperimentDecisionSupport;
  representatives: CellRepresentative[];
  formalValidity: FormalValidityResult;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export const buildExperimentCampaignEvidence = (
  campaign: ExperimentCampaignV1,
  runs: readonly ExperimentRunV1[],
  generatedAt: string,
): ExperimentCampaignEvidenceDocumentV1 => {
  const sortedRuns = [...runs]
    .sort((left, right) => left.sequence - right.sequence || left.runId.localeCompare(right.runId))
    .map((run) => structuredClone(run));
  const reasons: string[] = [];
  const campaignValidation = validateExperimentCampaignV1(campaign);
  reasons.push(...campaignValidation.errors.map((error) => `campaign: ${error}`));
  sortedRuns.forEach((run) => {
    const validation = validateExperimentRunV1(run);
    reasons.push(...validation.errors.map((error) => `${run.runId}: ${error}`));
  });

  if (campaign.status !== 'completed') reasons.push('campaign status is not completed');
  if (sortedRuns.length !== FINAL_EVALUATION_PROTOCOL.matrix.units) {
    reasons.push(`campaign does not contain exactly ${FINAL_EVALUATION_PROTOCOL.matrix.units} runs`);
  }
  const observedIds = sortedRuns.map((run) => run.runId);
  if (JSON.stringify(observedIds) !== JSON.stringify(campaign.runIds)) {
    reasons.push('campaign runIds do not match the ordered raw runs');
  }
  if (sortedRuns.some((run) => ['planned', 'running'].includes(run.status))) {
    reasons.push('not every experimental unit was attempted');
  }
  const completedWithoutEvaluation = sortedRuns.filter((run) =>
    run.diagnosis?.status === 'completed' && run.automaticEvaluation === null);
  if (completedWithoutEvaluation.length > 0) {
    reasons.push(`${completedWithoutEvaluation.length} completed runs lack automatic evaluation`);
  }

  const uniqueReasons = unique(reasons);
  const aggregation = aggregateExperimentRuns(sortedRuns);
  return {
    contractId: 'aura.oe4-campaign-evidence.v1',
    contractVersion: '1.0.0',
    generatedAt,
    campaign: structuredClone(campaign),
    runs: sortedRuns,
    aggregation,
    decisionSupport: buildExperimentDecisionSupport(aggregation),
    representatives: [],
    formalValidity: { valid: uniqueReasons.length === 0, reasons: uniqueReasons },
  };
};

const formatNumber = (value: number | null, digits = 3): string =>
  value === null ? 'n/d' : value.toFixed(digits);

const formatPercent = (value: number | null): string =>
  value === null ? 'n/d' : `${(value * 100).toFixed(2)} %`;

const statusCounts = (document: ExperimentCampaignEvidenceDocumentV1): string => {
  const counts = new Map<string, number>();
  document.runs.forEach((run) => counts.set(run.status, (counts.get(run.status) ?? 0) + 1));
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`).join(', ');
};

export const renderExperimentReportMarkdown = (
  document: ExperimentCampaignEvidenceDocumentV1,
): string => {
  const { aggregation } = document;
  const visibleValidityReasons = document.formalValidity.reasons.slice(0, 12);
  const hiddenValidityReasonCount = document.formalValidity.reasons.length - visibleValidityReasons.length;
  const cellRows = aggregation.matrix.cells.map((cell) =>
    `| ${cell.modelId} | ${cell.inputMode} | ${cell.runCount} | ${cell.completedRuns} | ${cell.failedRuns} | ${formatNumber(cell.diagnosticF1.mean)} | ${formatNumber(cell.totalLatencyMs.median, 0)} |`);
  const scoreRows = document.decisionSupport.scores.map((score) =>
    `| ${score.modelId} | ${score.inputMode} | ${formatNumber(score.accuracy, 1)} | ${formatNumber(score.reliability, 1)} | ${formatNumber(score.contractCompliance, 1)} | ${formatNumber(score.evidenceSupport, 1)} | ${formatNumber(score.hallucinationSafety, 1)} | ${formatNumber(score.efficiency, 1)} | ${formatNumber(score.balanced, 1)} |`);
  const recommendationRows = document.decisionSupport.recommendations.map((recommendation) =>
    `| ${recommendation.useCase} | ${recommendation.modelId} | ${recommendation.inputMode} | ${formatNumber(recommendation.score, 1)} | ${recommendation.rationale} |`);

  return [
    `# Informe de evaluación LLM - ${document.campaign.campaignId}`,
    '',
    `Generado: ${document.generatedAt}`,
    `Validez formal: **${document.formalValidity.valid ? 'formal_valid' : 'incompleta'}**`,
    ...(document.formalValidity.reasons.length > 0
      ? [
        ...visibleValidityReasons.map((reason) => `- ${reason}`),
        ...(hiddenValidityReasonCount > 0
          ? [`- ${hiddenValidityReasonCount} razones adicionales permanecen en campaign.json.`]
          : []),
      ]
      : ['- Todos los gates formales están satisfechos.']),
    '',
    '## Método',
    '',
    `Protocolo ${document.campaign.protocolId} v${document.campaign.protocolVersion}. Matriz ${aggregation.matrix.models} × ${aggregation.matrix.inputModes} × ${aggregation.matrix.repetitions} = ${aggregation.matrix.expectedRuns} unidades. Dataset ${document.campaign.datasetId} con SHA-256 ${document.campaign.datasetSha256}.`,
    '',
    '## Entorno y modelos',
    '',
    `Modelos congelados: ${document.campaign.modelIds.join(', ')}. Modos de entrada: ${document.campaign.inputModes.join(', ')}. Cada corrida conserva snapshot de hardware, runtime, modelo, inferencia, prompt y hashes.`,
    '',
    '## Matriz de corridas y fallos',
    '',
    `Corridas observadas: ${aggregation.matrix.observedRuns}. Intentadas: ${aggregation.totals.attemptedRuns}. Completadas: ${aggregation.totals.completedRuns}. Fallidas: ${aggregation.totals.failedRuns}. Estados: ${statusCounts(document)}.`,
    '',
    '| Modelo | Entrada | Corridas | Completadas | Fallidas | F1 medio | Latencia mediana ms |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...cellRows,
    '',
    '## Calidad diagnóstica',
    '',
    `F1 primario global: media ${formatNumber(aggregation.overall.diagnosticF1.mean)}, mediana ${formatNumber(aggregation.overall.diagnosticF1.median)}, mínimo ${formatNumber(aggregation.overall.diagnosticF1.min)} y máximo ${formatNumber(aggregation.overall.diagnosticF1.max)}. La cobertura del motor y los descubrimientos extendidos permanecen separados del F1 primario.`,
    '',
    '## Contrato y alucinaciones',
    '',
    `Fidelidad de evidencia media: ${formatPercent(aggregation.overall.evidenceFidelity.mean)}. Anclaje medio: ${formatPercent(aggregation.overall.anchoring.mean)}. Las columnas y claims sin soporte se conservan por corrida en campaign.json y se resumen por celda.`,
    '',
    '## Método de calificación automática',
    '',
    document.decisionSupport.methodology.oracle,
    '',
    'Precisión mide cuántos hallazgos declarados son correctos; recall mide cuántos hallazgos esperados fueron encontrados; F1 es su media armónica. Fiabilidad es la proporción de corridas válidas. Contrato, evidencia, alucinaciones y eficiencia se calculan de forma determinista a partir de la respuesta, el snapshot, el recibo y las métricas de Ollama.',
    '',
    '## Latencia, tokens y estabilidad',
    '',
    `Latencia total mediana: ${formatNumber(aggregation.overall.totalLatencyMs.median, 0)} ms. Tokens de salida medianos: ${formatNumber(aggregation.overall.outputTokens.median, 0)}. Los fallos y reintentos permanecen visibles; no se reemplazan por ceros ni se eliminan.`,
    '',
    '## Scores de apoyo a la decisión',
    '',
    '| Modelo | Entrada | Exactitud | Fiabilidad | Contrato | Evidencia | Sin alucinaciones | Eficiencia | Equilibrado |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...scoreRows,
    '',
    `Índice equilibrado: exactitud 35 %, fiabilidad 20 %, contrato 15 %, evidencia 15 %, ausencia de alucinaciones 10 % y eficiencia 5 %. ${document.decisionSupport.methodology.note}`,
    '',
    '## Recomendaciones por objetivo',
    '',
    '| Objetivo | Modelo | Entrada | Score | Justificación |',
    '|---|---|---|---:|---|',
    ...recommendationRows,
    '',
    'No existe un campo ni una conclusión de ganador universal. Cada resultado se interpreta dentro de su dimensión.',
    '',
    '## Amenazas a la validez',
    '',
    '- Un único dataset controlado limita la generalización externa.',
    '- Tres repeticiones permiten estadística descriptiva, no afirmaciones causales fuertes.',
    '- El hardware y el runtime local condicionan latencia y throughput.',
    '- El índice equilibrado depende de ponderaciones explícitas y debe interpretarse junto con sus dimensiones.',
    '- La evaluación del Laboratorio cubre diagnóstico LLM; script, HITL y remediación pertenecen al pipeline normal.',
    '',
    '## Conclusiones acotadas',
    '',
    `La campaña ${document.campaign.campaignId} ${document.formalValidity.valid ? 'satisface' : 'todavía no satisface'} los gates de evidencia formal. Los resultados permiten comparar modelos y modos por dimensión, sin afirmar superioridad universal ni corrección automática garantizada.`,
    '',
  ].join('\n');
};
