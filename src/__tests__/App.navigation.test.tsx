// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../components/benchmark/BenchmarkCampaignLab', () => ({
  default: () => <div data-testid="benchmark-campaign-lab-stub" />,
}));

vi.mock('../services/api', () => ({
  loadFromApi: vi.fn().mockResolvedValue(null),
  syncToApi: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/pipelineSession', () => ({
  loadPipelineSession: () => null,
  savePipelineSession: vi.fn(),
  clearPipelineSession: vi.fn(),
}));

vi.mock('../services/aiProvider', () => ({
  createAIProvider: () => ({
    type: 'chrome',
    unloadModel: vi.fn().mockResolvedValue(undefined),
  }),
}));

import App from '../App';

describe('App - accessible global navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render any "Health Delta" button in desktop or mobile nav', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('AURA').length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole('button', { name: /^Health Delta$/i })).toBeNull();
  });

  it('keeps work destinations and labeled utilities available', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('AURA').length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole('button', { name: /^Home$/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Auditoría$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Laboratorio$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Configuración$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Ayuda$/i }).length).toBeGreaterThan(0);
  });

  it('exposes the AURA mark as Inicio operable with Enter and Space', async () => {
    const user = userEvent.setup();
    render(<App />);

    const brand = await screen.findByRole('button', { name: 'Ir al inicio' });
    expect(brand.getAttribute('type')).toBe('button');

    await user.click(screen.getByRole('button', { name: 'Auditoría' }));
    expect(brand.getAttribute('aria-current')).toBeNull();
    brand.focus();
    await user.keyboard('{Enter}');
    expect(brand.getAttribute('aria-current')).toBe('page');

    await user.click(screen.getByRole('button', { name: 'Auditoría' }));
    brand.focus();
    await user.keyboard(' ');
    expect(brand.getAttribute('aria-current')).toBe('page');
  });

  it('opens configuration as a drawer without hiding the current view', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Auditar un CSV' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Configuración' }));

    expect(screen.getByTestId('utility-drawer')).toBeTruthy();
    expect(screen.getByTestId('settings-workspace')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Auditar un CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Configuración' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('returns focus to Configuración after closing the drawer with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);

    const config = screen.getByRole('button', { name: 'Configuración' });
    await user.click(config);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement).toBe(config));
    expect(screen.queryByTestId('utility-drawer')).toBeNull();
  });
});
