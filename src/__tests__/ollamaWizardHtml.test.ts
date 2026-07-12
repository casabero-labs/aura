import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const LEGACY_PATH = resolve(__dirname, '../public/ollama-setup.html');

function getLegacySource() {
  return readFileSync(LEGACY_PATH, 'utf-8');
}

describe('legacy ollama-setup.html compatibility redirect', () => {
  const src = getLegacySource();

  it('redirects to the integrated React setup view', () => {
    expect(src).toContain("target.searchParams.set('view', 'ollama-setup')");
    expect(src).toContain('window.location.replace(target.toString())');
  });

  it('preserves the return path', () => {
    expect(src).toContain("current.searchParams.get('return') || '/'");
    expect(src).toContain("target.searchParams.set('return'");
  });

  it('does not retain the former duplicate diagnostic implementation', () => {
    expect(src).not.toContain('runOllamaDiagnostic');
    expect(src).not.toContain('connect-btn');
    expect(src).not.toContain('/api/tags');
  });

  it('provides a no-script fallback link', () => {
    expect(src).toContain('/?view=ollama-setup&amp;return=/');
  });
});
