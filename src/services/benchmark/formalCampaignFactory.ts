import type { AuditExecutionEvidence, AuditReport } from '../../types';
import { _buildEvidenceEnvelopeV2, type AuditReportInput } from '../../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../../contracts/llm/hash';
import type { DiagnosisInputPackageV2, EvidenceEnvelopeV2 } from '../../contracts/llm/types';
import { FINAL_EVALUATION_PROTOCOL, type OE4ModelId } from './finalEvaluationProtocol';
import { buildExperimentSchedule } from './experimentSchedule';
import type {
  EnvironmentSnapshotV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from './experimentTypes';

const EXPECTED_GGUF_SHA256: Record<OE4ModelId, string> = {
  'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL': '34a514d08f7449cb4a694a707aaa2eedccb7bb68290121bf5e5a569b2abe71c3',
  'hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL': 'ccd7e4b76a749936b1bea6aabd6118e6a16c61354acc09b367aec2aae8382c72',
  'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL': 'f040f922dfd89f0adc57a16309a7c407d39ad099a3997f47c1370ee1f33c380a',
};

export interface FormalCampaignBundle {
  campaign: ExperimentCampaignV1;
  runs: ExperimentRunV1[];
  evidenceEnvelope: EvidenceEnvelopeV2;
}

interface OllamaTag { name?: string; model?: string; digest?: string }
const MINIMUM_OLLAMA_VERSION = [0, 5, 0] as const;

const assertMinimumOllamaVersion = (version: string): void => {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) throw new Error(`Versión de Ollama no reconocida: ${version}`);
  const observed = match.slice(1).map(Number);
  const meetsMinimum = observed.some((part, index) => part > MINIMUM_OLLAMA_VERSION[index]
    && observed.slice(0, index).every((earlier, earlierIndex) => earlier === MINIMUM_OLLAMA_VERSION[earlierIndex]))
    || observed.every((part, index) => part === MINIMUM_OLLAMA_VERSION[index]);
  if (!meetsMinimum) throw new Error(`Ollama ${version} es inferior al mínimo formal 0.5.0.`);
};

export const buildFormalEvidenceEnvelope = (
  report: AuditReport,
  auditEvidence: AuditExecutionEvidence,
): EvidenceEnvelopeV2 => {
  if (
    report.rowCount !== FINAL_EVALUATION_PROTOCOL.dataset.rows
    || report.colCount !== FINAL_EVALUATION_PROTOCOL.dataset.columns
    || auditEvidence.rowsProcessed !== FINAL_EVALUATION_PROTOCOL.dataset.rows
    || auditEvidence.columnsProcessed !== FINAL_EVALUATION_PROTOCOL.dataset.columns
  ) {
    throw new Error('El reporte activo no corresponde a la forma congelada de controlled_customers_phase8.csv.');
  }
  if (auditEvidence.datasetSha256 !== FINAL_EVALUATION_PROTOCOL.dataset.sha256) {
    throw new Error('El reporte no conserva el SHA-256 exacto del dataset controlado. Vuelve a cargar el CSV original.');
  }
  const compatibleReport: AuditReportInput = {
    ...report,
    datasetProfile: report.datasetProfile ? {
      columns: report.datasetProfile.columns.map((column) => ({
        name: column.name,
        inferredType: column.inferredType,
        semanticType: column.semanticType,
        cardinality: typeof column.cardinality === 'number' ? column.cardinality : undefined,
      })),
    } : undefined,
  } as AuditReportInput;
  return _buildEvidenceEnvelopeV2(compatibleReport, {
    privacyLevel: 'local_full',
    datasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
    delimiter: report.delimiterDetected,
  });
};

const sha256File = async (file: Pick<File, 'arrayBuffer'>): Promise<string> => {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const fetchOllamaPreflight = async (baseUrl: string): Promise<{
  version: string;
  digests: Record<OE4ModelId, string>;
}> => {
  const [versionResponse, tagsResponse] = await Promise.all([
    fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(5_000) }),
    fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) }),
  ]);
  if (!versionResponse.ok || !tagsResponse.ok) throw new Error('Ollama no superó el preflight formal.');
  const versionBody = await versionResponse.json() as { version?: string };
  const tagsBody = await tagsResponse.json() as { models?: OllamaTag[] };
  if (!versionBody.version) throw new Error('Ollama no informó su versión.');
  assertMinimumOllamaVersion(versionBody.version);
  const digests = {} as Record<OE4ModelId, string>;
  for (const modelId of FINAL_EVALUATION_PROTOCOL.models) {
    const installed = tagsBody.models?.find((entry) => entry.name === modelId || entry.model === modelId);
    if (!installed?.digest || !/^(?:sha256:)?[a-f0-9]{64}$/.test(installed.digest)) {
      throw new Error(`Falta el modelo formal o su digest verificable: ${modelId}`);
    }
    digests[modelId] = installed.digest;
  }
  return { version: versionBody.version, digests };
};

const cloneInputSnapshot = (
  pkg: DiagnosisInputPackageV2,
): DiagnosisInputPackageV2 => ({
  ...pkg,
  includedSections: [...pkg.includedSections],
});

export const createFormalCampaignBundle = async (input: {
  report: AuditReport;
  auditEvidence: AuditExecutionEvidence;
  datasetFile: Pick<File, 'arrayBuffer'>;
  ollamaBaseUrl: string;
  appCommit: string;
  now?: () => string;
}): Promise<FormalCampaignBundle> => {
  const now = input.now ?? (() => new Date().toISOString());
  if (!/^[a-f0-9]{7,40}$/.test(input.appCommit)) {
    throw new Error('El build no contiene un commit Git verificable; no se puede congelar la campaña.');
  }
  const observedDatasetSha256 = await sha256File(input.datasetFile);
  if (observedDatasetSha256 !== FINAL_EVALUATION_PROTOCOL.dataset.sha256) {
    throw new Error('El Laboratorio formal solo acepta controlled_customers_phase8.csv con el SHA-256 congelado.');
  }
  const evidenceEnvelope = buildFormalEvidenceEnvelope(input.report, input.auditEvidence);
  const preflight = await fetchOllamaPreflight(input.ollamaBaseUrl);
  const schedule = buildExperimentSchedule();
  const createdAt = now();
  const campaignId = `campaign:oe4:v2:${createdAt.replace(/[^0-9]/g, '')}`;
  const inputs = Object.fromEntries(FINAL_EVALUATION_PROTOCOL.inputModes.map((mode) => [
    mode,
    cloneInputSnapshot(buildDiagnosisInputPackageV2(input.report, evidenceEnvelope, mode)),
  ])) as Record<(typeof FINAL_EVALUATION_PROTOCOL.inputModes)[number], DiagnosisInputPackageV2>;
  const runs = schedule.units.map((unit): ExperimentRunV1 => {
    const environment: EnvironmentSnapshotV1 = {
      contractId: 'aura.environment-snapshot.v1',
      capturedAt: createdAt,
      appCommit: input.appCommit,
      dataset: {
        id: FINAL_EVALUATION_PROTOCOL.dataset.id,
        sha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
        schemaSha256: FINAL_EVALUATION_PROTOCOL.dataset.schemaSha256,
        groundTruthSha256: FINAL_EVALUATION_PROTOCOL.dataset.groundTruthSha256,
      },
      hardware: {
        machine: navigator.platform || 'unknown-browser-platform',
        cpu: `${navigator.hardwareConcurrency || 0} logical cores`,
        memoryBytes: ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 16) * 1024 ** 3,
      },
      runtime: { provider: 'ollama', ollamaVersion: preflight.version, clientVersion: 'aura-browser-ollama-http-v1' },
      model: {
        id: unit.modelId,
        quantization: 'UD-Q4_K_XL',
        expectedGgufSha256: EXPECTED_GGUF_SHA256[unit.modelId],
        localDigest: preflight.digests[unit.modelId],
      },
      inference: { ...FINAL_EVALUATION_PROTOCOL.inference },
    };
    return {
      contractId: 'aura.experiment-run.v1', contractVersion: '1.0.0',
      campaignId, runId: unit.runId.replace('run:oe4:', `run:oe4:v2:${campaignId.split(':').at(-1)}:`),
      protocolId: FINAL_EVALUATION_PROTOCOL.id, protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
      modelId: unit.modelId, inputMode: unit.inputMode, repetition: unit.repetition,
      sequence: unit.sequence, status: 'planned', createdAt, updatedAt: createdAt,
      environment, input: structuredClone(inputs[unit.inputMode]), diagnosis: null, script: null,
      automaticEvaluation: null, humanReview: null, hitl: null, execution: null, attempts: [],
    };
  });
  const configurationHash = sha256hex(canonicalJson({
    protocol: FINAL_EVALUATION_PROTOCOL,
    environment: runs.map(({ modelId, environment }) => ({ modelId, environment })),
    inputs,
  }));
  const campaign: ExperimentCampaignV1 = {
    contractId: 'aura.experiment-campaign.v1', contractVersion: '1.0.0', campaignId,
    protocolId: FINAL_EVALUATION_PROTOCOL.id, protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    status: 'ready', createdAt, updatedAt: createdAt,
    datasetId: FINAL_EVALUATION_PROTOCOL.dataset.id,
    datasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
    modelIds: [...FINAL_EVALUATION_PROTOCOL.models], inputModes: [...FINAL_EVALUATION_PROTOCOL.inputModes],
    repetitions: 5, plannedRuns: 45, configurationHash, runIds: runs.map(({ runId }) => runId),
  };
  return { campaign, runs, evidenceEnvelope };
};
