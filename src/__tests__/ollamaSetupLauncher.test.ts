import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const INDEX_PATH = resolve(__dirname, '../index.html');
const LAUNCHER_PATH = resolve(__dirname, '../public/ollama-setup-launcher.js');
const ENTRY_PATH = resolve(__dirname, '../index.tsx');

const read = (path: string) => readFileSync(path, 'utf-8');

describe('integrated Ollama setup launcher', () => {
  const index = read(INDEX_PATH);
  const launcher = read(LAUNCHER_PATH);
  const entry = read(ENTRY_PATH);

  it('loads the launcher before the React entrypoint', () => {
    const launcherPosition = index.indexOf('/ollama-setup-launcher.js');
    const reactPosition = index.indexOf('/index.tsx');

    expect(launcherPosition).toBeGreaterThan(-1);
    expect(reactPosition).toBeGreaterThan(-1);
    expect(launcherPosition).toBeLessThan(reactPosition);
  });

  it('intercepts the settings trigger and opens a separate named tab', () => {
    expect(launcher).toContain('[data-testid="ollama-open-setup"]');
    expect(launcher).toContain('window.open(buildSetupUrl(), SETUP_WINDOW_NAME)');
    expect(launcher).toContain("SETUP_WINDOW_NAME = 'aura-ollama-setup'");
  });

  it('routes the tab to the React standalone assistant', () => {
    expect(launcher).toContain("url.searchParams.set('view', 'ollama-setup')");
    expect(entry).toContain("params.get('view') === 'ollama-setup'");
    expect(entry).toContain('<OllamaSetupStandalone />');
    expect(launcher).not.toContain('/ollama-setup-aura.css');
    expect(launcher).not.toContain('dataset.auraIntegrated');
  });

  it('refreshes Ollama status after ready message or tab close', () => {
    expect(launcher).toContain("event.data?.type !== 'aura:ollama-ready'");
    expect(launcher).toContain('[data-testid="ollama-retry-connection"]');
    expect(launcher).toContain('retryButton.click()');
    expect(launcher).toContain('setupWindow.closed');
  });
});
