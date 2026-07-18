// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('App - Casabero brand contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the exact three-ellipse AuraMark and preserves the AURA lockup', () => {
    render(<App />);

    const brand = screen.getByLabelText('Ir al inicio');
    const mark = brand.querySelector('svg');

    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(mark?.getAttribute('fill')).toBe('none');
    expect(mark?.getAttribute('stroke')).toBe('currentColor');
    expect(mark?.getAttribute('stroke-width')).toBe('1.55');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(mark?.querySelectorAll('ellipse')).toHaveLength(3);
    expect(mark?.querySelectorAll('rect, path, circle, polygon, polyline, line')).toHaveLength(0);
    expect(mark?.querySelectorAll('[stroke]:not(svg)')).toHaveLength(0);
    expect(brand.textContent).toContain('AURA');
  });

  it('keeps the Home CTA identifiable without changing its action semantics', () => {
    render(<App />);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Empezar auditoría' }).disabled).toBe(false);
  });
});
