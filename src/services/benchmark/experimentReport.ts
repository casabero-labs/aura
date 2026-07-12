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
import {
  selectCampaignRepresentatives,
  type CellRepresentative,
} from './representativeSelector';
import { FINAL_EVALUATION_PROTOCOL } from './finalEvaluationProtocol';

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
  representatives: CellRepresentative[];
  formalValidity: FormalValidityResult;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const resolvedRepresentativeStatus = (run: ExperimentRunV1): boolean =>
  ['rejected', 'blocked', 'reaudited'].includes(run.status);

const selectRepresentativesSafely = (runs: readonly ExperimentRunV1[]): {
  representatives: CellRepresentative[];
  error: string | null;
} => {
  try {
    return { representatives: selectCampaignRepresentatives(runs), error: null };
  } catch (error) {
    return {
      representatives: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

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
    reasons.push('campaign does not contain exactly 45 runs');
  }
  const observedIds = sortedRuns.map((run) => run.runId);
  if (JSON.stringify(observedIds) !== JSON.stringify(campaign.runIds)) {
    reasons.push('campaign runIds do not match the ordered raw runs');
  }
  if (sortedRuns.some((run) => ['planned', 'running'].includes(run.status))) {
    reasons.push('not every experimental unit was attempted');
  }
  const completedWithoutEvaluation = sortedRuns.filter((run) =>
    run.diagnosis?.status === 'completed'
    && (run.automaticEvaluation === null || run.humanReview === null));
  if (completedWithoutEvaluation.length > 0) {
    reasons.push(`${completedWithoutEvaluation.length} completed runs lack automatic or human evaluation`);
  }

  const selection = selectRepresentativesSafely(sortedRuns);
  if (selection.error !== null) reasons.push(`representatives: ${selection.error}`);
  if (selection.representatives.length !== 9) reasons.push('exactly nine representatives are required');
  const unresolved = selection.representatives.filter((representative) =>
    !resolvedRepresentativeStatus(representative.run));
  if (unresolved.length > 0) reasons.push(`${unresolved.length} representatives lack final resolution`);
  const incompleteReaudits = selection.representatives.filter((representative) =>
    representative.run.status === 'reaudited'
    && representative.run.execution?.reaudit === null);
  if (incompleteReaudits.length > 0) reasons.push(`${incompleteReaudits.length} approved representatives lack reaudit evidence`);

  const uniqueReasons = unique(reasons);
  return {
    contractId: 'aura.oe4-campaign-evidence.v1',
    contractVersion: '1.0.0',
    generatedAt,
    campaign: structuredClone(campaign),
    runs: sortedRuns,
    aggregation: aggregateExperimentRuns(sortedRuns),
    representatives: selection.representatives,
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
  const evaluatedRuns = document.runs.filter((run) => run.automaticEvaluation !== null);
  const syntaxMeasuredRuns = evaluatedRuns.filter(
    (run) => run.automaticEvaluation?.script.syntaxValid !== null,
  );
  const syntaxNotMeasuredRuns = evaluatedRuns.length - syntaxMeasuredRuns.length;
  const { aggregation } = document;
  const visibleValidityReasons = document.formalValidity.reasons.slice(0, 12);
  const hiddenValidityReasonCount = document.formalValidity.reasons.length - visibleValidityReasons.length;
  const cellRows = aggregation.matrix.cells.map((cell) =>
    `| ${cell.modelId} | ${cell.inputMode} | ${cell.runCount} | ${cell.completedRuns} | ${cell.failedRuns} | ${formatNumber(cell.diagnosticF1.mean)} | ${formatNumber(cell.totalLatencyMs.median, 0)} | ${formatNumber(cell.humanMean.mean)} |`);
  const bestRows = aggregation.bestByDimension.map((entry) =>
    `| ${entry.dimension} | ${entry.direction} | ${entry.modelId} | ${entry.inputMode} | ${entry.repetition} | ${formatNumber(entry.value)} |`);
  const representativeRows = document.representatives.map((representative) =>
    `| ${representative.modelId} | ${representative.inputMode} | ${representative.repetition} | ${formatNumber(representative.f1)} | ${representative.run.status} | ${representative.run.execution?.reaudit?.outcome ?? 'n/d'} |`);

  return [
    `# Expediente OE4 - ${document.campaign.campaignId}`,
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
    '| Modelo | Entrada | Corridas | Completadas | Fallidas | F1 medio | Latencia mediana ms | Rúbrica media |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
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
    '## Validez y seguridad del script',
    '',
    `Scripts seguros por celda: ${aggregation.matrix.cells.map((cell) => `${cell.cellId}=${cell.safeScriptRuns}/${cell.runCount}`).join('; ')}. Contrato, sintaxis, acciones faltantes y acciones no soportadas permanecen como dimensiones independientes.`,
    '',
    `Sintaxis verificada: ${syntaxMeasuredRuns.length}/${evaluatedRuns.length} corridas evaluadas. El resto (${syntaxNotMeasuredRuns}) quedan como not_measured — Python aún no ha sido ejecutado.`,
    '',
    '## Latencia, tokens y estabilidad',
    '',
    `Latencia total mediana: ${formatNumber(aggregation.overall.totalLatencyMs.median, 0)} ms. Tokens de salida medianos: ${formatNumber(aggregation.overall.outputTokens.median, 0)}. Los fallos y reintentos permanecen visibles; no se reemplazan por ceros ni se eliminan.`,
    '',
    '## Rúbrica humana',
    '',
    `Corridas calificadas: ${aggregation.totals.runsWithHumanReview}/${aggregation.matrix.observedRuns}. Media conjunta: ${formatNumber(aggregation.overall.humanMean.mean)} sobre 4. Claridad, trazabilidad y accionabilidad se conservan individualmente en campaign.json.`,
    '',
    '## Ejecución representativa y antes/después',
    '',
    '| Modelo | Entrada | Repetición | F1 | Resolución | Resultado antes/después |',
    '|---|---|---:|---:|---|---|',
    ...(representativeRows.length > 0 ? representativeRows : ['| n/d | n/d | n/d | n/d | pendiente | n/d |']),
    '',
    '## Mejores resultados por dimensión',
    '',
    '| Dimensión | Dirección | Modelo | Entrada | Repetición | Valor |',
    '|---|---|---|---|---:|---:|',
    ...(bestRows.length > 0 ? bestRows : ['| n/d | n/d | n/d | n/d | n/d | n/d |']),
    '',
    'No existe un campo ni una conclusión de ganador universal. Cada resultado se interpreta dentro de su dimensión.',
    '',
    '## Amenazas a la validez',
    '',
    '- Un único dataset controlado limita la generalización externa.',
    '- Cinco repeticiones permiten estadística descriptiva, no afirmaciones causales fuertes.',
    '- El hardware y el runtime local condicionan latencia y throughput.',
    '- La rúbrica humana conserva identidad, fecha y notas, pero sigue expuesta a juicio del revisor.',
    '- Los scripts solo se ejecutan externamente después de HITL y sobre una copia controlada.',
    '',
    '## Conclusiones acotadas',
    '',
    `La campaña ${document.campaign.campaignId} ${document.formalValidity.valid ? 'satisface' : 'todavía no satisface'} los gates de evidencia formal. Los resultados permiten comparar modelos y modos por dimensión, sin afirmar superioridad universal ni corrección automática garantizada.`,
    '',
  ].join('\n');
};
