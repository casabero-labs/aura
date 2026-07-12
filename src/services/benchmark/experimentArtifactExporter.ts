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

export interface ExperimentArtifactManifestEntry {
  filename: 'campaign.json' | 'runs.csv' | 'report.md' | 'report.pdf';
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
  manifest: ExperimentArtifactManifestV1;
  manifestJson: string;
  artifacts: Array<{
    filename: 'campaign.json' | 'runs.csv' | 'report.md' | 'report.pdf' | 'manifest.json';
    mediaType: string;
    content: string | Uint8Array;
  }>;
}

export interface ExportExperimentEvidenceInput {
  campaign: ExperimentCampaignV1;
  runs: readonly ExperimentRunV1[];
  generatedAt: string;
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
): number | null => {
  const values = [run.diagnosis?.metrics?.[key], run.script?.metrics?.[key]]
    .filter((value): value is number => value !== null && value !== undefined);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
};

export const renderExperimentRunsCsv = (
  document: ExperimentCampaignEvidenceDocumentV1,
): string => {
  const representativeIds = new Set(document.representatives.map((representative) => representative.runId));
  const headers = [
    'campaign_id', 'run_id', 'sequence', 'model_id', 'input_mode', 'repetition',
    'status', 'representative', 'diagnosis_status', 'script_status', 'tp', 'fp',
    'fn', 'precision', 'recall', 'f1', 'engine_coverage', 'evidence_fidelity',
    'contract_compliant', 'invented_columns', 'unsupported_claims', 'anchoring_score',
    'script_contract_valid', 'script_syntax_valid', 'script_safe', 'missing_actions',
    'unsupported_actions', 'latency_total_ms', 'prompt_tokens', 'output_tokens',
    'reasoning_tokens', 'clarity', 'traceability', 'actionability', 'human_mean',
    'hitl_status', 'execution_status', 'before_score', 'after_score', 'outcome',
    'attempt_event_count',
    'prompt_hash', 'input_hash', 'response_schema_hash', 'receipt_hash',
    'requested_model', 'observed_model', 'model_digest', 'inference_hash',
    'raw_response_hash', 'validation_status',
  ];
  const rows = document.runs.map((run) => {
    const diagnosis = run.automaticEvaluation?.diagnosis;
    const script = run.automaticEvaluation?.script;
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
      representativeIds.has(run.runId),
      run.diagnosis?.status,
      run.script?.status,
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
      script?.contractValid,
      script?.syntaxValid,
      script?.safe,
      script?.missingActions.join('|'),
      script?.unsupportedActions.join('|'),
      totalMetric(run, 'totalDurationMs'),
      totalMetric(run, 'promptTokens'),
      totalMetric(run, 'outputTokens'),
      totalMetric(run, 'reasoningTokens'),
      run.humanReview?.clarity,
      run.humanReview?.traceability,
      run.humanReview?.actionability,
      run.humanReview?.mean,
      run.hitl?.status,
      run.execution?.status,
      run.execution?.reaudit?.beforeScore,
      run.execution?.reaudit?.afterScore,
      run.execution?.reaudit?.outcome,
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

export const exportExperimentEvidencePackage = (
  input: ExportExperimentEvidenceInput,
): ExperimentEvidencePackage => {
  const source = buildExperimentCampaignEvidence(input.campaign, input.runs, input.generatedAt);
  const campaignJson = canonicalPrettyJson(source);
  const runsCsv = renderExperimentRunsCsv(source);
  const reportMarkdown = renderExperimentReportMarkdown(source);
  const reportPdf = generateExperimentPdfReport(source, reportMarkdown);

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
    manifest,
    manifestJson,
    artifacts: [
      { filename: 'campaign.json', mediaType: 'application/json', content: campaignJson },
      { filename: 'runs.csv', mediaType: 'text/csv', content: runsCsv },
      { filename: 'report.md', mediaType: 'text/markdown', content: reportMarkdown },
      { filename: 'report.pdf', mediaType: 'application/pdf', content: reportPdf.bytes },
      { filename: 'manifest.json', mediaType: 'application/json', content: manifestJson },
    ],
  };
};
