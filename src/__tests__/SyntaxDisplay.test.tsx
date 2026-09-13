// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SyntaxDisplay from '../components/SyntaxDisplay';

describe('SyntaxDisplay', () => {
  it('shows a technical artifact with the showcase-ink structure', () => {
    render(<SyntaxDisplay filename="diagnosis.json" content={'{"status":"valid"}'} />);

    expect(screen.getByText('diagnosis.json').classList.contains('syntax-display__filename')).toBe(true);
    expect(screen.getByText('{"status":"valid"}').closest('pre')?.classList.contains('syntax-display__body')).toBe(true);
    expect(screen.getByRole('button', { name: 'Copiar diagnosis.json' }).textContent).toBe('Copiar');
  });

  it('copies the complete artifact and confirms the action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<SyntaxDisplay filename="prompt.txt" content="evidencia reproducible" />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar prompt.txt' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('evidencia reproducible'));
    expect(screen.getByRole('button', { name: 'Copiar prompt.txt' }).textContent).toBe('Copiado');
  });

  it('keeps a live provider stream at its newest content', () => {
    const { rerender } = render(
      <SyntaxDisplay filename="stream.json" content="{" autoScroll contentTestId="stream-content" />,
    );
    const body = screen.getByTestId('stream-content');
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 420 });

    rerender(
      <SyntaxDisplay filename="stream.json" content={'{"contractId":"aura.diagnosis.v2"}'} autoScroll contentTestId="stream-content" />,
    );

    expect(body.scrollTop).toBe(420);
  });
});
