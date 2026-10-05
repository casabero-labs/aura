import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from '../services/providers/ollamaProvider';
import { NonLocalEndpointError, isLocalLoopback } from '../services/loopback';
import { fetchOllamaModels, diagnoseOllamaLocal } from '../services/ollamaLocalBridge';
import type { AuditReport } from '../types';

const NON_LOCAL = ['http://192.168.1.5:11434', 'https://example.com', 'http://10.0.0.2:11434', 'http://ollama.local:11434', 'http://0.0.0.0:11434'];
const LOCAL = ['http://localhost:11434', 'http://127.0.0.1:11434', 'http://127.8.9.10:11434', 'http://[::1]:11434', 'http://ollama.localhost:11434', 'http://2130706433:11434'];

const report = {
  rowCount: 2, colCount: 1, score: 90, issues: [], columnStats: {},
} as unknown as AuditReport;

describe('Ollama is local only', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(LOCAL)('accepts loopback %s', (url) => {
    expect(isLocalLoopback(url)).toBe(true);
  });

  it.each(NON_LOCAL)('rejects non-loopback %s', (url) => {
    expect(isLocalLoopback(url)).toBe(false);
  });

  it.each(NON_LOCAL)('OllamaProvider with %s refuses every dataset-bearing call before fetch', async (url) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const provider = new OllamaProvider('qwen3:8b', 0.1, url);

    await expect(provider.generateText('dataset prompt')).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.generateText('dataset prompt')).rejects.toThrow(/no es una dirección de este equipo/);
    await expect(provider.generateTextWithProgress('dataset prompt', () => {})).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.analyzeStream(report, () => {})).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.generateExecutiveReport(report)).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.generateExecutiveReportStream(report, () => {})).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.preloadModel()).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.listModels()).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.pullModel('qwen3:8b')).rejects.toBeInstanceOf(NonLocalEndpointError);
    await expect(provider.isAvailable()).resolves.toBe(false);
    await expect(fetchOllamaModels(url)).rejects.toBeInstanceOf(NonLocalEndpointError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('diagnoseOllamaLocal does not probe a LAN endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const diagnostic = await diagnoseOllamaLocal('http://ollama.local:11434');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(['not_configured', 'insecure_context', 'unsupported_browser']).toContain(diagnostic.status);
  });

  it('OllamaProvider with a loopback URL still reaches fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ model: 'qwen3:8b', message: { content: 'ok' } })),
    );
    const provider = new OllamaProvider('qwen3:8b', 0.1, 'http://127.0.0.1:11434');
    await expect(provider.generateText('hola')).resolves.toMatchObject({ text: 'ok' });
    expect(fetchSpy).toHaveBeenCalledWith('http://127.0.0.1:11434/api/chat', expect.anything());
  });
});
