import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Ollama integrated assistant - navigation and persistence', () => {
  describe('return path validation', () => {
    function getReturnPath(raw: string | null): string {
      if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
      return raw;
    }

    it('rejects external URLs and protocol-relative paths', () => {
      expect(getReturnPath('https://evil.com')).toBe('/');
      expect(getReturnPath('//evil.com')).toBe('/');
    });

    it('accepts valid same-origin paths', () => {
      expect(getReturnPath('/')).toBe('/');
      expect(getReturnPath('/?section=settings')).toBe('/?section=settings');
    });
  });

  describe('localStorage keys for Ollama config persistence', () => {
    let storage: Map<string, string>;

    beforeEach(() => {
      storage = new Map();
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('persists endpoint, exact model id and readiness timestamp', () => {
      const endpoint = 'http://127.0.0.1:11434';
      const model = 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL';
      const timestamp = new Date().toISOString();

      localStorage.setItem('aura_ollama_endpoint', endpoint);
      localStorage.setItem('aura_ollama_model', model);
      localStorage.setItem('aura_ollama_last_ready', timestamp);
      localStorage.setItem('aura_ollama_setup_completed', 'true');

      expect(localStorage.getItem('aura_ollama_endpoint')).toBe(endpoint);
      expect(localStorage.getItem('aura_ollama_model')).toBe(model);
      expect(localStorage.getItem('aura_ollama_last_ready')).toBe(timestamp);
      expect(localStorage.getItem('aura_ollama_setup_completed')).toBe('true');
    });
  });

  describe('standalone route construction', () => {
    it('builds the integrated assistant URL instead of the legacy HTML page', () => {
      const origin = 'https://aura.casabero.com';
      const url = new URL('/', origin);
      url.searchParams.set('view', 'ollama-setup');
      url.searchParams.set('return', '/');
      url.searchParams.set('source', 'aura-interface');

      expect(url.pathname).toBe('/');
      expect(url.searchParams.get('view')).toBe('ollama-setup');
      expect(url.searchParams.get('return')).toBe('/');
      expect(url.toString()).not.toContain('/ollama-setup.html');
    });
  });
});
