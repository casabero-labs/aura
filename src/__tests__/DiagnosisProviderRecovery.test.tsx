// @vitest-environment jsdom

/**
 * AURA-UX-001 (P1) — Recuperación explícita cuando el proveedor asistido
 * no está disponible (issue #38).
 *
 * Contrato de presentación:
 *  - Estado "Proveedor no disponible" con causa humana específica por proveedor.
 *  - Cloud sin API key NUNCA se presenta igual que Ollama no disponible.
 *  - Acción visible "Continuar con informe determinista" → onContinue (una vez),
 *    sin fabricar respuesta LLM ni llamar al análisis asistido.
 *  - Acción visible "Cambiar proveedor" → onOpenSettings (una vez).
 *  - La CTA asistida puede quedar deshabilitada mientras la causa sea visible.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiagnosisStep from '../components/DiagnosisStep';
import type { AIConfig, AIProvider, AuditReport } from '../types';
import { clearOllamaModelCatalogCache } from '../services/ollamaModelCatalog';

const OLLAMA_CAUSE = vi.hoisted(() =>
  'Ollama no responde en http://127.0.0.1:11434. Abre la aplicación Ollama en este equipo.');

vi.mock('../services/ollamaLocalBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/ollamaLocalBridge')>();
  return {
    ...actual,
    diagnoseOllamaLocal: vi.fn(async () => ({
      status: 'server_unreachable',
      message: OLLAMA_CAUSE,
      details: {},
    })),
  };
});

const report = {
  score: 100,
  rowCount: 1,
  colCount: 1,
  duplicateRows: 0,
  delimiterDetected: ',',
  columnStats: {},
  issues: [],
  scoreBreakdown: [],
  datasetProfile: { totalRows: 1, totalColumns: 1, columns: [], coalescencePairs: [], pruningCandidates: [], generatedAt: '2026-07-18T00:00:00Z' },
} as unknown as AuditReport;

const cloudConfigWithoutKey: AIConfig = {
  providerType: 'cloud',
  cloudProvider: 'google',
  model: 'gemini-2.5-flash',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  temperature: 0.1,
  autoAnalyze: false,
};

const ollamaConfig: AIConfig = {
  providerType: 'ollama',
  model: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
  ollamaModel: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  temperature: 0.1,
  autoAnalyze: false,
};

const unavailableProvider = (type: 'cloud' | 'ollama'): AIProvider => ({
  name: type === 'cloud' ? 'Google Cloud' : 'Ollama',
  type,
  isAvailable: vi.fn().mockResolvedValue(false),
} as unknown as AIProvider);

interface RenderOverrides {
  config?: AIConfig;
  onContinue?: () => void;
  onOpenSettings?: () => void;
  onAnalysisComplete?: (analysis: string) => void;
  onDiagnosisStarted?: () => void;
}

const renderDiagnosis = (overrides: RenderOverrides = {}) => {
  const config = overrides.config ?? cloudConfigWithoutKey;
  return render(
    <DiagnosisStep
      report={report}
      aiConfig={config}
      aiProvider={unavailableProvider(config.providerType === 'ollama' ? 'ollama' : 'cloud')}
      analysisText=""
      onAiConfigChange={vi.fn()}
      onAnalysisComplete={overrides.onAnalysisComplete ?? vi.fn()}
      onDiagnosisStarted={overrides.onDiagnosisStarted ?? vi.fn()}
      onContinue={overrides.onContinue ?? vi.fn()}
      onOpenSettings={overrides.onOpenSettings ?? vi.fn()}
    />,
  );
};

afterEach(() => {
  clearOllamaModelCatalogCache();
  vi.unstubAllGlobals();
});

const stubFetchWithoutServer = () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  } as Response)));
};

describe('DiagnosisStep — recuperación con proveedor no disponible', () => {
  it('cloud sin API key: causa específica visible, CTA asistida deshabilitada y ambas salidas habilitadas', async () => {
    stubFetchWithoutServer();
    renderDiagnosis();

    const alert = await screen.findByTestId('provider-recovery-alert');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Proveedor no disponible');

    const cause = screen.getByTestId('provider-recovery-cause');
    expect(cause.textContent ?? '').toMatch(/API key/i);
    expect(cause.textContent ?? '').toMatch(/google/i);
    expect(cause.textContent ?? '').not.toMatch(/ollama/i);

    const assistedCta = screen.getByTestId('diagnosis-generate') as HTMLButtonElement;
    expect(assistedCta.disabled).toBe(true);

    const continueBtn = screen.getByRole('button', { name: /Continuar con informe determinista/i }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);

    const settingsBtn = screen.getByRole('button', { name: /Cambiar proveedor/i }) as HTMLButtonElement;
    expect(settingsBtn.disabled).toBe(false);
  });

  it('ollama no disponible: conserva su causa propia y no se presenta como fallo cloud', async () => {
    stubFetchWithoutServer();
    renderDiagnosis({ config: ollamaConfig });

    await screen.findByTestId('provider-recovery-alert');

    const cause = screen.getByTestId('provider-recovery-cause');
    expect(cause.textContent).toContain(OLLAMA_CAUSE);
    expect(cause.textContent ?? '').not.toMatch(/API key/i);

    const assistedCta = screen.getByTestId('diagnosis-generate') as HTMLButtonElement;
    expect(assistedCta.disabled).toBe(true);

    expect((screen.getByRole('button', { name: /Continuar con informe determinista/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /Cambiar proveedor/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Continuar con informe determinista llama onContinue una vez y no dispara análisis asistido', async () => {
    stubFetchWithoutServer();
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onAnalysisComplete = vi.fn();
    const onDiagnosisStarted = vi.fn();
    renderDiagnosis({ onContinue, onAnalysisComplete, onDiagnosisStarted });

    await screen.findByTestId('provider-recovery-alert');
    await user.click(screen.getByRole('button', { name: /Continuar con informe determinista/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onAnalysisComplete).not.toHaveBeenCalled();
    expect(onDiagnosisStarted).not.toHaveBeenCalled();
  });

  it('Cambiar proveedor llama onOpenSettings una vez', async () => {
    stubFetchWithoutServer();
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    renderDiagnosis({ onOpenSettings });

    await screen.findByTestId('provider-recovery-alert');
    await user.click(screen.getByRole('button', { name: /Cambiar proveedor/i }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onOpenSettings).toHaveBeenCalledTimes(1));
  });
});
