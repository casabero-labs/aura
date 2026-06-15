import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getChromeAiDiagnostic, ChromePromptProvider } from '../services/providers/chromeProvider';

const hasWindow = typeof window !== 'undefined';
const originalLanguageModel = globalThis.LanguageModel;
const originalWindowAi = hasWindow ? window.ai : undefined;

describe('getChromeAiDiagnostic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete (globalThis as any).LanguageModel;
    if (hasWindow) {
      delete (window as any).ai;
    }
  });

  afterEach(() => {
    (globalThis as any).LanguageModel = originalLanguageModel;
    if (hasWindow) {
      (window as any).ai = originalWindowAi;
    }
  });

  describe('API surface detection', () => {
    it('returns apiSurface "none" when no API is available', async () => {
      const result = await getChromeAiDiagnostic();
      expect(result.apiSurface).toBe('none');
      expect(result.status).toBe('unavailable');
    });

    it('detects globalThis.LanguageModel as apiSurface', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'readily' }),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.apiSurface).toBe('LanguageModel');
      expect(result.status).toBe('available');
    });

    (hasWindow ? it : it.skip)('detects window.ai.languageModel as apiSurface', async () => {
      (window as any).ai = {
        languageModel: {
          availability: vi.fn().mockResolvedValue({ available: 'readily' }),
        },
      };
      const result = await getChromeAiDiagnostic();
      expect(result.apiSurface).toBe('window.ai.languageModel');
      expect(result.status).toBe('available');
    });

    (hasWindow ? it : it.skip)('detects window.ai.assistant (legacy) as apiSurface', async () => {
      (window as any).ai = {
        assistant: vi.fn().mockResolvedValue({
          capabilities: vi.fn().mockResolvedValue({ available: true, defaultTemperature: 0 }),
        }),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.apiSurface).toBe('window.ai.assistant');
      expect(result.status).toBe('available');
    });
  });

  describe('availability status', () => {
    it('returns status "available" when availability is "readily"', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'readily' }),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.status).toBe('available');
      expect(result.message).toContain('listo');
    });

    it('returns status "downloadable" when availability is "after-download"', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'after-download' }),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.status).toBe('downloadable');
      expect(result.message).toContain('descarga');
    });

    it('returns status "unavailable" when availability is "no"', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'no' }),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.status).toBe('unavailable');
    });

    it('returns status "error" when availability throws', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockRejectedValue(new Error('Permission denied')),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.status).toBe('error');
    });
  });

  describe('actions array', () => {
    it('includes actionable steps when API is missing', async () => {
      const result = await getChromeAiDiagnostic();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions.some(a => a.includes('chrome://flags'))).toBe(true);
    });

    it('includes download steps when downloadable', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'after-download' }),
      };
      const result = await getChromeAiDiagnostic();
      expect(result.actions.some(a => a.includes('Preparar'))).toBe(true);
    });
  });
});

describe('ChromePromptProvider', () => {
  beforeEach(() => {
    delete (globalThis as any).LanguageModel;
    if (typeof window !== 'undefined') {
      delete (window as any).ai;
    }
  });

  afterEach(() => {
    (globalThis as any).LanguageModel = originalLanguageModel;
    if (typeof window !== 'undefined') {
      (window as any).ai = originalWindowAi;
    }
  });

  it('getApiSurface returns "none" when no API', () => {
    const provider = new ChromePromptProvider();
    expect(provider.getApiSurface()).toBe('none');
  });

  it('getApiSurface returns "LanguageModel" when globalThis.LanguageModel exists', () => {
    (globalThis as any).LanguageModel = { availability: vi.fn() };
    const provider = new ChromePromptProvider();
    expect(provider.getApiSurface()).toBe('LanguageModel');
  });

  it('isAvailable returns false when API missing', async () => {
    const provider = new ChromePromptProvider();
    expect(await provider.isAvailable()).toBe(false);
  });

  it('isAvailable returns true when LanguageModel is readily', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue({ available: 'readily' }),
    };
    const provider = new ChromePromptProvider();
    expect(await provider.isAvailable()).toBe(true);
  });

  it('isAvailable returns false when downloadable only', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue({ available: 'after-download' }),
    };
    const provider = new ChromePromptProvider();
    expect(await provider.isAvailable()).toBe(false);
    expect(await provider.isDownloadable()).toBe(true);
  });

  it('generateText throws when unavailable', async () => {
    const provider = new ChromePromptProvider();
    await expect(provider.generateText('test')).rejects.toThrow();
  });

  it('preloadModel throws with diagnostic message', async () => {
    const provider = new ChromePromptProvider();
    await expect(provider.preloadModel()).rejects.toThrow('Chrome AI no está habilitado');
  });

  it('unloadModel does not throw when no session', async () => {
    const provider = new ChromePromptProvider();
    await expect(provider.unloadModel()).resolves.toBeUndefined();
  });
});
