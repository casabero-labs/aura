// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ProvidersSection from '../components/settings/ProvidersSection';
import PrivacySection from '../components/settings/PrivacySection';
import type { AIConfig } from '../types';

const renderProviders = (ollamaBaseUrl: string) => render(
  <ProvidersSection
    config={{ providerType: 'ollama', model: 'qwen3:8b', temperature: 0.1, ollamaBaseUrl } as AIConfig}
    onChange={vi.fn()}
    setProviderType={vi.fn()}
    chromeDiagnostic={null}
    chromeProgress={null}
    isPreparingChrome={false}
    onCheckChrome={vi.fn()}
    onPrepareChrome={vi.fn()}
    ollamaConnected={false}
    ollamaModels={[]}
    ollamaLoading={false}
    onTestOllama={vi.fn()}
    onOpenOllamaWizard={vi.fn()}
    onUseOllamaModel={vi.fn()}
  />,
);

describe('Settings: Ollama solo en este equipo', () => {
  afterEach(() => cleanup());

  it('marca un endpoint de otra máquina como inválido y no permite probarlo', () => {
    renderProviders('http://192.168.1.5:11434');
    expect(screen.getByTestId('ollama-endpoint-not-local').textContent).toMatch(/192\.168\.1\.5:11434.*no es una dirección de este equipo/);
    expect(screen.getByTestId('ollama-endpoint-input').getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByTestId('ollama-test-connection') as HTMLButtonElement).disabled).toBe(true);
  });

  it('acepta loopback sin aviso', () => {
    renderProviders('http://127.0.0.1:11434');
    expect(screen.queryByTestId('ollama-endpoint-not-local')).toBeNull();
    expect((screen.getByTestId('ollama-test-connection') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Privacidad no afirma «100 % local» si el endpoint configurado no es loopback', () => {
    render(<PrivacySection activeProviderType="ollama" ollamaBaseUrl="https://example.com" />);
    expect(screen.getByTestId('privacy-ollama-blocked').textContent).toMatch(/bloqueado/);
    expect(screen.getByTestId('privacy-current').textContent).not.toMatch(/100 % local/);
  });

  it('Privacidad no menciona sincronización con una API', () => {
    render(<PrivacySection activeProviderType="chrome" />);
    expect(screen.queryByTestId('privacy-config-sync')).toBeNull();
    expect(document.body.textContent).not.toMatch(/sincronizan con la API/);
  });
});
