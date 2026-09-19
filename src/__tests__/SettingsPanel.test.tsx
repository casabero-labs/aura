// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import SettingsPanel from '../components/SettingsPanel';
import type { AIConfig, SettingsSectionId } from '../types';

describe('SettingsPanel - Ollama model reconciliation', () => {
  const onSave = vi.fn<(config: AIConfig) => void>();
  const onClose = vi.fn<() => void>();
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let localStorageStore: Map<string, string>;

  const renderPanel = (config: AIConfig, section: SettingsSectionId = 'ia') => render(
    <SettingsPanel
      config={config}
      onSave={onSave}
      onClose={onClose}
      section={section}
      theme="light"
    />,
  );

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

    renderPanel(config, 'ia');

    await waitFor(() => {
      expect(screen.getByTestId('ollama-model-missing-warning')).toBeTruthy();
    });
  });

  it('does not show warning when model is installed', async () => {
    renderPanel(baseConfig, 'ia');

    await waitFor(() => {
      expect(screen.getByText(/Conectado local/i)).toBeTruthy();
    });

    expect(screen.queryByTestId('ollama-model-missing-warning')).toBeNull();
  });

  it('fills the Ollama selector exclusively from the models installed in /api/tags', async () => {
    renderPanel(baseConfig, 'ia');

    const select = await screen.findByTestId('ollama-model-select') as HTMLSelectElement;
    await waitFor(() => expect(select.options).toHaveLength(2));
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      'qwen2.5:3b',
      'gemma2:2b',
    ]);
    expect(Array.from(select.options).some((option) => option.value === 'mistral:7b')).toBe(false);
  });

  it('"Usar este modelo" remains a draft until the user saves', async () => {
    const config: AIConfig = {
      ...baseConfig,
      model: 'mistral:7b',
      ollamaModel: 'mistral:7b',
    };

    renderPanel(config, 'ia');

    await waitFor(() => {
      expect(screen.getByTestId('ollama-use-model-gemma2_2b')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('ollama-use-model-gemma2_2b'));

    expect(localStorageStore.get('aura_ollama_model')).toBeUndefined();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /Guardar cambios/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemma2:2b',
      ollamaModel: 'gemma2:2b',
    }));
  });

  it('renders "Probar y refrescar" button', async () => {
    renderPanel(baseConfig, 'ia');

    await waitFor(() => {
      expect(screen.getByText('Probar y refrescar')).toBeTruthy();
    });
    expect(screen.queryByText(/Laboratorio avanzado/i)).toBeNull();
    expect(screen.queryByTestId('settings-advanced-link')).toBeNull();
    expect(screen.queryByTestId('settings-lab-link')).toBeNull();
  });

  it('opens the real Ollama assistant inside AURA', async () => {
    renderPanel({ ...baseConfig, model: 'missing:model' }, 'diagnostico');
    const trigger = await screen.findByTestId('ollama-open-setup');
    fireEvent.click(trigger);
    expect(await screen.findByTestId('ollama-setup-wizard')).toBeTruthy();
  });

  it('refreshes model list on "Probar y refrescar" click', async () => {
    renderPanel(baseConfig, 'ia');

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

    renderPanel(config, 'ia');

    await waitFor(() => {
      expect(screen.getByTestId('ollama-model-active-gemma2_2b')).toBeTruthy();
    });
  });

  it('hides temperature control for Chrome AI', () => {
    renderPanel({ ...baseConfig, providerType: 'chrome', model: 'gemini-nano' }, 'ia');

    expect(screen.queryByText('Temperatura del modelo')).toBeNull();
  });

  it('requires an API key field for OpenRouter and does not claim it is ready', async () => {
    renderPanel({
      ...baseConfig,
      providerType: 'cloud', cloudProvider: 'openrouter', model: 'openrouter/test', apiKey: '',
    }, 'ia');

    expect(await screen.findByLabelText('API Key (solo durante esta sesión)')).toBeTruthy();
    expect(await screen.findByText('API key pendiente')).toBeTruthy();
  });

  describe('Evidence modes (Issue #25)', () => {
    const configWithoutInputMode: AIConfig = { ...baseConfig };

    const visibleLabels = [
      'Contexto mínimo',
      'Evidencia equilibrada',
      'Evidencia completa',
    ];
    const hiddenLabels = [
      'Smart sample',
      'Completo',
      'Registro extendido',
      'Muestras problemáticas',
      'Mínimo experimental',
    ];

    it('renders the three human-readable evidence modes in a radiogroup', async () => {
      renderPanel(configWithoutInputMode, 'evidencia');

      const section = await screen.findByTestId('evidence-modes-section');
      expect(section.textContent).toContain('Evidencia');

      for (const label of visibleLabels) {
        expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeTruthy();
      }
      for (const label of hiddenLabels) {
        expect(screen.queryByText(label)).toBeNull();
      }
    });

    it('marks "Evidencia equilibrada" as the recommended default option', async () => {
      renderPanel(configWithoutInputMode, 'evidencia');

      const balanced = await screen.findByTestId('evidence-mode-smart_sample');
      expect(balanced.getAttribute('aria-checked')).toBe('true');
      expect(screen.getByTestId('evidence-mode-badge-smart_sample')).toBeTruthy();
    });

    it('migrates legacy inputMode "enhanced_registry" to "recommended"', async () => {
      const config: AIConfig = { ...baseConfig, inputMode: 'enhanced_registry' as any };
      renderPanel(config, 'evidencia');

      const fullMode = await screen.findByTestId('evidence-mode-recommended');
      expect(fullMode.getAttribute('aria-checked')).toBe('true');
    });

    it('migrates legacy inputMode "copy_paste_bad_samples" to "recommended"', async () => {
      const config: AIConfig = { ...baseConfig, inputMode: 'copy_paste_bad_samples' as any };
      renderPanel(config, 'evidencia');

      const fullMode = await screen.findByTestId('evidence-mode-recommended');
      expect(fullMode.getAttribute('aria-checked')).toBe('true');
    });

    it('selecting a different mode calls onSave with the new inputMode on user save', async () => {
      renderPanel(configWithoutInputMode, 'evidencia');

      const minimal = await screen.findByTestId('evidence-mode-prompt_libre');
      fireEvent.click(minimal);
      fireEvent.click(await screen.findByRole('button', { name: /Guardar cambios/i }));

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ inputMode: 'prompt_libre' }));
    });
  });
});
