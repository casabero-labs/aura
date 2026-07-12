import { afterEach, describe, expect, it, vi } from 'vitest';
import { pullOllamaModel } from '../services/ollamaLocalBridge';

afterEach(() => vi.unstubAllGlobals());

describe('pullOllamaModel', () => {
  it('reports real byte progress and completion from Ollama streaming events', async () => {
    const body = [
      JSON.stringify({ status: 'pulling manifest' }),
      JSON.stringify({ status: 'downloading', digest: 'sha256:abc', completed: 25, total: 100 }),
      JSON.stringify({ status: 'downloading', digest: 'sha256:abc', completed: 100, total: 100 }),
      JSON.stringify({ status: 'success' }),
      '',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    const events: Array<{ percent: number | null; status: string }> = [];
    await pullOllamaModel('http://127.0.0.1:11434', 'model:test', (event) => events.push(event));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ percent: 25, status: 'downloading' }),
      expect.objectContaining({ percent: 100, status: 'downloading' }),
      expect.objectContaining({ percent: 100, status: 'success' }),
    ]));
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/pull',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fails visibly when Ollama rejects the download', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"disk full"}', { status: 500 })));
    await expect(pullOllamaModel('http://127.0.0.1:11434', 'model:test', () => {}))
      .rejects.toThrow(/disk full/);
  });

  it('refuses to send a model download to a remote endpoint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(pullOllamaModel('https://models.example.com', 'model:test', () => {}))
      .rejects.toThrow(/solo permite descargar modelos en un Ollama local/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
