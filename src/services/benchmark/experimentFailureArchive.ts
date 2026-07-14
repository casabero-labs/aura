import { strToU8, zipSync } from 'fflate';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { sha256BytesHex } from '../../contracts/llm/hash';
import { canonicalPrettyJson } from './experimentArtifactExporter';
import type { ExperimentCampaignV1, ExperimentRunV1 } from './experimentTypes';

export interface ExperimentFailureArchive {
  filename: string;
  bytes: Uint8Array;
  manifest: {
    contractId: 'aura.experiment-failure-manifest.v1';
    generatedAt: string;
    campaignId: string;
    runId: string;
    rawDatasetIncluded: false;
    files: Array<{ filename: string; sizeBytes: number; sha256: string }>;
  };
}

interface BuildExperimentFailureArchiveInput {
  campaign: ExperimentCampaignV1;
  run: ExperimentRunV1;
  generatedAt: string;
}

const safeSegment = (value: string): string => value
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

export const buildExperimentFailureArchive = ({
  campaign,
  run,
  generatedAt,
}: BuildExperimentFailureArchiveInput): ExperimentFailureArchive => {
  if (run.status !== 'failed') {
    throw new Error('FAILURE_ARCHIVE_REQUIRES_FAILED_RUN');
  }

  const files: Record<string, Uint8Array> = {};
  const addText = (filename: string, content: string): void => {
    files[filename] = strToU8(content);
  };
  const addJson = (filename: string, value: unknown): void => {
    addText(filename, canonicalPrettyJson(value));
  };

  addText('README.txt', [
    'AURA — expediente técnico de una corrida fallida',
    '',
    'Este ZIP sirve para diagnosticar el fallo; no constituye un resultado formal de campaña.',
    'Incluye la entrada exacta, la respuesta cruda, los errores, el recibo y el entorno congelado.',
    'No incluye el CSV original. El payload puede contener muestras transformadas o sensibles; revísalo antes de compartirlo.',
    '',
    `Campaña: ${campaign.campaignId}`,
    `Corrida: ${run.runId}`,
    `Generado: ${generatedAt}`,
    '',
  ].join('\n'));
  addJson('campaign/campaign.json', campaign);
  addJson('run/run.json', run);
  addJson('run/failure-summary.json', {
    campaignId: run.campaignId,
    runId: run.runId,
    sequence: run.sequence,
    modelId: run.modelId,
    inputMode: run.inputMode,
    repetition: run.repetition,
    status: run.status,
    diagnosisStatus: run.diagnosis?.status ?? 'not_started',
    error: run.diagnosis?.error ?? null,
    validationErrors: run.diagnosis?.validationErrors ?? [],
    startedAt: run.diagnosis?.startedAt ?? null,
    completedAt: run.diagnosis?.completedAt ?? null,
  });
  addText('input/system-instruction.txt', run.input.systemInstruction);
  addText('input/user-payload.json', run.input.userPayload);
  addJson('input/response-schema.json', run.input.responseSchema);
  addText('input/exact-prompt.txt', exactDiagnosisPromptV2(run.input));
  addText('output/provider-response.raw.json', run.diagnosis?.rawOutput ?? '');
  addJson('validation/errors.json', run.diagnosis?.validationErrors ?? []);
  addJson('receipts/execution-receipt.json', run.executionReceipt);
  addJson('environment/environment.json', run.environment);
  addJson('attempts/attempt-events.json', run.attempts);

  const manifest = {
    contractId: 'aura.experiment-failure-manifest.v1' as const,
    generatedAt,
    campaignId: campaign.campaignId,
    runId: run.runId,
    rawDatasetIncluded: false as const,
    files: Object.entries(files).map(([filename, bytes]) => ({
      filename,
      sizeBytes: bytes.byteLength,
      sha256: sha256BytesHex(bytes),
    })),
  };
  addJson('manifest.json', manifest);

  return {
    filename: `aura-lab-failure-${String(run.sequence).padStart(2, '0')}-${safeSegment(run.modelId)}.zip`,
    bytes: zipSync(files, { level: 6 }),
    manifest,
  };
};
