// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BenchmarkGlossary from '../components/benchmark/BenchmarkGlossary';
import { BENCHMARK_GLOSSARY, renderBenchmarkGlossaryMarkdown } from '../services/benchmark/benchmarkGlossary';

describe('BenchmarkGlossary', () => {
  it('explains the full experimental vocabulary in plain Spanish', () => {
    render(<BenchmarkGlossary />);

    expect(screen.getByRole('heading', { name: 'Glosario para entender los resultados' })).toBeTruthy();
    for (const term of ['Ground truth (GT)', 'Precisión', 'Recall', 'F1', 'numCtx', 'numPredict']) {
      expect(screen.getByText(term)).toBeTruthy();
    }
    expect(BENCHMARK_GLOSSARY.length).toBeGreaterThanOrEqual(18);
  });

  it('renders the same glossary as an exportable Markdown document', () => {
    const markdown = renderBenchmarkGlossaryMarkdown();
    expect(markdown).toContain('# Glosario del Laboratorio AURA');
    expect(markdown).toContain('## Ground truth (GT)');
    expect(markdown).toContain('## F1');
    expect(markdown).toContain('## numPredict');
  });
});
