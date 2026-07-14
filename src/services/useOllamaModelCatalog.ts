import { useCallback, useEffect, useState } from 'react';
import { normalizeEndpoint, type OllamaModelInfo } from './ollamaLocalBridge';
import {
  getCachedOllamaModelCatalog,
  OLLAMA_MODEL_CATALOG_EVENT,
  refreshOllamaModelCatalog,
  type OllamaModelCatalogSnapshot,
} from './ollamaModelCatalog';

export interface OllamaModelCatalogState {
  models: OllamaModelInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useOllamaModelCatalog = (
  endpoint?: string,
  enabled = true,
): OllamaModelCatalogState => {
  const normalized = normalizeEndpoint(endpoint);
  const cached = getCachedOllamaModelCatalog(normalized);
  const [models, setModels] = useState<OllamaModelInfo[]>(cached?.models ?? []);
  const [loading, setLoading] = useState(enabled && !cached);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await refreshOllamaModelCatalog(normalized);
      setModels(snapshot.models);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, normalized]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const current = getCachedOllamaModelCatalog(normalized);
    if (current) {
      setModels(current.models);
      setLoading(false);
    } else {
      void refresh();
    }

    const onCatalog = (event: Event) => {
      const snapshot = (event as CustomEvent<OllamaModelCatalogSnapshot>).detail;
      if (snapshot?.endpoint !== normalized) return;
      setModels(snapshot.models);
      setError(null);
      setLoading(false);
    };
    window.addEventListener(OLLAMA_MODEL_CATALOG_EVENT, onCatalog);
    return () => window.removeEventListener(OLLAMA_MODEL_CATALOG_EVENT, onCatalog);
  }, [enabled, normalized, refresh]);

  return { models, loading, error, refresh };
};
