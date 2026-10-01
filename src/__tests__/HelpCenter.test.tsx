// @vitest-environment jsdom

/**
 * AURA-CONTENT-001 (P2) — La Ayuda describe exactamente el flujo real
 * y el contrato de recuperación del proveedor (issue #38).
 *
 * Contrato de contenido:
 *  - El flujo principal son cinco etapas:
 *    Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación.
 *  - La remediación (script, revisión humana, ejecución) es rama opcional
 *    desde el reporte diagnóstico.
 *  - Buscar literalmente "proveedor no disponible" devuelve la sección
 *    pertinente con las dos salidas reales.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpCenter from '../components/HelpCenter';

describe('HelpCenter — contrato coherente con el flujo real', () => {
  it('enumera las cinco etapas principales del flujo', () => {
    render(<HelpCenter />);

    const flow = screen.getByTestId('help-section-flujo-completo');
    const text = flow.textContent ?? '';

    expect(text).toContain('1. Carga');
    expect(text).toContain('2. Perfil base');
    expect(text).toContain('3. Diagnóstico');
    expect(text).toContain('4. Reporte diagnóstico');
    expect(text).toContain('5. Exportación');
  });

  it('declara script, revisión y ejecución como rama opcional de remediación', () => {
    render(<HelpCenter />);

    const flow = screen.getByTestId('help-section-flujo-completo');
    const text = flow.textContent ?? '';

    expect(text).toMatch(/rama opcional/i);
    expect(text).toMatch(/script/i);
    expect(text).toMatch(/revisión/i);
    expect(text).toMatch(/ejecución/i);
    expect(text).toMatch(/no es obligatoria/i);
  });

  it('buscar literalmente "proveedor no disponible" devuelve la sección pertinente', async () => {
    const user = userEvent.setup();
    render(<HelpCenter />);

    await user.type(screen.getByPlaceholderText(/Buscar/i), 'proveedor no disponible');

    const section = screen.getByTestId('help-section-proveedor-no-disponible');
    expect(section.textContent ?? '').toMatch(/proveedor no disponible/i);

    await user.click(section.querySelector('.help-center-section-header') as HTMLElement);
    const content = section.textContent ?? '';

    expect(content).toContain('Continuar con informe determinista');
    expect(content).toContain('Cambiar proveedor');
    expect(content).toMatch(/Ollama/i);
  });

  it('declara los proveedores cloud como implementación futura, sin pedir API keys', () => {
    render(<HelpCenter />);

    const privacy = screen.getByTestId('help-section-privacidad').textContent ?? '';
    expect(privacy).toMatch(/implementación futura/i);
    expect(privacy).not.toMatch(/localStorage/);
  });

  it('no tiene botón de retorno: se sale por el menú', () => {
    render(<HelpCenter />);
    expect(screen.queryByRole('button', { name: /^Volver/i })).toBeNull();
  });

  it('la sección de proveedor explica Ollama apagado y Chrome AI con su salida real', async () => {
    const user = userEvent.setup();
    render(<HelpCenter />);

    await user.type(screen.getByPlaceholderText(/Buscar/i), 'proveedor no disponible');
    const section = screen.getByTestId('help-section-proveedor-no-disponible');
    await user.click(section.querySelector('.help-center-section-header') as HTMLElement);

    const content = section.textContent ?? '';
    expect(content).toMatch(/Ollama no disponible/i);
    expect(content).toMatch(/Preparar|preparar Gemini Nano/);
    expect(content).toMatch(/Configuración/);
    expect(content).toMatch(/no fabrica|sin fabricar|no inventa/i);
  });
});
