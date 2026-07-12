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
      expect(screen.getByText(/Conectado local/i)).toBeTruthy();
    });

    expect(screen.queryByTestId('ollama-model-missing-warning')).toBeNull();
  });

  it('"Usar este modelo" remains a draft until the user saves', async () => {
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

    expect(localStorageStore.get('aura_ollama_model')).toBeUndefined();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: /Guardar configuración/i })[0]);
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
    expect(screen.queryByText(/Laboratorio avanzado/i)).toBeNull();
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
      render(<SettingsPanel config={configWithoutInputMode} onSave={onSave} onClose={onClose} />);

      const section = await screen.findByTestId('evidence-modes-section');
      expect(section.textContent).toContain('Evidencia que recibe el modelo');

      for (const label of visibleLabels) {
        expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeTruthy();
      }
      for (const label of hiddenLabels) {
        expect(screen.queryByText(label)).toBeNull();
      }
    });

    it('marks "Evidencia equilibrada" as the recommended default option', async () => {
      render(<SettingsPanel config={configWithoutInputMode} onSave={onSave} onClose={onClose} />);

      const balanced = await screen.findByTestId('evidence-mode-smart_sample');
      expect(balanced.getAttribute('aria-checked')).toBe('true');
      expect(screen.getByTestId('evidence-mode-badge-smart_sample')).toBeTruthy();
    });

    it('migrates legacy inputMode "enhanced_registry" to "recommended"', async () => {
      const config: AIConfig = { ...baseConfig, inputMode: 'enhanced_registry' as any };
      render(<SettingsPanel config={config} onSave={onSave} onClose={onClose} />);

      const fullMode = await screen.findByTestId('evidence-mode-recommended');
      expect(fullMode.getAttribute('aria-checked')).toBe('true');
    });

    it('migrates legacy inputMode "copy_paste_bad_samples" to "recommended"', async () => {
      const config: AIConfig = { ...baseConfig, inputMode: 'copy_paste_bad_samples' as any };
      render(<SettingsPanel config={config} onSave={onSave} onClose={onClose} />);

      const fullMode = await screen.findByTestId('evidence-mode-recommended');
      expect(fullMode.getAttribute('aria-checked')).toBe('true');
    });

    it('selecting a different mode calls onSave with the new inputMode on user save', async () => {
      render(<SettingsPanel config={configWithoutInputMode} onSave={onSave} onClose={onClose} />);

      const minimal = await screen.findByTestId('evidence-mode-prompt_libre');
      fireEvent.click(minimal);
      const saveButtons = screen.getAllByRole('button', { name: /Guardar configuración/i });
      fireEvent.click(saveButtons[saveButtons.length - 1]);

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ inputMode: 'prompt_libre' }));
    });
  });
});
