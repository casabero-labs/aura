import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const INDEX_PATH = resolve(__dirname, '../index.html');
const LAUNCHER_PATH = resolve(__dirname, '../public/ollama-setup-launcher.js');
const STYLES_PATH = resolve(__dirname, '../public/ollama-setup-aura.css');

const read = (path: string) => readFileSync(path, 'utf-8');

describe('integrated Ollama setup launcher', () => {
  const index = read(INDEX_PATH);
  const launcher = read(LAUNCHER_PATH);
  const styles = read(STYLES_PATH);

  it('loads the launcher before the React entrypoint', () => {
    const launcherPosition = index.indexOf('/ollama-setup-launcher.js');
    const reactPosition = index.indexOf('/index.tsx');

    expect(launcherPosition).toBeGreaterThan(-1);
    expect(reactPosition).toBeGreaterThan(-1);
    expect(launcherPosition).toBeLessThan(reactPosition);
  });

  it('intercepts the existing settings trigger and opens a separate tab', () => {
    expect(launcher).toContain('[data-testid="ollama-open-setup"]');
    expect(launcher).toContain('window.open(buildSetupUrl(), SETUP_WINDOW_NAME)');
    expect(launcher).toContain("SETUP_WINDOW_NAME = 'aura-ollama-setup'");
  });

  it('injects the current AURA visual layer into the setup page', () => {
    expect(launcher).toContain('/ollama-setup-aura.css');
    expect(launcher).toContain("dataset.auraIntegrated = 'true'");
    expect(styles).toContain('html[data-aura-integrated="true"]');
    expect(styles).toContain('--bg: #f6f8fb');
    expect(styles).toContain('--surface: #ffffff');
  });

  it('turns the return action into close and refocus behavior', () => {
    expect(launcher).toContain('Cerrar y volver a AURA');
    expect(launcher).toContain('setupWindow.close()');
    expect(launcher).toContain('window.focus()');
  });

  it('retries the Ollama connection after the assistant closes', () => {
    expect(launcher).toContain('[data-testid="ollama-retry-connection"]');
    expect(launcher).toContain('retryButton.click()');
  });
});
