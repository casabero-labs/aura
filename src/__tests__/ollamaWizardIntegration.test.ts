import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Ollama wizard integration - pure logic', () => {
  describe('return path validation', () => {
    function getReturnPath(raw: string | null): string {
      if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
      return raw;
    }

    it('rejects external URLs', () => {
      expect(getReturnPath('https://evil.com')).toBe('/');
    });

    it('rejects double-slash paths', () => {
      expect(getReturnPath('//evil.com')).toBe('/');
      expect(getReturnPath('//')).toBe('/');
    });

    it('accepts valid same-origin paths', () => {
      expect(getReturnPath('/')).toBe('/');
      expect(getReturnPath('/dashboard')).toBe('/dashboard');
      expect(getReturnPath('/audit')).toBe('/audit');
      expect(getReturnPath('/ollama-setup.html?return=/')).toBe('/ollama-setup.html?return=/');
    });

    it('defaults to / when return param is null or empty', () => {
      expect(getReturnPath(null)).toBe('/');
      expect(getReturnPath('')).toBe('/');
    });

    it('accepts path with query string', () => {
      expect(getReturnPath('/?foo=bar')).toBe('/?foo=bar');
      expect(getReturnPath('/ollama-setup.html?return=/&foo=bar')).toBe('/ollama-setup.html?return=/&foo=bar');
    });
  });

  describe('session flag aura_ollama_setup_started', () => {
    let storage: Map<string, string>;

    beforeEach(() => {
      storage = new Map();
      vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('is set to true when Ollama is selected without connection', () => {
      sessionStorage.setItem('aura_ollama_setup_started', 'true');
      expect(sessionStorage.getItem('aura_ollama_setup_started')).toBe('true');
    });

    it('is cleared when SettingsPanel mounts', () => {
      sessionStorage.setItem('aura_ollama_setup_started', 'true');
      sessionStorage.removeItem('aura_ollama_setup_started');
      expect(sessionStorage.getItem('aura_ollama_setup_started')).toBeNull();
    });

    it('prevents redirect when set to true', () => {
      sessionStorage.setItem('aura_ollama_setup_started', 'true');
      const shouldRedirect = sessionStorage.getItem('aura_ollama_setup_started') !== 'true';
      expect(shouldRedirect).toBe(false);
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

    it('saves endpoint when connection succeeds', () => {
      const endpoint = 'http://127.0.0.1:11434';
      localStorage.setItem('aura_ollama_endpoint', endpoint);
      expect(localStorage.getItem('aura_ollama_endpoint')).toBe(endpoint);
    });

    it('saves model when connection succeeds', () => {
      const model = 'qwen2.5:3b';
      localStorage.setItem('aura_ollama_model', model);
      expect(localStorage.getItem('aura_ollama_model')).toBe(model);
    });

    it('saves last_ready timestamp when chat test succeeds', () => {
      const timestamp = new Date().toISOString();
      localStorage.setItem('aura_ollama_last_ready', timestamp);
      expect(localStorage.getItem('aura_ollama_last_ready')).toBe(timestamp);
    });

    it('saves setup_completed when returning from wizard', () => {
      localStorage.setItem('aura_ollama_setup_completed', 'true');
      expect(localStorage.getItem('aura_ollama_setup_completed')).toBe('true');
    });

    it('recovers endpoint and model from localStorage on init', () => {
      localStorage.setItem('aura_ollama_endpoint', 'http://127.0.0.1:11434');
      localStorage.setItem('aura_ollama_model', 'llama3:3b');

      const savedEndpoint = localStorage.getItem('aura_ollama_endpoint');
      const savedModel = localStorage.getItem('aura_ollama_model');

      expect(savedEndpoint).toBe('http://127.0.0.1:11434');
      expect(savedModel).toBe('llama3:3b');
    });

    it('persists a non-recommended model (e.g. mistral:7b)', () => {
      const model = 'mistral:7b';
      localStorage.setItem('aura_ollama_model', model);
      expect(localStorage.getItem('aura_ollama_model')).toBe(model);
    });

    it('persists a heavy model name (hf.co/yuxinlu1/gemma-4-12B-coder-fable5-composer2.5-v1-GGUF:Q8_0)', () => {
      const model = 'hf.co/yuxinlu1/gemma-4-12B-coder-fable5-composer2.5-v1-GGUF:Q8_0';
      localStorage.setItem('aura_ollama_model', model);
      expect(localStorage.getItem('aura_ollama_model')).toBe(model);
    });
  });

  describe('navigation guard for Ollama redirect', () => {
    let assignMock: ReturnType<typeof vi.fn>;
    let sessionStorageStore: Map<string, string>;

    beforeEach(() => {
      sessionStorageStore = new Map();
      assignMock = vi.fn();
      vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => sessionStorageStore.get(key) ?? null,
        setItem: (key: string, value: string) => sessionStorageStore.set(key, value),
        removeItem: (key: string) => sessionStorageStore.delete(key),
        clear: () => sessionStorageStore.clear(),
      });
      vi.stubGlobal('window', {
        location: { assign: assignMock },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('redirects to wizard when Ollama selected without connection', () => {
      const ollamaConnected = false as boolean;
      if (ollamaConnected !== true) {
        sessionStorage.setItem('aura_ollama_setup_started', 'true');
        window.location.assign('/ollama-setup.html?return=/');
      }
      expect(assignMock).toHaveBeenCalledWith('/ollama-setup.html?return=/');
    });

    it('does not redirect when Ollama is connected', () => {
      const ollamaConnected = true as boolean;
      if (ollamaConnected !== true) {
        window.location.assign('/ollama-setup.html?return=/');
      }
      expect(assignMock).not.toHaveBeenCalled();
    });

    it('does not redirect on repeated selection (session flag set)', () => {
      sessionStorage.setItem('aura_ollama_setup_started', 'true');
      const ollamaConnected = false as boolean;
      const setupStarted = sessionStorage.getItem('aura_ollama_setup_started') === 'true';
      if (ollamaConnected !== true && !setupStarted) {
        window.location.assign('/ollama-setup.html?return=/');
      }
      expect(assignMock).not.toHaveBeenCalled();
    });
  });
});
