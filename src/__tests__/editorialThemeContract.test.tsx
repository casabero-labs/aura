// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

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

it('declares Editorial 1.2 as the single AURA theme', () => {
  const design = readFileSync(join(process.cwd(), '..', 'DESIGN.md'), 'utf8');
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  const tokens = readFileSync(join(process.cwd(), 'styles/editorial-tokens.css'), 'utf8');

  render(<App />);

  expect(design).toContain('theme: "Casabero Editorial"');
  expect(design).toContain('standard_version: "1.2.0"');
  expect(document.querySelector('.aura-system')?.getAttribute('data-casabero-theme')).toBe('editorial');
  expect(html).toContain('family=Source+Serif+4');
  expect(html).toContain('family=Source+Sans+3');
  expect(html).not.toMatch(/Playfair|JetBrains|family=Inter/);
  expect(tokens).toContain('--editorial-canvas: #FFFFFF');
  expect(tokens).toContain('--editorial-ink: #191919');
  expect(tokens).toContain('--editorial-line: #D9D9D4');
  expect(tokens).toContain('--font-reading: "Source Serif 4"');
  expect(tokens).toContain('--font-operation: "Source Sans 3"');
  expect(tokens).not.toContain('[data-theme="dark"]');
});
