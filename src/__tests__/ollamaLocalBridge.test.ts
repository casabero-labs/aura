import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isLoopbackEndpoint,
  isPrivateLanEndpoint,
  classifyEndpointHost,
  buildCopyableDiagnostic,
  buildCurlCommand,
  buildPowerShellCurlCommand,
  buildVerifyEnvCommand,
  type OllamaDiagnostic,
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

describe('ollamaLocalBridge module shape', () => {
  it('all exported functions are callable', () => {
    expect(typeof classifyEndpointHost).toBe('function');
    expect(typeof isLoopbackEndpoint).toBe('function');
    expect(typeof isPrivateLanEndpoint).toBe('function');
    expect(typeof buildCopyableDiagnostic).toBe('function');
    expect(typeof buildCurlCommand).toBe('function');
    expect(typeof buildPowerShellCurlCommand).toBe('function');
    expect(typeof buildVerifyEnvCommand).toBe('function');
  });
});
