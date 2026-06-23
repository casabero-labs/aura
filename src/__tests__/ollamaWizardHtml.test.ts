import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const WIZARD_PATH = resolve(__dirname, '../public/ollama-setup.html');

function getWizardSource() {
  return readFileSync(WIZARD_PATH, 'utf-8');
}

describe('ollama-setup.html source validation', () => {
  const src = getWizardSource();

  it('runOllamaDiagnostic exists exactly once', () => {
    const matches = src.match(/async function runOllamaDiagnostic/g);
    expect(matches).toHaveLength(1);
  });

  it('async function connect does not exist', () => {
    const matches = src.match(/async function connect/g);
    expect(matches).toBeNull();
  });

  it('connect-btn listener references runOllamaDiagnostic', () => {
    expect(src).toMatch(/getElementById\(['"]connect-btn['"]\).*addEventListener\(['"]click['"],\s*runOllamaDiagnostic/);
  });

  it('retry-btn listener references runOllamaDiagnostic', () => {
    expect(src).toMatch(/getElementById\(['"]retry-btn['"]\).*addEventListener\(['"]click['"],\s*runOllamaDiagnostic/);
  });

  it('showDiagWrap(true) is called in the diagnostic flow', () => {
    expect(src).toContain('showDiagWrap(true)');
  });

  it('old generic error message is not present', () => {
    expect(src).not.toContain('El navegador no pudo completar la peticion local');
    expect(src).not.toContain('No pudimos conectar con Ollama');
  });
});
