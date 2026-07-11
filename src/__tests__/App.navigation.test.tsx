// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('App - Issue #25 navigation surface', () => {
  beforeEach(() => {
    localStorage.clear();
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
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('AURA').length).toBeGreaterThan(0);
    });

    const auditButtons = screen.getAllByRole('button', { name: /^Auditoría$/i });
    auditButtons[0].click();

    await waitFor(() => {
      expect(document.getElementById('sistema')).toBeTruthy();
    });

    expect(screen.queryByTestId('improvement-run-page')).toBeNull();
  });
});
