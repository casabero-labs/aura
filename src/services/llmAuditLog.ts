import { AIConfig, AuditReport } from '../types';

export interface LlmAuditEntry {
  id: string;
  timestamp: string;
  callType: 'diagnosis' | 'script_generation' | 'benchmark';
  providerType: 'local' | 'cloud' | 'chrome' | 'ollama' | 'webllm_experimental';
  provider: string;
  model: string;
  temperature: number;
  promptHash: string;
  promptText: string;
  inputJsonHash: string;
  promptLength: number;
  inputColumnCount: number;
  inputIssueCount: number;
  rowCount: number;
  colCount: number;
  datasetFingerprint: string;
  responseLength: number;
  latencyMs: number;
  tokensGenerated: number;
  status: 'completed' | 'error' | 'stopped';
  error?: string;
}

const STORAGE_KEY = 'aura_llm_audit_log';
const MAX_ENTRIES = 200;

const hashString = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const computePromptHash = (prompt: string): string => hashString(prompt);

export const computeInputHash = (report: AuditReport): string =>
  hashString(JSON.stringify({
    rows: report.rowCount,
    cols: report.colCount,
    score: report.score,
    issues: report.issues.map(i => ({ id: i.id, rule: i.ruleName, col: i.column, severity: i.severity })),
  }));

export const recordLlmCall = (entry: Omit<LlmAuditEntry, 'id' | 'timestamp'>): LlmAuditEntry => {
  const fullEntry: LlmAuditEntry = {
    ...entry,
    id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    const existing = getAuditLog();
    const next = [fullEntry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — log is best-effort
  }

  return fullEntry;
};

export const getAuditLog = (): LlmAuditEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearAuditLog = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const exportAuditLog = (): string => {
  const entries = getAuditLog();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    entries,
  }, null, 2);
};

export const downloadAuditLog = (): void => {
  const content = exportAuditLog();
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aura_llm_audit_log_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getAuditStats = () => {
  const entries = getAuditLog();
  const byProvider = {} as Record<string, number>;
  const byModel = {} as Record<string, number>;
  const byStatus = {} as Record<string, number>;
  let totalLatency = 0;
  let completedCount = 0;

  entries.forEach(e => {
    byProvider[e.providerType] = (byProvider[e.providerType] || 0) + 1;
    byModel[e.model] = (byModel[e.model] || 0) + 1;
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    if (e.status === 'completed') {
      totalLatency += e.latencyMs;
      completedCount++;
    }
  });

  return {
    totalEntries: entries.length,
    byProvider,
    byModel,
    byStatus,
    avgLatencyMs: completedCount > 0 ? Math.round(totalLatency / completedCount) : 0,
  };
};
