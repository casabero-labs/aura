import type { AuditExecutionEvidence, AuditReport } from '../../types';
import { _buildEvidenceEnvelopeV2, type AuditReportInput } from '../../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisInputPackageV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { canonicalJson } from '../../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../../contracts/llm/hash';
import type { DiagnosisInputPackageV2, EvidenceEnvelopeV2, InferenceSnapshotV1 } from '../../contracts/llm/types';
import { FINAL_EVALUATION_PROTOCOL, type OE4ModelId } from './finalEvaluationProtocol';
import { buildExperimentSchedule } from './experimentSchedule';
import type {
  EnvironmentSnapshotV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from './experimentTypes';

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
    throw new Error('El reporte activo no corresponde a la forma congelada de synthetic_ground_truth.csv.');
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
  inference?: InferenceSnapshotV1;
  now?: () => string;
}): Promise<FormalCampaignBundle> => {
  const now = input.now ?? (() => new Date().toISOString());
  if (!/^[a-f0-9]{7,40}$/.test(input.appCommit)) {
    throw new Error('El build no contiene un commit Git verificable; no se puede congelar la campaña.');
  }
  const observedDatasetSha256 = await sha256File(input.datasetFile);
  if (observedDatasetSha256 !== FINAL_EVALUATION_PROTOCOL.dataset.sha256) {
    throw new Error('El Laboratorio formal solo acepta synthetic_ground_truth.csv con el SHA-256 congelado.');
  }
  const evidenceEnvelope = buildFormalEvidenceEnvelope(input.report, input.auditEvidence);
  const inference = input.inference ?? { ...FINAL_EVALUATION_PROTOCOL.inference };
  if (
    !Number.isFinite(inference.temperature) || inference.temperature < 0 || inference.temperature > 2
    || !Number.isFinite(inference.topP) || inference.topP <= 0 || inference.topP > 1
    || inference.think !== false
    || !Number.isInteger(inference.numCtx) || inference.numCtx < 4096 || inference.numCtx > 131072
    || !Number.isInteger(inference.numPredict) || inference.numPredict < 512 || inference.numPredict > inference.numCtx
    || !(inference.seed === null || Number.isInteger(inference.seed))
    || typeof inference.keepAlive !== 'string' || inference.keepAlive.trim() === ''
    || !Number.isInteger(inference.timeoutSeconds) || inference.timeoutSeconds < 60 || inference.timeoutSeconds > 3600
  ) {
    throw new Error('La configuración de inferencia no es válida para una campaña formal.');
  }
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
        // The campaign freezes the digest reported by the installed Ollama
        // model at creation time; AURA does not compare against a machine-
        // specific digest hardcoded in the application.
        expectedGgufSha256: preflight.digests[unit.modelId],
        localDigest: preflight.digests[unit.modelId],
      },
      inference: { ...inference },
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
    repetitions: FINAL_EVALUATION_PROTOCOL.repetitions,
    plannedRuns: FINAL_EVALUATION_PROTOCOL.matrix.units,
    configurationHash,
    runIds: runs.map(({ runId }) => runId),
  };
  return { campaign, runs, evidenceEnvelope };
};
