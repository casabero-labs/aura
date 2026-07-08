import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../services/providers/ollamaProvider';

describe('OllamaProvider', () => {
  const baseUrl = 'http://localhost:11434';
  const model = 'mistral:7b';

  beforeEach(() => {
    vi.stubGlobal('performance', { now: () => 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('generateText error handling', () => {
    it('includes JSON error body from Ollama 400 response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: () => Promise.resolve(JSON.stringify({ error: 'model "mistral:7b" not found, try pulling it first' })),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);

      await expect(provider.generateText('hello')).rejects.toThrow(/mistral:7b.*not found/i);

      fetchSpy.mockRestore();
    });

    it('includes plain text error body from Ollama 400 response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: () => Promise.resolve('model not loaded: mistral:7b'),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);

      await expect(provider.generateText('hello')).rejects.toThrow(/model not loaded/i);

      fetchSpy.mockRestore();
    });

    it('includes model name in error message for 400', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: () => Promise.resolve(JSON.stringify({ error: 'invalid model' })),
        } as Response)
      );

      const provider = new OllamaProvider('hf.co/yuxinlu1/gemma-4-12B-coder-fable5-composer2.5-v1-GGUF:Q8_0', 0.1, baseUrl);

      try {
        await provider.generateText('hello');
        expect.fail('should have thrown');
      } catch (e: any) {
        expect(e.message).toMatch(/Ollama error 400/);
      }

      fetchSpy.mockRestore();
    });

    it('does not crash when response body reading fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.reject(new Error('body read failed')),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);

      try {
        await provider.generateText('hello');
        expect.fail('should have thrown');
      } catch (e: any) {
        expect(e.message).toMatch(/Ollama error 500/);
      }

      fetchSpy.mockRestore();
    });
  });

  describe('isAvailable', () => {
    it('returns true when /api/tags returns ok', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({ ok: true } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);
      const result = await provider.isAvailable();
      expect(result).toBe(true);

      fetchSpy.mockRestore();
    });

    it('returns false when /api/tags returns not ok', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({ ok: false } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);
      const result = await provider.isAvailable();
      expect(result).toBe(false);

      fetchSpy.mockRestore();
    });
  });

  describe('listModels', () => {
    it('returns models from /api/tags', async () => {
      const models = [
        { name: 'qwen2.5:3b', modified_at: '2026-01-01T00:00:00Z', size: 2 * 1024 * 1024 * 1024 },
        { name: 'gemma2:2b', modified_at: '2026-01-01T00:00:00Z', size: 1.5 * 1024 * 1024 * 1024 },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models }),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);
      const result = await provider.listModels();
      expect(result).toEqual(models);

      fetchSpy.mockRestore();
    });
  });
});
