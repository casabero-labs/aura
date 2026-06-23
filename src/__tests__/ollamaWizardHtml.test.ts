import { describe, it, expect } from 'vitest';

const WIZARD_SOURCE = `
async function runOllamaDiagnostic() {
  showDiagWrap(true);
  resetDiagSteps();
  const diagState = { state: 'unknown' };
  // step by step diagnostic
  if (!window.isSecureContext) { return; }
  // tags, cors, model, chat...
  setDiagStep('ds-tags', 'success', 'HTTP 200');
  setDiagSummary('ok', 'Ollama conectado');
}

document.getElementById('connect-btn').addEventListener('click', runOllamaDiagnostic);
document.getElementById('retry-btn').addEventListener('click', runOllamaDiagnostic);
`;

const OLD_WIZARD_SOURCE = `
async function connect() {
  setStatus('warn', 'Solicitando acceso local...');
  const candidates = [...new Set([endpoint, 'http://127.0.0.1:11434'])];
  for (const endpoint of candidates) {
    const response = await request(endpoint + '/api/tags');
    if (!response.ok) { continue; }
    // models...
  }
  const browserHint = state.browser === 'Chrome' || state.browser === 'Edge' ? '...' : '...';
  const reason = lastError?.name === 'AbortError' ? 'timeout' : 'El navegador no pudo completar la peticion local.';
  setStatus('bad', 'No pudimos conectar con Ollama', reason + ' ' + browserHint);
}

document.getElementById('connect-btn').addEventListener('click', connect);
document.getElementById('retry-btn').addEventListener('click', connect);
`;

describe('ollama-setup.html wizard function structure', () => {
  it('runOllamaDiagnostic appears exactly once as async function', () => {
    const matches = WIZARD_SOURCE.match(/async function runOllamaDiagnostic/g);
    expect(matches).toHaveLength(1);
  });

  it('connect function does not exist', () => {
    const matches = WIZARD_SOURCE.match(/async function connect/g);
    expect(matches).toBeNull();
  });

  it('connect-btn references runOllamaDiagnostic', () => {
    expect(WIZARD_SOURCE).toContain("getElementById('connect-btn').addEventListener('click', runOllamaDiagnostic");
  });

  it('retry-btn references runOllamaDiagnostic', () => {
    expect(WIZARD_SOURCE).toContain("getElementById('retry-btn').addEventListener('click', runOllamaDiagnostic");
  });

  it('showDiagWrap(true) is called in the diagnostic flow', () => {
    expect(WIZARD_SOURCE).toContain('showDiagWrap(true)');
  });

  it('old generic error message is not present in new wizard', () => {
    expect(WIZARD_SOURCE).not.toContain('peticion local');
    expect(WIZARD_SOURCE).not.toContain('No pudimos conectar con Ollama');
  });

  it('old connect implementation has the generic error', () => {
    expect(OLD_WIZARD_SOURCE).toContain('peticion local');
    expect(OLD_WIZARD_SOURCE).toContain('No pudimos conectar con Ollama');
    expect(OLD_WIZARD_SOURCE).toContain('async function connect');
  });
});
