import { PipelineData } from '../components/MainPipeline';

const STORAGE_KEY = 'aura_pipeline_session_v1';

export type PipelineSessionSnapshot = Omit<PipelineData, 'file'> & {
  file: null;
  fileMeta?: { name: string; size: number; type: string; lastModified: number };
  savedAt: string;
};

export const toPipelineSessionSnapshot = (data: PipelineData): PipelineSessionSnapshot => ({
  ...data,
  file: null,
  fileMeta: data.file ? {
    name: data.file.name,
    size: data.file.size,
    type: data.file.type,
    lastModified: data.file.lastModified,
  } : undefined,
  savedAt: new Date().toISOString(),
});

export const savePipelineSession = (data: PipelineData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPipelineSessionSnapshot(data)));
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
    return snapshot as PipelineSessionSnapshot;
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
