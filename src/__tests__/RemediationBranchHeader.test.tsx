// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RemediationBranchHeader from '../components/remediation/RemediationBranchHeader';

describe('RemediationBranchHeader', () => {
  it('marca el hito actual y no confunde aprobar con ejecutar', () => {
    render(<RemediationBranchHeader milestone="approval" />);

    const header = screen.getByTestId('remediation-branch-header');
    expect(header.textContent).toContain('Corregir una copia');
    expect(header.textContent).toContain('Aprobar no ejecuta');
    expect(screen.getByText('Aprobación').getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Propuesta').getAttribute('aria-current')).toBeNull();
  });
});
