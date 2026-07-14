// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosisHeroPanel } from '../components/diagnosis/DiagnosisHeroPanel';
import { FINAL_EVALUATION_OLLAMA_MODELS } from '../services/modelRegistry';

const baseProps = {
  fileName: 'controlled_customers_phase8.csv',
  rowCount: 50,
  colCount: 15,
  findings: 29,
  hasDiagnosis: false,
  isLoading: false,
  onGenerateDiagnosis: vi.fn(),
  providerName: 'Ollama Local',
  providerAvailable: true,
  model: FINAL_EVALUATION_OLLAMA_MODELS[0].id,
  modelName: FINAL_EVALUATION_OLLAMA_MODELS[0].name,
  inputMode: 'prompt_libre' as const,
  models: FINAL_EVALUATION_OLLAMA_MODELS,
  onQuickConfigSave: vi.fn(),
};

describe('DiagnosisHeroPanel quick configuration', () => {
  it('shows the active model and input method without opening settings', () => {
    render(<DiagnosisHeroPanel {...baseProps} />);
    expect(screen.getByTestId('diagnosis-active-model').textContent).toContain('Qwen 3.5 4B');
    expect(screen.getByTestId('diagnosis-active-input-mode').textContent).toContain('Contexto mínimo');
  });

  it('changes only model and input mode from the compact modal', async () => {
    const user = userEvent.setup();
    const onQuickConfigSave = vi.fn();
    render(<DiagnosisHeroPanel {...baseProps} onQuickConfigSave={onQuickConfigSave} />);

    await user.click(screen.getByTestId('diagnosis-config-toggle'));
    expect(screen.getByRole('dialog', { name: 'Modelo y evidencia' })).not.toBeNull();

    await user.selectOptions(screen.getByTestId('diagnosis-quick-model'), FINAL_EVALUATION_OLLAMA_MODELS[1].id);
    await user.click(screen.getByRole('radio', { name: /Evidencia completa/i }));
    await user.click(screen.getByRole('button', { name: 'Aplicar configuración' }));

    expect(onQuickConfigSave).toHaveBeenCalledWith({
      model: FINAL_EVALUATION_OLLAMA_MODELS[1].id,
      inputMode: 'recommended',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
