import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import { sha256BytesHex } from '../../contracts/llm/hash';
import type { ExperimentCampaignV1, ExperimentRunV1 } from './experimentTypes';
import {
  buildExperimentCampaignEvidence,
  renderExperimentReportMarkdown,
  type ExperimentCampaignEvidenceDocumentV1,
} from './experimentReport';
import {
  generateExperimentPdfReport,
  type ExperimentPdfReport,
} from './experimentPdfReport';
import { renderBenchmarkGlossaryMarkdown } from './benchmarkGlossary';
import {
  buildCampaignPipelineConfiguration,
  type CampaignPipelineConfigurationV1,
} from './campaignPipelineConfiguration';

export type ExperimentArtifactFilename =
  | 'campaign.json'
  | 'runs.csv'
  | 'report.md'
  | 'report.pdf'
  | 'results-summary.json'
  | 'methodology.md'
  | 'glossary.md'
  | 'selected-configuration.json';

export interface ExperimentArtifactManifestEntry {
  filename: ExperimentArtifactFilename;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
}

export interface ExperimentArtifactManifestV1 {
  contractId: 'aura.oe4-artifact-manifest.v1';
  contractVersion: '1.0.0';
  campaignId: string;
  generatedAt: string;
  hashAlgorithm: 'SHA-256';
  files: ExperimentArtifactManifestEntry[];
  self: {
    scope: 'canonical manifest payload excluding self';
    sha256: string;
  };
}

export interface ExperimentEvidencePackage {
  source: ExperimentCampaignEvidenceDocumentV1;
  campaignJson: string;
  runsCsv: string;
  reportMarkdown: string;
  reportPdf: ExperimentPdfReport;
  resultsSummaryJson: string;
  methodologyMarkdown: string;
  glossaryMarkdown: string;
  selectedConfiguration: CampaignPipelineConfigurationV1;
  selectedConfigurationJson: string;
  manifest: ExperimentArtifactManifestV1;
  manifestJson: string;
  artifacts: Array<{
    filename: ExperimentArtifactFilename | 'manifest.json';
    mediaType: string;
    content: string | Uint8Array;
  }>;
}

export interface ExportExperimentEvidenceInput {
  campaign: ExperimentCampaignV1;
  runs: readonly ExperimentRunV1[];
  generatedAt: string;
  selectedCellId?: string;
  ollamaBaseUrl?: string;
}

const utf8Bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

export const canonicalPrettyJson = (value: unknown): string =>
  `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;

const csvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const totalMetric = (
  run: ExperimentRunV1,
  key: 'totalDurationMs' | 'promptTokens' | 'outputTokens' | 'reasoningTokens',
): number | null => run.diagnosis?.metrics?.[key] ?? null;

export const renderExperimentRunsCsv = (
  document: ExperimentCampaignEvidenceDocumentV1,
): string => {
  const headers = [
    'campaign_id', 'run_id', 'sequence', 'model_id', 'input_mode', 'repetition',
    'status', 'diagnosis_status', 'tp', 'fp',
    'fn', 'precision', 'recall', 'f1', 'engine_coverage', 'evidence_fidelity',
    'contract_compliant', 'invented_columns', 'unsupported_claims', 'anchoring_score',
    'contract_errors', 'anchored_evidence_refs', 'anchored_bad_sample_refs',
    'latency_total_ms', 'prompt_tokens', 'output_tokens', 'reasoning_tokens',
    'attempt_event_count',
    'prompt_hash', 'input_hash', 'response_schema_hash', 'receipt_hash',
    'requested_model', 'observed_model', 'model_digest', 'inference_hash',
    'raw_response_hash', 'validation_status',
  ];
  const rows = document.runs.map((run) => {
    const diagnosis = run.automaticEvaluation?.diagnosis;
    const receipt = run.executionReceipt ?? null;
    const input = run.input;
    return [
      run.campaignId,
      run.runId,
      run.sequence,
      run.modelId,
      run.inputMode,
      run.repetition,
      run.status,
      run.diagnosis?.status,
      diagnosis?.primary.tp,
      diagnosis?.primary.fp,
      diagnosis?.primary.fn,
      diagnosis?.primary.precision,
      diagnosis?.primary.recall,
      diagnosis?.primary.f1,
      diagnosis?.engineCoverage,
      diagnosis?.evidenceFidelity,
      diagnosis?.contractCompliant,
      diagnosis?.inventedColumns.join('|'),
      diagnosis?.unsupportedClaims.join('|'),
      diagnosis?.anchoringScore,
      diagnosis?.contractErrors?.join('|') ?? '',
      diagnosis?.anchoredEvidenceRefs?.join('|') ?? '',
      diagnosis?.anchoredBadSampleRefs?.join('|') ?? '',
      totalMetric(run, 'totalDurationMs'),
      totalMetric(run, 'promptTokens'),
      totalMetric(run, 'outputTokens'),
      totalMetric(run, 'reasoningTokens'),
      run.attempts.length,
      input?.promptHash ?? '',
      input?.inputHash ?? '',
      input?.responseSchemaHash ?? '',
      receipt?.receiptHash ?? '',
      receipt?.requestedModel ?? run.modelId,
      receipt?.observedModel ?? '',
      receipt?.modelDigest ?? '',
      receipt?.inferenceHash ?? '',
      receipt?.rawResponseHash ?? '',
      receipt?.validationStatus ?? '',
    ];
  });
  return `${[headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\n')}\n`;
};

const manifestEntry = (
  filename: ExperimentArtifactManifestEntry['filename'],
  mediaType: string,
  bytes: Uint8Array,
): ExperimentArtifactManifestEntry => ({
  filename,
  mediaType,
  sizeBytes: bytes.byteLength,
  sha256: sha256BytesHex(bytes),
});

const renderMethodologyMarkdown = (source: ExperimentCampaignEvidenceDocumentV1): string => {
  const weights = source.decisionSupport.methodology.balancedWeights;
  return [
    '# Metodología del Laboratorio AURA',
    '',
    '## Referencia controlada',
    '',
    source.decisionSupport.methodology.oracle,
    '',
    'Precisión, recall y F1 miden alineación con el ground truth conocido. Como el contrato exige cubrir el registro canónico, estas métricas se conservan como control descriptivo y no reciben peso en el índice equilibrado.',
    '',
    '## Índice equilibrado',
    '',
    `- Fiabilidad: ${(weights.reliability * 100).toFixed(0)} %`,
    `- Soporte de evidencia: ${(weights.evidenceSupport * 100).toFixed(0)} %`,
    `- Seguridad frente a claims sin soporte: ${(weights.hallucinationSafety * 100).toFixed(0)} %`,
    `- Eficiencia: ${(weights.efficiency * 100).toFixed(0)} %`,
    `- Alineación con GT: ${(weights.accuracy * 100).toFixed(0)} %`,
    `- Contrato: ${(weights.contractCompliance * 100).toFixed(0)} %; actúa como gate de validez.`,
    '',
    source.decisionSupport.methodology.note,
    '',
    '## Alcance',
    '',
    'La recomendación aplica a este dataset, estos modelos, estos parámetros y el hardware capturado. No declara un ganador universal.',
    '',
  ].join('\n');
};

export const exportExperimentEvidencePackage = (
  input: ExportExperimentEvidenceInput,
): ExperimentEvidencePackage => {
  const source = buildExperimentCampaignEvidence(input.campaign, input.runs, input.generatedAt);
  const campaignJson = canonicalPrettyJson(source);
  const runsCsv = renderExperimentRunsCsv(source);
  const reportMarkdown = renderExperimentReportMarkdown(source);
  const reportPdf = generateExperimentPdfReport(source, reportMarkdown);
  const selectedConfiguration = buildCampaignPipelineConfiguration(
    source,
    input.selectedCellId,
    input.ollamaBaseUrl,
  );
  const selectedConfigurationJson = canonicalPrettyJson(selectedConfiguration);
  const resultsSummaryJson = canonicalPrettyJson({
    contractId: 'aura.campaign-results-summary.v1',
    contractVersion: '1.0.0',
    generatedAt: source.generatedAt,
    campaignId: source.campaign.campaignId,
    formalValidity: source.formalValidity,
    totals: source.aggregation.totals,
    matrix: source.aggregation.matrix,
    scores: source.decisionSupport.scores,
    recommendations: source.decisionSupport.recommendations,
    selectedConfiguration,
  });
  const methodologyMarkdown = renderMethodologyMarkdown(source);
  const glossaryMarkdown = renderBenchmarkGlossaryMarkdown();

  const manifestPayload = {
    contractId: 'aura.oe4-artifact-manifest.v1' as const,
    contractVersion: '1.0.0' as const,
    campaignId: source.campaign.campaignId,
    generatedAt: source.generatedAt,
    hashAlgorithm: 'SHA-256' as const,
    files: [
      manifestEntry('campaign.json', 'application/json', utf8Bytes(campaignJson)),
      manifestEntry('runs.csv', 'text/csv', utf8Bytes(runsCsv)),
      manifestEntry('report.md', 'text/markdown', utf8Bytes(reportMarkdown)),
      manifestEntry('report.pdf', 'application/pdf', reportPdf.bytes),
      manifestEntry('results-summary.json', 'application/json', utf8Bytes(resultsSummaryJson)),
      manifestEntry('methodology.md', 'text/markdown', utf8Bytes(methodologyMarkdown)),
      manifestEntry('glossary.md', 'text/markdown', utf8Bytes(glossaryMarkdown)),
      manifestEntry('selected-configuration.json', 'application/json', utf8Bytes(selectedConfigurationJson)),
    ],
  };
  const manifest: ExperimentArtifactManifestV1 = {
    ...manifestPayload,
    self: {
      scope: 'canonical manifest payload excluding self',
      sha256: sha256BytesHex(utf8Bytes(canonicalPrettyJson(manifestPayload))),
    },
  };
  const manifestJson = canonicalPrettyJson(manifest);

  return {
    source,
    campaignJson,
    runsCsv,
    reportMarkdown,
    reportPdf,
    resultsSummaryJson,
    methodologyMarkdown,
    glossaryMarkdown,
    selectedConfiguration,
    selectedConfigurationJson,
    manifest,
    manifestJson,
    artifacts: [
      { filename: 'campaign.json', mediaType: 'application/json', content: campaignJson },
      { filename: 'runs.csv', mediaType: 'text/csv', content: runsCsv },
      { filename: 'report.md', mediaType: 'text/markdown', content: reportMarkdown },
      { filename: 'report.pdf', mediaType: 'application/pdf', content: reportPdf.bytes },
      { filename: 'results-summary.json', mediaType: 'application/json', content: resultsSummaryJson },
      { filename: 'methodology.md', mediaType: 'text/markdown', content: methodologyMarkdown },
      { filename: 'glossary.md', mediaType: 'text/markdown', content: glossaryMarkdown },
      { filename: 'selected-configuration.json', mediaType: 'application/json', content: selectedConfigurationJson },
      { filename: 'manifest.json', mediaType: 'application/json', content: manifestJson },
    ],
  };
};
