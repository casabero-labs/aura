import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getChromeAiDiagnostic, ChromePromptProvider } from '../services/providers/chromeProvider';
import { detectChromeAiAvailability, normalizeAvailability, getStatusDescription, extractAvailabilityValue } from '../services/chromeAvailability';
import { NetworkGuard } from '../services/networkGuard';
import { PrivacyReceiptService } from '../services/privacyReceipt';

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

describe('Chrome AI Availability Normalizer', () => {
  describe('extractAvailabilityValue', () => {
    it('returns string directly when result is a string', () => {
      expect(extractAvailabilityValue('available')).toBe('available');
      expect(extractAvailabilityValue('readily')).toBe('readily');
      expect(extractAvailabilityValue('downloadable')).toBe('downloadable');
    });

    it('extracts .available from object when result is an object', () => {
      expect(extractAvailabilityValue({ available: 'available' })).toBe('available');
      expect(extractAvailabilityValue({ available: 'readily' })).toBe('readily');
      expect(extractAvailabilityValue({ available: 'after-download' })).toBe('after-download');
    });

    it('extracts .status from object when .available is not a string', () => {
      expect(extractAvailabilityValue({ status: 'available' })).toBe('available');
      expect(extractAvailabilityValue({ status: 'readily' })).toBe('readily');
    });

    it('returns undefined for null or undefined', () => {
      expect(extractAvailabilityValue(null)).toBeUndefined();
      expect(extractAvailabilityValue(undefined)).toBeUndefined();
    });

    it('returns undefined for objects without .available or .status', () => {
      expect(extractAvailabilityValue({})).toBeUndefined();
      expect(extractAvailabilityValue({ other: 'value' })).toBeUndefined();
    });

    it('returns undefined for non-string, non-object values', () => {
      expect(extractAvailabilityValue(123)).toBeUndefined();
      expect(extractAvailabilityValue(true)).toBeUndefined();
    });
  });

  describe('normalizeAvailability', () => {
    it('normalizes "readily" to "ready"', () => {
      expect(normalizeAvailability('readily', 'LanguageModel')).toBe('ready');
    });

    it('normalizes "after-download" to "downloadable"', () => {
      expect(normalizeAvailability('after-download', 'LanguageModel')).toBe('downloadable');
    });

    it('normalizes "no" to "unavailable"', () => {
      expect(normalizeAvailability('no', 'LanguageModel')).toBe('unavailable');
    });

    it('normalizes "available" to "ready"', () => {
      expect(normalizeAvailability('available', 'window.ai.assistant')).toBe('ready');
    });

    it('normalizes "downloadable" to "downloadable"', () => {
      expect(normalizeAvailability('downloadable', 'LanguageModel')).toBe('downloadable');
    });

    it('normalizes "downloading" to "downloading"', () => {
      expect(normalizeAvailability('downloading', 'LanguageModel')).toBe('downloading');
    });

    it('normalizes "unavailable" to "unavailable"', () => {
      expect(normalizeAvailability('unavailable', 'LanguageModel')).toBe('unavailable');
    });

    it('normalizes unknown status to "error"', () => {
      expect(normalizeAvailability('unknown', 'LanguageModel')).toBe('error');
    });
  });

  describe('getStatusDescription', () => {
    it('returns success for ready status', () => {
      const result = getStatusDescription('ready');
      expect(result.color).toBe('success');
      expect(result.label).toBe('Listo');
    });

    it('returns warning for downloadable status', () => {
      const result = getStatusDescription('downloadable');
      expect(result.color).toBe('warning');
      expect(result.label).toBe('Descargable');
    });

    it('returns error for unavailable status', () => {
      const result = getStatusDescription('unavailable');
      expect(result.color).toBe('error');
      expect(result.label).toBe('No disponible');
    });

    it('returns error for api_missing status', () => {
      const result = getStatusDescription('api_missing');
      expect(result.color).toBe('error');
      expect(result.label).toBe('API no detectada');
    });
  });

  describe('detectChromeAiAvailability', () => {
    beforeEach(() => {
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

    it('returns api_missing when no API is available', async () => {
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('api_missing');
      expect(result.apiSurface).toBe('none');
    });

    it('returns ready when LanguageModel is readily available', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'readily' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.apiSurface).toBe('LanguageModel');
    });

    it('returns downloadable when LanguageModel needs download', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'after-download' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('downloadable');
    });

    it('returns unavailable when availability throws and smoke test fails', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockRejectedValue(new Error('Test error')),
        create: vi.fn().mockRejectedValue(new Error('No model')),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('unavailable');
      expect(result.availabilityCallMode).toBe('clean');
      expect(result.technicalDetails.some(d => d.includes('Test error'))).toBe(true);
    });

    it('returns ready when availability returns "available" (not "readily")', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'available' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityRaw).toBe('available');
    });

    it('returns ready when availability returns undefined but smoke test passes', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('OK'),
        destroy: vi.fn(),
      };
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: undefined }),
        create: vi.fn().mockResolvedValue(mockSession),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityCallMode).toBe('clean');
      expect(result.technicalDetails.some(d => d.includes('smoke test'))).toBe(true);
    });

    it('returns unavailable when availability returns undefined and smoke test fails', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: undefined }),
        create: vi.fn().mockRejectedValue(new Error('Create failed')),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('unavailable');
      expect(result.technicalDetails.some(d => d.includes('Smoke test failed'))).toBe(true);
    });

    it('includes detectedAt timestamp in result', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'readily' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.detectedAt).toBeDefined();
      expect(new Date(result.detectedAt)).toBeInstanceOf(Date);
    });

    it('includes availabilityRaw in result', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'readily' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.availabilityRaw).toBe('readily');
    });

    it('uses clean availability call without options and returns ready', async () => {
      const availabilityFn = vi.fn().mockResolvedValue({ available: 'readily' });
      (globalThis as any).LanguageModel = {
        availability: availabilityFn,
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityCallMode).toBe('clean');
      expect(availabilityFn).toHaveBeenCalledTimes(1);
      expect(availabilityFn).toHaveBeenCalledWith();
    });

    it('returns ready when availability returns string "available" directly', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue('available'),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityRaw).toBe('available');
    });

    it('returns ready when availability returns object { available: "available" }', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'available' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityRaw).toBe('available');
    });

    it('returns downloadable when availability returns "downloadable" string', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue('downloadable'),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('downloadable');
      expect(result.availabilityRaw).toBe('downloadable');
    });

    it('returns downloading when availability returns "downloading" string', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue('downloading'),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('downloading');
      expect(result.availabilityRaw).toBe('downloading');
    });

    it('returns unavailable when availability returns "unavailable" string', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue('unavailable'),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('unavailable');
      expect(result.availabilityRaw).toBe('unavailable');
    });

    it('returns unavailable when availability returns "no" string', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue('no'),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('unavailable');
      expect(result.availabilityRaw).toBe('no');
    });

    it('extracts .available from object and normalizes correctly', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: 'readily' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityRaw).toBe('readily');
    });

    it('extracts .status from object when .available is missing', async () => {
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ status: 'available' }),
      };
      const result = await detectChromeAiAvailability();
      expect(result.status).toBe('ready');
      expect(result.availabilityRaw).toBe('available');
    });

    it('smoke test calls create without temperature or topK', async () => {
      const createFn = vi.fn().mockResolvedValue({
        prompt: vi.fn().mockResolvedValue('OK'),
        destroy: vi.fn(),
      });
      (globalThis as any).LanguageModel = {
        availability: vi.fn().mockResolvedValue({ available: undefined }),
        create: createFn,
      };
      await detectChromeAiAvailability();
      expect(createFn).toHaveBeenCalledTimes(1);
      expect(createFn).toHaveBeenCalledWith();
    });
  });
});

describe('NetworkGuard', () => {
  const hasWindow = typeof window !== 'undefined';
  let originalFetch: typeof fetch;
  let originalXHROpen: typeof XMLHttpRequest.prototype.open;

  beforeEach(() => {
    if (hasWindow) {
      originalFetch = window.fetch;
      originalXHROpen = XMLHttpRequest.prototype.open;
    }
  });

  afterEach(() => {
    if (hasWindow) {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
    }
  });

  (hasWindow ? it : it.skip)('starts and stops monitoring', () => {
    const guard = new NetworkGuard();
    expect(guard.getIsRunning()).toBe(false);
    
    guard.start();
    expect(guard.getIsRunning()).toBe(true);
    
    const result = guard.stop();
    expect(guard.getIsRunning()).toBe(false);
    expect(result.requests).toEqual([]);
    expect(result.externalRequests).toEqual([]);
    expect(result.auraRequests).toEqual([]);
    expect(result.totalRequests).toBe(0);
  });

  (hasWindow ? it : it.skip)('detects external fetch requests', async () => {
    const guard = new NetworkGuard();
    guard.start();
    
    // Mock fetch to track calls
    const mockFetch = vi.fn().mockResolvedValue(new Response());
    window.fetch = mockFetch;
    
    await fetch('https://example.com/api');
    
    const result = guard.stop();
    expect(result.totalRequests).toBe(1);
    expect(result.externalRequests.length).toBe(1);
    expect(result.externalRequests[0].url).toBe('https://example.com/api');
    expect(result.externalRequests[0].type).toBe('fetch');
  });

  (hasWindow ? it : it.skip)('registers AURA requests correctly', async () => {
    const guard = new NetworkGuard(window.location.origin);
    guard.start();
    
    const mockFetch = vi.fn().mockResolvedValue(new Response());
    window.fetch = mockFetch;
    
    await fetch(`${window.location.origin}/api/data`);
    
    const result = guard.stop();
    expect(result.auraRequests.length).toBe(1);
    expect(result.externalRequests.length).toBe(0);
  });

  (hasWindow ? it : it.skip)('detects multiple request types', async () => {
    const guard = new NetworkGuard();
    guard.start();
    
    const mockFetch = vi.fn().mockResolvedValue(new Response());
    window.fetch = mockFetch;
    
    // Simulate different request types
    await fetch('https://external1.com');
    await fetch('https://external2.com');
    
    const result = guard.stop();
    expect(result.totalRequests).toBe(2);
    expect(result.externalRequests.length).toBe(2);
  });
});

describe('PrivacyReceiptService', () => {
  it('generates privacy receipt with correct defaults', async () => {
    const service = new PrivacyReceiptService();
    service.startTracking();
    
    const data = [['col1', 'col2'], ['val1', 'val2']];
    const columns = ['col1', 'col2'];
    const networkResult = {
      requests: [],
      externalRequests: [],
      auraRequests: [],
      totalRequests: 0,
    };
    const availability = {
      status: 'ready' as const,
      apiSurface: 'LanguageModel' as const,
      message: 'Test',
      technicalDetails: [],
    };
    
    const receipt = await service.generateReceipt(data, columns, networkResult, availability);
    
    expect(receipt.provider).toBe('chrome_ai');
    expect(receipt.mode).toBe('browser_on_device');
    expect(receipt.dataset_sent_to_cloud).toBe(false);
    expect(receipt.raw_dataset_sent).toBe(false);
    expect(receipt.prompt_scope).toBe('structured_findings_only');
    expect(receipt.rows).toBe(2);
    expect(receipt.columns).toBe(2);
    expect(receipt.outbound_requests_from_aura).toBe(0);
    expect(receipt.dataset_sha256).toBeDefined();
    expect(receipt.receipt_id).toBeDefined();
  });

  it('generates correct privacy statement for no external requests', async () => {
    const service = new PrivacyReceiptService();
    service.startTracking();
    
    const data = [['test']];
    const columns = ['test'];
    const networkResult = {
      requests: [],
      externalRequests: [],
      auraRequests: [],
      totalRequests: 0,
    };
    const availability = {
      status: 'ready' as const,
      apiSurface: 'LanguageModel' as const,
      message: 'Test',
      technicalDetails: [],
    };
    
    const receipt = await service.generateReceipt(data, columns, networkResult, availability);
    const statement = service.generatePrivacyStatement(receipt);
    
    expect(statement).toContain('no realizó conexiones externas');
  });

  it('generates correct privacy statement with external requests', async () => {
    const service = new PrivacyReceiptService();
    service.startTracking();
    
    const data = [['test']];
    const columns = ['test'];
    const networkResult = {
      requests: [{ type: 'fetch', url: 'https://external.com', timestamp: Date.now(), initiator: 'fetch' }],
      externalRequests: [{ type: 'fetch', url: 'https://external.com', timestamp: Date.now(), initiator: 'fetch' }],
      auraRequests: [],
      totalRequests: 1,
    };
    const availability = {
      status: 'ready' as const,
      apiSurface: 'LanguageModel' as const,
      message: 'Test',
      technicalDetails: [],
    };
    
    const receipt = await service.generateReceipt(data, columns, networkResult, availability);
    const statement = service.generatePrivacyStatement(receipt);
    
    expect(statement).toContain('1 conexión(es) externa(s)');
  });

  it('validates receipt integrity', async () => {
    const service = new PrivacyReceiptService();
    service.startTracking();
    
    const data = [['test']];
    const columns = ['test'];
    const networkResult = {
      requests: [],
      externalRequests: [],
      auraRequests: [],
      totalRequests: 0,
    };
    const availability = {
      status: 'ready' as const,
      apiSurface: 'LanguageModel' as const,
      message: 'Test',
      technicalDetails: [],
    };
    
    const receipt = await service.generateReceipt(data, columns, networkResult, availability);
    const verification = service.verifyReceipt(receipt);
    
    expect(verification.isValid).toBe(true);
    expect(verification.issues).toHaveLength(0);
  });

  it('detects invalid receipt with cloud sent data', async () => {
    const service = new PrivacyReceiptService();
    service.startTracking();
    
    const data = [['test']];
    const columns = ['test'];
    const networkResult = {
      requests: [],
      externalRequests: [],
      auraRequests: [],
      totalRequests: 0,
    };
    const availability = {
      status: 'ready' as const,
      apiSurface: 'LanguageModel' as const,
      message: 'Test',
      technicalDetails: [],
    };
    
    const receipt = await service.generateReceipt(data, columns, networkResult, availability);
    receipt.dataset_sent_to_cloud = true; // Invalid state
    
    const verification = service.verifyReceipt(receipt);
    
    expect(verification.isValid).toBe(false);
    expect(verification.issues.some(i => i.includes('cloud'))).toBe(true);
  });
});
