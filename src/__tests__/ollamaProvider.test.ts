import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../services/providers/ollamaProvider';
import { buildCompactAnalysisPrompt } from '../services/providers/prompts';
import type { AuditReport } from '../types';

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

  describe('num_ctx and num_predict options', () => {
    it('applies every frozen formal inference option to the real request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ message: { content: 'ok' } }),
      } as Response);
      const provider = new OllamaProvider(model, 0.2, baseUrl, {
        ollamaNumCtx: 16384, ollamaNumPredict: 1600, ollamaTopP: 0.9,
        ollamaSeed: 42, ollamaKeepAlive: '10m', ollamaTimeoutSeconds: 600,
      } as any);

      await provider.generateText('formal prompt');

      const init = fetchSpy.mock.calls[0][1];
      const body = JSON.parse(init.body as string);
      expect(body).toEqual(expect.objectContaining({
        keep_alive: '10m',
        think: false,
        options: { temperature: 0.2, top_p: 0.9, num_ctx: 16384, num_predict: 1600, seed: 42 },
      }));
      expect(init.signal).toBeInstanceOf(AbortSignal);
      fetchSpy.mockRestore();
    });

    it('passes num_ctx and num_predict to /api/chat', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: { content: 'ok' } }),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl, {
        ollamaNumCtx: 32768,
        ollamaNumPredict: 2048,
      } as any);

      await provider.generateText('hello');

      expect(fetchSpy).toHaveBeenCalled();
      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.options).toMatchObject({
        temperature: 0.1,
        num_ctx: 32768,
        num_predict: 2048,
      });

      fetchSpy.mockRestore();
    });

    it('passes top_p to /api/chat and uses the OE4 default when not configured', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: { content: 'ok' } }),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);

      await provider.generateText('hello');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string) as {
        options: Record<string, unknown>;
      };
      expect(body.options.top_p).toBe(0.9);

      fetchSpy.mockRestore();
    });

    it('uses default num_ctx 16384 and num_predict 1200 when not configured', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: { content: 'ok' } }),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);

      await provider.generateText('hello');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.options).toMatchObject({
        num_ctx: 16384,
        num_predict: 1200,
      });

      fetchSpy.mockRestore();
    });

    it('prompt of ~11256 tokens passes with num_ctx 16384 (not oversized)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: { content: 'ok' } }),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl, {
        ollamaNumCtx: 16384,
      } as any);

      // ~11256 tokens = ~45024 chars (11256 * 4)
      const bigPrompt = 'x'.repeat(45024);

      await provider.generateText(bigPrompt);

      expect(fetchSpy).toHaveBeenCalled();
      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.options.num_ctx).toBe(16384);

      fetchSpy.mockRestore();
    });
  });

  describe('generateText exceed context error', () => {
    it('error message from exceed_context_size is descriptive', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve(JSON.stringify({
            error: 'Error: request exceeded context window size'
          })),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);

      try {
        await provider.generateText('hello');
        expect.fail('should have thrown');
      } catch (e: any) {
        expect(e.message).toMatch(/exceed.*context/i);
      }

      fetchSpy.mockRestore();
    });
  });

  describe('native Ollama telemetry', () => {
    it('preserves thinking separately and maps native token and duration fields', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            message: {
              content: 'Diagnóstico final',
              thinking: 'Razonamiento interno separado',
            },
            prompt_eval_count: 320,
            eval_count: 180,
            total_duration: 6_500_000_000,
            load_duration: 1_250_000_000,
            prompt_eval_duration: 840_000_000,
            eval_duration: 4_200_000_000,
          }),
        } as Response)
      );

      const provider = new OllamaProvider(model, 0.1, baseUrl);
      const result = await provider.generateText('hello');

      expect(result.text).toBe('Diagnóstico final');
      expect(result.thinking).toBe('Razonamiento interno separado');
      expect(result.metrics).toMatchObject({
        promptTokens: 320,
        tokensGenerated: 180,
        totalDurationMs: 6500,
        loadDurationMs: 1250,
        promptEvalDurationMs: 840,
        evalDurationMs: 4200,
      });

      fetchSpy.mockRestore();
    });

    it('uses only the model identity reported by Ollama in every response path', async () => {
      const observedModel = 'observed-model:Q4';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).endsWith('/api/tags')) {
          return new Response('{"models":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        const body = JSON.parse(String(init?.body ?? '{}')) as { stream?: boolean };
        if (body.stream) {
          const event = JSON.stringify({ model: observedModel, message: { content: '{}' }, eval_count: 1, done: true });
          return new Response(`${event}\n`, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
        }
        return new Response(JSON.stringify({ model: observedModel, message: { content: '{}' }, eval_count: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      const report = {
        score: 90, rowCount: 1, colCount: 1, duplicateRows: 0, delimiterDetected: ',',
        issues: [], columnStats: {}, scoreBreakdown: [],
      } as AuditReport;
      const provider = new OllamaProvider(model, 0.1, baseUrl);

      const observed = [
        (await provider.generateText('diagnosis')).metrics.model,
        (await provider.generateTextWithProgress('diagnosis', () => undefined)).metrics.model,
        (await provider.analyzeStream(report, () => undefined)).model,
        (await provider.generateExecutiveReport(report)).metrics.model,
        (await provider.generateExecutiveReportStream(report, () => undefined)).metrics.model,
      ];

      expect(observed).toEqual(Array(5).fill(observedModel));
      fetchSpy.mockRestore();
    });
  });
});

describe('buildCompactAnalysisPrompt', () => {
  const mockReport: AuditReport = {
    rowCount: 1000,
    colCount: 20,
    delimiterDetected: ',',
    score: 72,
    duplicateRows: 3,
    columnStats: Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [
        `col_${i}`,
        {
          name: `col_${i}`,
          inferredType: 'string',
          nullCount: i * 10,
          uniqueCount: 100,
          topFreq: [{ value: `val_${i}`, count: 50 }],
          sampleValues: [`sample_${i}_0`, `sample_${i}_1`, `sample_${i}_2`],
        }
      ])
    ),
    issues: Array.from({ length: 5 }, (_, i) => ({
      id: `issue_${i}`,
      ruleName: `RULE_${i}`,
      ruleId: `R${i}`,
      category: 'Higiene de Texto' as any,
      column: `col_${i}`,
      severity: 'warning' as any,
      count: 10,
      affectedPercentage: 5.0,
      description: `Issue ${i}`,
      sampleValues: [`bad_${i}_0`, `bad_${i}_1`, `bad_${i}_2`],
    })),
    scoreBreakdown: [],
  };

  it('builds compact prompt without crashing', () => {
    const result = buildCompactAnalysisPrompt(mockReport);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Analisis compacto');
  });

  it('limits columns to 20 or fewer', () => {
    const result = buildCompactAnalysisPrompt(mockReport);
    const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}');
    expect(parsed.columns.length).toBeLessThanOrEqual(20);
  });

  it('limits bad samples to 1 per issue', () => {
    const result = buildCompactAnalysisPrompt(mockReport);
    const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}');
    for (const issue of parsed.issues) {
      expect(Array.isArray(issue.samples)).toBe(true);
    }
  });

  it('prompt is shorter than full JSON pretty-print would be', () => {
    const compact = buildCompactAnalysisPrompt(mockReport);
    // The compact JSON should be single-line (no pretty print)
    const compactJsonMatch = compact.match(/JSON \(compacto\):\s*(\{[\s\S]*?\})\s*$/m);
    expect(compactJsonMatch).toBeTruthy();
    const compactJson = compactJsonMatch![1];
    expect(compactJson).not.toContain('\n');
  });
});
