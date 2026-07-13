import { PipelineData } from '../components/MainPipeline';

const STORAGE_KEY = 'aura_pipeline_session_v1';

export type PipelineSessionSnapshot = Omit<PipelineData, 'file'> & {
  file: null;
  fileMeta?: { name: string; size: number; type: string; lastModified: number };
  savedAt: string;
};

export const toPipelineSessionSnapshot = (data: PipelineData): PipelineSessionSnapshot => {
  const { verifiedExecution: _verifiedExecution, ...rest } = data;
  return {
    ...rest,
    file: null,
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
  } catch { /* storage unavailable */ }
};

export const loadPipelineSession = (): PipelineSessionSnapshot | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Omit<PipelineSessionSnapshot, 'state'> & { state: string };
    if (snapshot.state === 'calibration') {
      return { ...snapshot, state: 'diagnosis' } as PipelineSessionSnapshot;
    }
    const result = snapshot as PipelineSessionSnapshot;
    if (result.executionState === 'verified') {
      result.executionState = 'awaiting_external_output';
      result.executionValidationError = 'Sesión restaurada. Los archivos CSV y recibo viven solo en memoria; volvé a seleccionarlos para revalidar.';
    }
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
