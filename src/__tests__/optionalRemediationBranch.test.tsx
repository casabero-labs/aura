// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OptionalRemediationNotice, RemediationBranchActions } from '../components/remediation';

describe('OptionalRemediationNotice', () => {
  it('renderiza que la remediación es opcional', () => {
    render(<OptionalRemediationNotice />);

    const notice = screen.getByTestId('optional-remediation-notice');
    expect(notice.textContent).toContain('opcional');
    expect(notice.textContent).toContain('El script de limpieza es una recomendación');
  });

  it('indica que el informe puede exportarse sin script', () => {
    render(<OptionalRemediationNotice />);

    const notice = screen.getByTestId('optional-remediation-notice');
    expect(notice.textContent).toContain('sin necesidad de generar un script');
    expect(notice.textContent).toContain('exportarse');
  });

  it('indica que HITL aplica solo si se aprueba script', () => {
    render(<OptionalRemediationNotice />);

    const notice = screen.getByTestId('optional-remediation-notice');
    expect(notice.textContent).toContain('HITL');
    expect(notice.textContent).toContain('única');
  });

  it('no sugiere que HITL sea obligatorio para el reporte principal', () => {
    render(<OptionalRemediationNotice />);

    const notice = screen.getByTestId('optional-remediation-notice');
    expect(notice.textContent).toContain('El informe diagnóstico ya puede exportarse sin necesidad de generar un script');
  });
});

describe('RemediationBranchActions', () => {
  it('llama onBackToDiagnosticReport al hacer clic en volver', () => {
    const onBack = vi.fn();
    const onExport = vi.fn();

    render(
      <RemediationBranchActions
        onBackToDiagnosticReport={onBack}
        onExportMain={onExport}
      />,
    );

    fireEvent.click(screen.getByTestId('remediation-back-diagnostic-report'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();
  });

  it('llama onExportMain al hacer clic en exportar', () => {
    const onBack = vi.fn();
    const onExport = vi.fn();

    render(
      <RemediationBranchActions
        onBackToDiagnosticReport={onBack}
        onExportMain={onExport}
      />,
    );

    fireEvent.click(screen.getByTestId('remediation-export-main'));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('oculta botón volver cuando showBack es false', () => {
    const onBack = vi.fn();
    const onExport = vi.fn();

    render(
      <RemediationBranchActions
        onBackToDiagnosticReport={onBack}
        onExportMain={onExport}
        showBack={false}
      />,
    );

    expect(screen.queryByTestId('remediation-back-diagnostic-report')).toBeNull();
    expect(screen.getByTestId('remediation-export-main')).toBeTruthy();
  });

  it('oculta botón exportar cuando showExportMain es false', () => {
    const onBack = vi.fn();
    const onExport = vi.fn();

    render(
      <RemediationBranchActions
        onBackToDiagnosticReport={onBack}
        onExportMain={onExport}
        showExportMain={false}
      />,
    );

    expect(screen.queryByTestId('remediation-export-main')).toBeNull();
    expect(screen.getByTestId('remediation-back-diagnostic-report')).toBeTruthy();
  });

  it('renderiza ambos botones con texto claro', () => {
    const onBack = vi.fn();
    const onExport = vi.fn();

    render(
      <RemediationBranchActions
        onBackToDiagnosticReport={onBack}
        onExportMain={onExport}
      />,
    );

    expect(screen.getByTestId('remediation-back-diagnostic-report').textContent).toContain('Volver al perfil definitivo');
    expect(screen.getByTestId('remediation-export-main').textContent).toContain('Ir a exportación principal');
  });
});

describe('RemediationBranchActions integration-style', () => {
  it('permite navegación de ida y vuelta sin bloquear flujo', () => {
    const onBack = vi.fn();
    const onExport = vi.fn();

    const { rerender } = render(
      <RemediationBranchActions
        onBackToDiagnosticReport={onBack}
        onExportMain={onExport}
      />,
    );

    fireEvent.click(screen.getByTestId('remediation-back-diagnostic-report'));
    fireEvent.click(screen.getByTestId('remediation-export-main'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);

    rerender(
      <RemediationBranchActions
        onBackToDiagnosticReport={vi.fn()}
        onExportMain={vi.fn()}
        showBack={false}
        showExportMain={false}
      />,
    );

    expect(screen.queryByTestId('remediation-back-diagnostic-report')).toBeNull();
    expect(screen.queryByTestId('remediation-export-main')).toBeNull();
  });
});
