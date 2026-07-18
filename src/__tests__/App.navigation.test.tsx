// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../components/ImprovementRunPage', () => ({
  default: () => {
    throw new Error('ImprovementRunPage should not be mounted from App.tsx (Issue #25)');
  },
}));

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

  it('keeps other primary nav destinations available', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('AURA').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByRole('button', { name: /^Home$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Auditoría$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Configuración$/i }).length).toBeGreaterThan(0);
  });

  it('does not mount ImprovementRunPage when navigating to Auditoría', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('AURA').length).toBeGreaterThan(0);
    });

    const auditButtons = screen.getAllByRole('button', { name: /^Auditoría$/i });
    await user.click(auditButtons[0]);

    await waitFor(() => {
      expect(document.getElementById('sistema')).toBeTruthy();
    });

    expect(screen.queryByTestId('improvement-run-page')).toBeNull();
  });

  it('exposes the AURA mark as a native Home button operable with Enter and Space', async () => {
    const user = userEvent.setup();
    render(<App />);

    const brand = await screen.findByRole('button', { name: 'Ir al inicio' });
    expect(brand.getAttribute('type')).toBe('button');

    await user.click(screen.getByRole('button', { name: 'Auditoría' }));
    brand.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page');

    await user.click(screen.getByRole('button', { name: 'Auditoría' }));
    brand.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
  });

  it('keeps the closed mobile disclosure outside the accessibility tree and Tab order', async () => {
    render(<App />);

    const toggle = await screen.findByRole('button', { name: 'Abrir menú de navegación' });
    const mobileMenu = document.getElementById('mobile-navigation');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('mobile-navigation');
    expect(mobileMenu?.hasAttribute('hidden')).toBe(true);
    expect(within(mobileMenu as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('opens four canonical mobile destinations in stable order with current-page semantics', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = await screen.findByRole('button', { name: 'Abrir menú de navegación' });
    await user.click(toggle);

    expect(toggle.getAttribute('aria-label')).toBe('Cerrar menú de navegación');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const mobileMenu = document.getElementById('mobile-navigation') as HTMLElement;
    expect(mobileMenu.hasAttribute('hidden')).toBe(false);
    expect(within(mobileMenu).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Home',
      'Auditoría',
      'Laboratorio',
      'Configuración',
    ]);
    expect(within(mobileMenu).getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    expect(within(mobileMenu).queryByRole('button', { name: 'Trazabilidad' })).toBeNull();
  });

  it('closes the mobile disclosure with Escape and restores focus to its toggle', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = await screen.findByRole('button', { name: 'Abrir menú de navegación' });
    await user.click(toggle);
    await user.tab();
    expect(document.activeElement).not.toBe(toggle);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement).toBe(toggle));
    expect(toggle.getAttribute('aria-label')).toBe('Abrir menú de navegación');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
