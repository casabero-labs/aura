// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearOllamaModelCatalogCache,
  getCachedOllamaModelCatalog,
  ollamaModelDisplayName,
  refreshOllamaModelCatalog,
} from '../services/ollamaModelCatalog';

afterEach(() => {
  clearOllamaModelCatalogCache();
  vi.unstubAllGlobals();
});

describe('dynamic Ollama model catalog', () => {
  it('uses only the models returned by the active Ollama /api/tags endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        models: [
          { name: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL', size: 3_587_679_553, modified_at: '2026-07-14T00:00:00Z' },
          { name: 'custom:latest', size: 1_000, modified_at: '2026-07-14T00:00:00Z' },
        ],
      }),
    } as Response)));

    const snapshot = await refreshOllamaModelCatalog('http://127.0.0.1:11434');

    expect(snapshot.models.map((model) => model.name)).toEqual([
      'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
      'custom:latest',
    ]);
    expect(ollamaModelDisplayName(snapshot.models[0])).toContain('Qwen 3.5 4B');
    expect(ollamaModelDisplayName(snapshot.models[1])).toBe('custom:latest');
    expect(getCachedOllamaModelCatalog('http://127.0.0.1:11434')?.models).toEqual(snapshot.models);
  });
});
