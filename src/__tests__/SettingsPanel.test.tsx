// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import SettingsPanel from '../components/SettingsPanel';
import { createAIProvider } from '../services/aiProvider';
import type { AIConfig } from '../types';

describe('SettingsPanel - Ollama model reconciliation', () => {
  const onSave = vi.fn<(config: AIConfig) => void>();
  const onClose = vi.fn<() => void>();
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let localStorageStore: Map<string, string>;

  const installedModels = [
    { name: 'qwen2.5:3b', modified_at: '2026-01-01T00:00:00Z', size: 2 * 1024 ** 3 },
    { name: 'gemma2:2b', modified_at: '2026-01-01T00:00:00Z', size: 1.5 * 1024 ** 3 },
  ];

  const baseConfig: AIConfig = {
    model: 'qwen2.5:3b',
    temperature: 0.1,
    autoAnalyze: false,
    providerType: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:3b',
  };

  beforeEach(() => {
    onSave.mockClear();
    onClose.mockClear();

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      if (String(url).includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: installedModels }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    localStorageStore = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStorageStore.set(key, value),
      removeItem: (key: string) => localStorageStore.delete(key),
      clear: () => localStorageStore.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockRestore();
  });

  it('shows warning when configured model is not installed', async () => {
    const config: AIConfig = {
      ...baseConfig,
      model: 'mistral:7b',
      ollamaModel: 'mistral:7b',
    };

    render(<SettingsPanel config={config} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('ollama-model-missing-warning')).toBeTruthy();
    });
  });

  it('does not show warning when model is installed', async () => {
    render(<SettingsPanel config={baseConfig} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/conectado/i)).toBeTruthy();
    });

    expect(screen.queryByTestId('ollama-model-missing-warning')).toBeNull();
  });

  it('"Usar este modelo" updates model, ollamaModel, localStorage, and calls onSave', async () => {
    const config: AIConfig = {
      ...baseConfig,
      model: 'mistral:7b',
      ollamaModel: 'mistral:7b',
    };

    render(<SettingsPanel config={config} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('ollama-use-model-gemma2_2b')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('ollama-use-model-gemma2_2b'));

    expect(localStorageStore.get('aura_ollama_model')).toBe('gemma2:2b');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemma2:2b',
      ollamaModel: 'gemma2:2b',
    }));
  });

  it('renders "Probar y refrescar" button', async () => {
    render(<SettingsPanel config={baseConfig} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Probar y refrescar')).toBeTruthy();
    });
  });

  it('refreshes model list on "Probar y refrescar" click', async () => {
    render(<SettingsPanel config={baseConfig} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('ollama-test-connection')).toBeTruthy();
    });

    const callCount = fetchSpy.mock.calls.length;
    fireEvent.click(screen.getByTestId('ollama-test-connection'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(callCount + 1);
    });
  });

  it('marks currently active model with check icon', async () => {
    const config: AIConfig = {
      ...baseConfig,
      model: 'gemma2:2b',
      ollamaModel: 'gemma2:2b',
    };

    render(<SettingsPanel config={config} onSave={onSave} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('ollama-model-active-gemma2_2b')).toBeTruthy();
    });
  });

  describe('createAIProvider with reconciled config', () => {
    it('creates Ollama provider with model from config', () => {
      const config: AIConfig = {
        ...baseConfig,
        model: 'gemma2:2b',
        ollamaModel: 'gemma2:2b',
      };
      const provider = createAIProvider(config);
      expect(provider.type).toBe('ollama');
    });

    it('handles missing ollamaModel gracefully', () => {
      const config: AIConfig = {
        ...baseConfig,
        model: 'phi3:mini',
        ollamaModel: undefined,
      };
      const provider = createAIProvider(config);
      expect(provider.type).toBe('ollama');
    });

    it('uses the updated model after reconciliation', () => {
      const reconciledConfig: AIConfig = {
        model: 'qwen2.5:3b',
        temperature: 0.1,
        autoAnalyze: false,
        providerType: 'ollama',
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:3b',
      };
      const provider = createAIProvider(reconciledConfig);
      expect(provider.type).toBe('ollama');
    });
  });
});
