import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isLoopbackEndpoint,
  isPrivateLanEndpoint,
  classifyEndpointHost,
  buildCopyableDiagnostic,
  buildCurlCommand,
  buildPowerShellCurlCommand,
  buildVerifyEnvCommand,
  isModelHeavy,
  diagnoseOllamaLocal,
  type OllamaDiagnostic,
  type OllamaLocalDiagnostic,
} from '../services/ollamaLocalBridge';

describe('ollamaLocalBridge', () => {
  describe('classifyEndpointHost', () => {
    it('classifies localhost as loopback', () => {
      expect(classifyEndpointHost('localhost')).toBe('loopback');
      expect(classifyEndpointHost('LOCALHOST')).toBe('loopback');
    });

    it('classifies 127.0.0.1 as loopback', () => {
      expect(classifyEndpointHost('127.0.0.1')).toBe('loopback');
    });

    it('classifies ::1 as loopback', () => {
      expect(classifyEndpointHost('::1')).toBe('loopback');
      expect(classifyEndpointHost('[::1]')).toBe('loopback');
    });

    it('classifies 10.x.x.x as private_lan', () => {
      expect(classifyEndpointHost('10.0.0.1')).toBe('private_lan');
      expect(classifyEndpointHost('10.255.255.255')).toBe('private_lan');
    });

    it('classifies 172.16-31.x.x as private_lan', () => {
      expect(classifyEndpointHost('172.16.0.1')).toBe('private_lan');
      expect(classifyEndpointHost('172.31.255.255')).toBe('private_lan');
      expect(classifyEndpointHost('172.20.0.1')).toBe('private_lan');
    });

    it('classifies 192.168.x.x as private_lan', () => {
      expect(classifyEndpointHost('192.168.0.1')).toBe('private_lan');
      expect(classifyEndpointHost('192.168.255.255')).toBe('private_lan');
    });

    it('classifies public IPs as public', () => {
      expect(classifyEndpointHost('8.8.8.8')).toBe('public');
      expect(classifyEndpointHost('1.1.1.1')).toBe('public');
      expect(classifyEndpointHost('54.239.28.85')).toBe('public');
    });

    it('classifies hostnames without dots as loopback if localhost', () => {
      expect(classifyEndpointHost('my-ollama')).toBe('public');
    });
  });

  describe('isLoopbackEndpoint', () => {
    it('returns true for localhost URLs', () => {
      expect(isLoopbackEndpoint('http://localhost:11434')).toBe(true);
      expect(isLoopbackEndpoint('http://localhost/api/tags')).toBe(true);
    });

    it('returns true for 127.0.0.1 URLs', () => {
      expect(isLoopbackEndpoint('http://127.0.0.1:11434')).toBe(true);
      expect(isLoopbackEndpoint('http://127.0.0.1:11434/api/chat')).toBe(true);
    });

    it('returns false for private LAN IPs', () => {
      expect(isLoopbackEndpoint('http://192.168.1.100:11434')).toBe(false);
      expect(isLoopbackEndpoint('http://10.0.0.5:11434')).toBe(false);
      expect(isLoopbackEndpoint('http://172.20.0.1:11434')).toBe(false);
    });

    it('returns false for public URLs', () => {
      expect(isLoopbackEndpoint('http://ollama.example.com:11434')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isLoopbackEndpoint('not-a-url')).toBe(false);
    });
  });

  describe('isPrivateLanEndpoint', () => {
    it('returns true for 192.168.x.x', () => {
      expect(isPrivateLanEndpoint('http://192.168.1.100:11434')).toBe(true);
    });

    it('returns true for 10.x.x.x', () => {
      expect(isPrivateLanEndpoint('http://10.0.0.5:11434')).toBe(true);
    });

    it('returns true for 172.16-31.x.x', () => {
      expect(isPrivateLanEndpoint('http://172.20.0.1:11434')).toBe(true);
    });

    it('returns false for localhost/127.0.0.1', () => {
      expect(isPrivateLanEndpoint('http://localhost:11434')).toBe(false);
      expect(isPrivateLanEndpoint('http://127.0.0.1:11434')).toBe(false);
    });

    it('returns false for public URLs', () => {
      expect(isPrivateLanEndpoint('http://public.example.com:11434')).toBe(false);
    });
  });

  describe('buildCopyableDiagnostic', () => {
    it('includes all required diagnostic fields', () => {
      const diagnostic: OllamaDiagnostic = {
        state: 'ollama_unreachable',
        endpoint: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        strategy: 'fetch_without_targetAddressSpace',
        stages: [
          { id: 'https_context', label: 'Contexto HTTPS', status: 'success', message: 'OK', durationMs: 2 },
          { id: 'api_tags', label: 'Respuesta de /api/tags', status: 'error', message: 'Failed', durationMs: 5000 },
        ],
        durationMs: 5000,
        browser: 'Chrome',
        browserVersion: '138',
        isSecureContext: true,
        origin: 'https://aura.casabero.com',
        timestamp: '2026-06-23T10:00:00.000Z',
      };

      const output = buildCopyableDiagnostic(diagnostic);

      expect(output).toContain('=== AURA · Ollama Diagnostic ===');
      expect(output).toContain('Endpoint: http://127.0.0.1:11434');
      expect(output).toContain('Model: qwen2.5:3b');
      expect(output).toContain('State: ollama_unreachable');
      expect(output).toContain('Browser: Chrome 138');
      expect(output).toContain('Origin: https://aura.casabero.com');
      expect(output).toContain('Secure Context: true');
      expect(output).toContain('[success] Contexto HTTPS: OK (2ms)');
      expect(output).toContain('[error] Respuesta de /api/tags: Failed (5000ms)');
    });

    it('does not include sensitive user data', () => {
      const diagnostic: OllamaDiagnostic = {
        state: 'ready',
        endpoint: 'http://127.0.0.1:11434',
        strategy: 'test',
        stages: [],
        browser: 'Chrome',
        browserVersion: '138',
        isSecureContext: true,
        origin: 'https://aura.casabero.com',
        timestamp: '2026-06-23T10:00:00.000Z',
      };

      const output = buildCopyableDiagnostic(diagnostic);

      expect(output).not.toContain('dataset');
      expect(output).not.toContain('prompt');
      expect(output).not.toContain('csv');
      expect(output).not.toContain('file');
    });

    it('includes error details when present', () => {
      const diagnostic: OllamaDiagnostic = {
        state: 'cors_probable',
        endpoint: 'http://127.0.0.1:11434',
        strategy: 'test',
        error: {
          name: 'TypeError',
          message: 'Failed to fetch',
          cause: 'network_or_cors',
        },
        stages: [],
        browser: 'Chrome',
        browserVersion: '138',
        isSecureContext: true,
        origin: 'https://aura.casabero.com',
        timestamp: '2026-06-23T10:00:00.000Z',
      };

      const output = buildCopyableDiagnostic(diagnostic);

      expect(output).toContain('--- Error ---');
      expect(output).toContain('Name: TypeError');
      expect(output).toContain('Message: Failed to fetch');
      expect(output).toContain('Cause: network_or_cors');
    });
  });

  describe('buildCurlCommand', () => {
    it('builds correct curl command', () => {
      const cmd = buildCurlCommand('http://127.0.0.1:11434', 'https://aura.casabero.com');
      expect(cmd).toContain('curl -i');
      expect(cmd).toContain('Origin: https://aura.casabero.com');
      expect(cmd).toContain('http://127.0.0.1:11434/api/tags');
    });

    it('handles endpoint with trailing slash', () => {
      const cmd = buildCurlCommand('http://127.0.0.1:11434/', 'https://aura.casabero.com');
      expect(cmd).toContain('http://127.0.0.1:11434/api/tags');
    });
  });

  describe('buildPowerShellCurlCommand', () => {
    it('builds correct PowerShell curl command', () => {
      const cmd = buildPowerShellCurlCommand('http://127.0.0.1:11434', 'https://aura.casabero.com');
      expect(cmd).toContain('curl.exe -i');
      expect(cmd).toContain('Origin: https://aura.casabero.com');
      expect(cmd).toContain('http://127.0.0.1:11434/api/tags');
    });
  });

  describe('buildVerifyEnvCommand', () => {
    it('returns macOS command for macos', () => {
      const cmd = buildVerifyEnvCommand('macos', 'https://aura.casabero.com');
      expect(cmd).toContain('launchctl getenv OLLAMA_ORIGINS');
      expect(cmd).toContain('https://aura.casabero.com');
    });

    it('returns Linux command for linux', () => {
      const cmd = buildVerifyEnvCommand('linux', 'https://aura.casabero.com');
      expect(cmd).toContain('systemctl show ollama');
      expect(cmd).toContain('OLLAMA_ORIGINS=https://aura.casabero.com');
    });

    it('returns Windows command for windows', () => {
      const cmd = buildVerifyEnvCommand('windows', 'https://aura.casabero.com');
      expect(cmd).toContain('GetEnvironmentVariable');
      expect(cmd).toContain('https://aura.casabero.com');
    });

    it('returns fallback for unknown OS', () => {
      const cmd = buildVerifyEnvCommand('unknown', 'https://aura.casabero.com');
      expect(cmd).toContain('No disponible');
    });
  });
});

describe('isModelHeavy', () => {
  it('returns true for models larger than 10 GB', () => {
    const elevenGB = 11 * 1024 * 1024 * 1024;
    expect(isModelHeavy(elevenGB)).toBe(true);
  });

  it('returns false for models smaller than 10 GB', () => {
    const oneGB = 1 * 1024 * 1024 * 1024;
    expect(isModelHeavy(oneGB)).toBe(false);
  });

  it('returns false for exactly 10 GB (boundary)', () => {
    const tenGB = 10 * 1024 * 1024 * 1024;
    expect(isModelHeavy(tenGB)).toBe(false);
  });

  it('handles zero size', () => {
    expect(isModelHeavy(0)).toBe(false);
  });
});

describe('ollamaLocalBridge module shape', () => {
  it('all exported functions are callable', () => {
    expect(typeof classifyEndpointHost).toBe('function');
    expect(typeof isLoopbackEndpoint).toBe('function');
    expect(typeof isPrivateLanEndpoint).toBe('function');
    expect(typeof buildCopyableDiagnostic).toBe('function');
    expect(typeof buildCurlCommand).toBe('function');
    expect(typeof buildPowerShellCurlCommand).toBe('function');
    expect(typeof buildVerifyEnvCommand).toBe('function');
    expect(typeof isModelHeavy).toBe('function');
    expect(typeof diagnoseOllamaLocal).toBe('function');
  });
});

describe('diagnoseOllamaLocal with selectedModel', () => {
  const endpoint = 'http://127.0.0.1:11434';

  function createFetchMock(models: Array<{ name: string; modified_at: string; size: number }>, chatOk: boolean = true) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((url: string | Request, init?: any) => {
      const urlStr = typeof url === 'string' ? url : url.url;
      if (urlStr.includes('/api/tags')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ models }),
        } as Response);
      }
      if (urlStr.includes('/api/chat')) {
        if (!chatOk) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({}),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: { content: 'OK' } }),
        } as Response);
      }
      return Promise.reject(new Error('unexpected fetch: ' + urlStr));
    });
  }

  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'https://aura.casabero.com' },
      isSecureContext: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses selectedModel when it is installed', async () => {
    const fetchSpy = createFetchMock([
      { name: 'qwen2.5:3b', modified_at: '2026-01-01T00:00:00Z', size: 2 * 1024 * 1024 * 1024 },
      { name: 'llama3.2:3b', modified_at: '2026-01-01T00:00:00Z', size: 2 * 1024 * 1024 * 1024 },
    ]);

    const result = await diagnoseOllamaLocal(endpoint, 'llama3.2:3b');
    expect(result.status).toBe('ready');
    expect(result.details.selectedModel).toBe('llama3.2:3b');
    expect(result.details.modelsInstalled).toContain('qwen2.5:3b');
    expect(result.details.modelsInstalled).toContain('llama3.2:3b');

    // Verify the chat request used the selected model
    const chatCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('/api/chat'));
    expect(chatCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(chatCalls[0][1].body as string);
    expect(body.model).toBe('llama3.2:3b');

    fetchSpy.mockRestore();
  });

  it('auto-selects qwen2.5:3b when no selectedModel and qwen is installed', async () => {
    const fetchSpy = createFetchMock([
      { name: 'qwen2.5:3b', modified_at: '2026-01-01T00:00:00Z', size: 2 * 1024 * 1024 * 1024 },
    ]);

    const result = await diagnoseOllamaLocal(endpoint);
    expect(result.status).toBe('ready');
    expect(result.details.selectedModel).toBe('qwen2.5:3b');

    fetchSpy.mockRestore();
  });

  it('auto-selects gemma2:2b when qwen not installed but gemma is', async () => {
    const fetchSpy = createFetchMock([
      { name: 'gemma2:2b', modified_at: '2026-01-01T00:00:00Z', size: 1.5 * 1024 * 1024 * 1024 },
    ]);

    const result = await diagnoseOllamaLocal(endpoint);
    expect(result.status).toBe('ready');
    expect(result.details.selectedModel).toBe('gemma2:2b');

    fetchSpy.mockRestore();
  });

  it('falls back to first installed model when no recommended models exist', async () => {
    const fetchSpy = createFetchMock([
      { name: 'mistral:7b', modified_at: '2026-01-01T00:00:00Z', size: 4 * 1024 * 1024 * 1024 },
    ]);

    const result = await diagnoseOllamaLocal(endpoint);
    expect(result.status).toBe('ready');
    expect(result.details.selectedModel).toBe('mistral:7b');
    expect(result.message).toContain('mistral:7b');

    fetchSpy.mockRestore();
  });

  it('returns model_missing when no models are installed', async () => {
    const fetchSpy = createFetchMock([]);

    const result = await diagnoseOllamaLocal(endpoint);
    expect(result.status).toBe('model_missing');

    fetchSpy.mockRestore();
  });

  it('rejects selectedModel that is not in installed list and falls back', async () => {
    const fetchSpy = createFetchMock([
      { name: 'gemma2:2b', modified_at: '2026-01-01T00:00:00Z', size: 1.5 * 1024 * 1024 * 1024 },
    ]);

    const result = await diagnoseOllamaLocal(endpoint, 'nonexistent:99b');
    expect(result.status).toBe('ready');
    expect(result.details.selectedModel).toBe('gemma2:2b');

    fetchSpy.mockRestore();
  });

  it('returns model_missing when selectedModel is provided but no models installed', async () => {
    const fetchSpy = createFetchMock([]);

    const result = await diagnoseOllamaLocal(endpoint, 'qwen2.5:3b');
    expect(result.status).toBe('model_missing');

    fetchSpy.mockRestore();
  });

  it('handles the heavy model: hf.co/yuxinlu1/gemma-4-12B-coder-fable5-composer2.5-v1-GGUF:Q8_0', async () => {
    const heavyModelName = 'hf.co/yuxinlu1/gemma-4-12B-coder-fable5-composer2.5-v1-GGUF:Q8_0';
    const heavySize = 12 * 1024 * 1024 * 1024; // 12 GB

    const fetchSpy = createFetchMock([
      { name: heavyModelName, modified_at: '2026-01-01T00:00:00Z', size: heavySize },
    ]);

    const result = await diagnoseOllamaLocal(endpoint, heavyModelName);
    expect(result.status).toBe('ready');
    expect(result.details.selectedModel).toBe(heavyModelName);
    expect(result.details.selectedModelSize).toBe(heavySize);

    const isHeavy = isModelHeavy(result.details.selectedModelSize!);
    expect(isHeavy).toBe(true);

    const chatCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('/api/chat'));
    expect(chatCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(chatCalls[0][1].body as string);
    expect(body.model).toBe(heavyModelName);

    fetchSpy.mockRestore();
  });

  it('includes selectedModelSize in diagnostic details', async () => {
    const fetchSpy = createFetchMock([
      { name: 'phi3:mini', modified_at: '2026-01-01T00:00:00Z', size: 2.5 * 1024 * 1024 * 1024 },
    ]);

    const result = await diagnoseOllamaLocal(endpoint, 'phi3:mini');
    expect(result.details.selectedModelSize).toBe(2.5 * 1024 * 1024 * 1024);

    fetchSpy.mockRestore();
  });
});
