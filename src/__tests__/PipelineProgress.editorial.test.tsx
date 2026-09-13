// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PipelineProgress from '../components/PipelineProgress';

describe('Editorial pipeline orientation', () => {
  it('exposes the eight numbered stages and the current step semantically', () => {
    render(<PipelineProgress currentStep="diagnostic_report" onStepClick={vi.fn()} />);

    expect((screen.getByRole('button', { name: '01 · Carga' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '02 · Perfil' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: '04 · Informe' }).getAttribute('aria-current')).toBe('step');
    expect((screen.getByRole('button', { name: /05 · Corrección opcional/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('04 · Informe');
  });

  it('allows only completed history and keeps the optional branch explicit', () => {
    const onStepClick = vi.fn();
    render(<PipelineProgress currentStep="execution" onStepClick={onStepClick} />);

    fireEvent.click(screen.getByRole('button', { name: '03 · Diagnóstico' }));
    fireEvent.click(screen.getByRole('button', { name: '08 · Exportación (pendiente)' }));

    expect(onStepClick).toHaveBeenCalledTimes(1);
    expect(onStepClick).toHaveBeenCalledWith('diagnosis');
    expect(screen.getByRole('status').textContent).toContain('Rama opcional de remediación');
  });
});
