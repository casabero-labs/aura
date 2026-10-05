// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/benchmark/BenchmarkCampaignLab', () => ({
  default: () => <div data-testid="benchmark-campaign-lab-stub" />,
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

describe('App - Casabero brand contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the AURA wordmark as text only, with no icon mark', () => {
    render(<App />);

    const brand = screen.getByLabelText('Ir al inicio');

    expect(brand.querySelector('svg')).toBeNull();
    expect(brand.textContent).toContain('AURA');
  });

  it('keeps the Home CTA identifiable without changing its action semantics', () => {
    render(<App />);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Empezar auditoría' }).disabled).toBe(false);
  });
});
