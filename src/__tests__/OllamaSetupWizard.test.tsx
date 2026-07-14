// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OllamaSetupWizard from '../components/OllamaSetupWizard';
import { FINAL_EVALUATION_OLLAMA_MODEL_IDS } from '../services/modelRegistry';

afterEach(() => vi.unstubAllGlobals());

describe('OllamaSetupWizard', () => {
  it('guides macOS Homebrew users without launching a duplicate Ollama server', () => {
    render(<OllamaSetupWizard endpoint="http://127.0.0.1:11434" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'macOS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByTestId('ollama-macos-service-guide')).toBeTruthy();
    expect(screen.getByTestId('ollama-macos-homebrew-command').textContent).toContain('brew services restart ollama');
    expect(screen.getByTestId('ollama-macos-app-command').textContent).toContain('open -a Ollama');
    expect(screen.getByTestId('ollama-macos-verify-command').textContent).toContain('Origin:');
    expect(screen.getByTestId('ollama-macos-address-in-use').textContent).toContain('bind: address already in use');
    expect(screen.getByTestId('ollama-macos-service-guide').textContent).not.toContain('OLLAMA_ORIGINS="http://localhost:3000" ollama serve');
  });

  it('downloads a recommended model and exposes the real progress reported by Ollama', async () => {
    const model = FINAL_EVALUATION_OLLAMA_MODEL_IDS[0];
    const stream = [
      JSON.stringify({ status: 'pulling manifest' }),
      JSON.stringify({ status: 'downloading', completed: 50, total: 100 }),
      JSON.stringify({ status: 'success' }),
      '',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/pull')) return new Response(stream, { status: 200 });
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({
          models: [{ name: model, modified_at: '2026-07-12T00:00:00Z', size: 4_000_000_000 }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    }));

    render(<OllamaSetupWizard endpoint="http://127.0.0.1:11434" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya configuré y reinicié Ollama' }));

    for (const formalModel of FINAL_EVALUATION_OLLAMA_MODEL_IDS) {
      expect(screen.getByText(`ollama run ${formalModel}`)).toBeTruthy();
    }
    expect(screen.queryByText(/DeepSeek-R1-0528/i)).toBeNull();

    const downloadId = `ollama-download-${model.replace(/[^a-zA-Z0-9]/g, '-')}`;
    fireEvent.click(screen.getByTestId(downloadId));

    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: /Descarga de Qwen 3\.5 4B/i }).getAttribute('aria-valuenow')).toBe('100');
    });
    expect(screen.getByTestId('ollama-setup-log').textContent).toContain('instalación terminada y modelo detectado');
    expect(screen.getByTestId('ollama-setup-log').classList.contains('syntax-display')).toBe(true);
    expect(screen.getByRole('button', { name: 'Copiar ollama.setup.log' })).toBeTruthy();
    expect(screen.getByTestId(`ollama-formal-model-${model.replace(/[^a-zA-Z0-9]/g, '-')}`).textContent).toContain('Instalado');
  });
});
