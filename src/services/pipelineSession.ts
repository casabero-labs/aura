import { PipelineData } from '../components/MainPipeline';
import type { ImprovementRun } from '../types';

const STORAGE_KEY = 'aura_pipeline_session_v1';

/**
 * La sesión persistida guarda etapa y artefactos procesados (informe,
 * evidencia, diagnóstico, plan, contratos, recibos). Nunca guarda filas del
 * dataset: `rawData` se persiste vacío y `improvementRun.simulatedData` (la
 * copia simulada completa) se descarta. Tras recargar, los pasos que necesitan
 * filas piden volver a seleccionar el mismo archivo (SHA-256 comprobado).
 */
export type PipelineSessionSnapshot = Omit<PipelineData, 'file' | 'rawData'> & {
  file: null;
  rawData: [];
  fileMeta?: { name: string; size: number; type: string; lastModified: number };
  savedAt: string;
};

const stripImprovementRunRows = (run: ImprovementRun | null | undefined): ImprovementRun | null => {
  if (!run) return null;
  const { simulatedData: _simulatedData, ...rest } = run;
  return rest;
};

export const toPipelineSessionSnapshot = (data: PipelineData): PipelineSessionSnapshot => {
  const {
    verifiedExecution: _verifiedExecution,
    verifiedEvidence: _verifiedEvidence,
    rawData: _rawData,
    ...rest
  } = data;
  return {
    ...rest,
    file: null,
    rawData: [],
    improvementRun: stripImprovementRunRows(data.improvementRun),
    fileMeta: data.file ? {
      name: data.file.name,
      size: data.file.size,
      type: data.file.type,
      lastModified: data.file.lastModified,
    } : undefined,
    savedAt: new Date().toISOString(),
  };
};

export const savePipelineSession = (data: PipelineData) => {
  try {
    const snapshot = toPipelineSessionSnapshot(data);
    const stored = {
      ...snapshot,
      executionReceipt: snapshot.executionReceipt
        ? {
            contractId: snapshot.executionReceipt.contractId,
            contractVersion: snapshot.executionReceipt.contractVersion,
            runId: snapshot.executionReceipt.runId,
            approvedScriptHash: snapshot.executionReceipt.approvedScriptHash,
            scriptTextSha256: snapshot.executionReceipt.scriptTextSha256,
            beforeDatasetSha256: snapshot.executionReceipt.beforeDatasetSha256,
            afterDatasetSha256: snapshot.executionReceipt.afterDatasetSha256,
            pythonVersion: snapshot.executionReceipt.pythonVersion,
            pandasVersion: snapshot.executionReceipt.pandasVersion,
            platform: snapshot.executionReceipt.platform,
            bundleHash: snapshot.executionReceipt.bundleHash,
            inputReceiptRef: snapshot.executionReceipt.inputReceiptRef,
            evidenceEnvelopeRef: snapshot.executionReceipt.evidenceEnvelopeRef,
            syntax: snapshot.executionReceipt.syntax,
            execution: {
              status: snapshot.executionReceipt.execution.status,
              startedAt: snapshot.executionReceipt.execution.startedAt,
              completedAt: snapshot.executionReceipt.execution.completedAt,
              durationMs: snapshot.executionReceipt.execution.durationMs,
              stdoutSha256: snapshot.executionReceipt.execution.stdoutSha256,
              stderrSha256: snapshot.executionReceipt.execution.stderrSha256,
              error: snapshot.executionReceipt.execution.error,
            },
            output: snapshot.executionReceipt.output,
            receiptHash: snapshot.executionReceipt.receiptHash,
          }
        : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Cuota agotada o almacenamiento no disponible: si se conserva la clave,
    // una recarga restauraría el análisis de OTRO archivo. Se retira.
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
};

export const loadPipelineSession = (): PipelineSessionSnapshot | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Omit<PipelineSessionSnapshot, 'state'> & { state: string };
    // Historical empty-file sessions must never restore a positive report.
    if (snapshot.report && (snapshot.report.rowCount <= 0 || snapshot.report.colCount <= 0)) return null;
    const result = (snapshot.state === 'calibration'
      ? { ...snapshot, state: 'diagnosis' }
      : snapshot) as PipelineSessionSnapshot;
    // Sesiones anteriores guardaban las filas; nunca se rehidratan y se purgan.
    const legacyRows = (Array.isArray((snapshot as { rawData?: unknown }).rawData)
      && ((snapshot as { rawData: unknown[] }).rawData.length > 0))
      || !!result.improvementRun?.simulatedData;
    result.rawData = [];
    result.improvementRun = stripImprovementRunRows(result.improvementRun);
    if (legacyRows) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); } catch {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      }
    }
    if (result.executionState === 'verified') {
      result.executionState = 'awaiting_external_output';
      result.executionValidationError = 'Sesión restaurada. Los archivos CSV y recibo viven solo en memoria; volvé a seleccionarlos para revalidar.';
    }
    // Reaudit evidence (corrected CSV bytes + reports) lives only in memory.
    result.reauditState = 'not_run';
    result.reauditError = '';
    result.verifiedEvidence = null;
    return result;
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return null;
  }
};

export const clearPipelineSession = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable */ }
};

/**
 * J11 — Una sesión restaurada conserva etapa y resultados procesados, pero ni
 * el File original ni sus filas sobreviven a la recarga. Si el snapshot trae
 * fileMeta e informe, la UI debe declarar que el archivo se reimporta.
 */
export const sessionNeedsReimport = (snap: {
  fileMeta?: { name: string; size: number; type: string; lastModified: number } | undefined;
  report?: unknown;
  state?: string;
} | null): boolean => {
  if (!snap) return false;
  return !!snap.fileMeta && !!snap.report && snap.state !== 'upload';
};
