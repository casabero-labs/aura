import { fetchOllamaModels, normalizeEndpoint, type OllamaModelInfo } from './ollamaLocalBridge';
import { OLLAMA_MODELS } from './modelRegistry';

export const OLLAMA_MODEL_CATALOG_EVENT = 'aura:ollama-model-catalog-updated';

export interface OllamaModelCatalogSnapshot {
  endpoint: string;
  models: OllamaModelInfo[];
  checkedAt: string;
}

const snapshots = new Map<string, OllamaModelCatalogSnapshot>();
const pending = new Map<string, Promise<OllamaModelCatalogSnapshot>>();

export const ollamaModelId = (model: OllamaModelInfo): string => model.name || model.model || '';

export const ollamaModelDisplayName = (model: OllamaModelInfo | string): string => {
  const id = typeof model === 'string' ? model : ollamaModelId(model);
  return OLLAMA_MODELS.find((entry) => entry.id === id)?.name ?? id;
};

export const getCachedOllamaModelCatalog = (
  endpoint?: string,
): OllamaModelCatalogSnapshot | null => snapshots.get(normalizeEndpoint(endpoint)) ?? null;

const announce = (snapshot: OllamaModelCatalogSnapshot): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OllamaModelCatalogSnapshot>(
    OLLAMA_MODEL_CATALOG_EVENT,
    { detail: snapshot },
  ));
};

/**
 * Reads the operational model catalog directly from the active Ollama server.
 * Static registry entries are used only to provide friendly labels.
 */
export const refreshOllamaModelCatalog = async (
  endpoint?: string,
): Promise<OllamaModelCatalogSnapshot> => {
  const normalized = normalizeEndpoint(endpoint);
  const active = pending.get(normalized);
  if (active) return active;

  const request = fetchOllamaModels(normalized).then((models) => {
    const snapshot: OllamaModelCatalogSnapshot = {
      endpoint: normalized,
      models: models.filter((model) => ollamaModelId(model).length > 0),
      checkedAt: new Date().toISOString(),
    };
    snapshots.set(normalized, snapshot);
    announce(snapshot);
    return snapshot;
  }).finally(() => {
    pending.delete(normalized);
  });
  pending.set(normalized, request);
  return request;
};

export const clearOllamaModelCatalogCache = (): void => {
  snapshots.clear();
  pending.clear();
};
