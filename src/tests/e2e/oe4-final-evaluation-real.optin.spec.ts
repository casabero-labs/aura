import { expect, test } from '@playwright/test';
import { FINAL_EVALUATION_PROTOCOL } from '../../services/benchmark/finalEvaluationProtocol';

const ACTIVE = process.env.AURA_OE4_REAL?.trim() === '1';
const OLLAMA_URL = process.env.AURA_OLLAMA_URL?.trim() || 'http://127.0.0.1:11434';
const MODEL_ID = FINAL_EVALUATION_PROTOCOL.models[0];
const RECEIPT_DB = 'aura-oe4-real-smoke-v2';

interface OllamaChatResponse {
  model?: string;
  message?: { content?: string };
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

test.describe('OE4 V2 — Ollama real opt-in', () => {
  test.skip(!ACTIVE, 'Requiere AURA_OE4_REAL=1, Ollama activo y el modelo congelado instalado.');

  test('usa el ID exacto, realiza warm-up más diagnóstico y persiste el recibo', async ({ page, request }) => {
    test.setTimeout(20 * 60_000);

    const tagsResponse = await request.get(`${OLLAMA_URL}/api/tags`);
    expect(tagsResponse.ok(), 'Ollama debe responder en /api/tags').toBe(true);
    const tags = await tagsResponse.json() as { models?: Array<{ name?: string; model?: string }> };
    expect(tags.models?.some((model) => model.name === MODEL_ID || model.model === MODEL_ID)).toBe(true);

    const prompts = [
      'Warm-up OE4 excluded from evaluation. Reply with exactly: READY',
      'Return exactly one JSON object: {"contractId":"aura.diagnosis.v2"}.',
    ];
    const responses: OllamaChatResponse[] = [];

    for (const prompt of prompts) {
      const response = await request.post(`${OLLAMA_URL}/api/chat`, {
        data: {
          model: MODEL_ID,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          keep_alive: FINAL_EVALUATION_PROTOCOL.inference.keepAlive,
          options: {
            temperature: FINAL_EVALUATION_PROTOCOL.inference.temperature,
            top_p: FINAL_EVALUATION_PROTOCOL.inference.topP,
            num_ctx: FINAL_EVALUATION_PROTOCOL.inference.numCtx,
            num_predict: 128,
          },
        },
        timeout: FINAL_EVALUATION_PROTOCOL.inference.timeoutSeconds * 1000,
      });
      expect(response.ok()).toBe(true);
      const body = await response.json() as OllamaChatResponse;
      expect(body.model).toBe(MODEL_ID);
      expect(body.prompt_eval_count).toBeGreaterThan(0);
      expect(body.eval_count).toBeGreaterThan(0);
      expect(body.total_duration).toBeGreaterThan(0);
      if (prompt.includes('diagnosis.v2')) {
        expect(() => JSON.parse(body.message?.content ?? '')).not.toThrow();
      } else {
        expect(body.message?.content?.trim().length).toBeGreaterThan(0);
      }
      responses.push(body);
    }

    await page.goto('/');
    await page.evaluate(async ({ databaseName, receipt }) => {
      await new Promise<void>((resolve, reject) => {
        const requestOpen = indexedDB.open(databaseName, 1);
        requestOpen.onupgradeneeded = () => requestOpen.result.createObjectStore('receipts', { keyPath: 'id' });
        requestOpen.onerror = () => reject(requestOpen.error);
        requestOpen.onsuccess = () => {
          const db = requestOpen.result;
          const transaction = db.transaction('receipts', 'readwrite');
          transaction.objectStore('receipts').put(receipt);
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }, {
      databaseName: RECEIPT_DB,
      receipt: {
        id: 'latest',
        modelId: MODEL_ID,
        calls: responses.map((response) => ({
          promptTokens: response.prompt_eval_count,
          outputTokens: response.eval_count,
          totalDuration: response.total_duration,
        })),
      },
    });

    await page.reload();
    const persisted = await page.evaluate(async (databaseName) => new Promise<unknown>((resolve, reject) => {
      const requestOpen = indexedDB.open(databaseName, 1);
      requestOpen.onerror = () => reject(requestOpen.error);
      requestOpen.onsuccess = () => {
        const db = requestOpen.result;
        const transaction = db.transaction('receipts', 'readonly');
        const read = transaction.objectStore('receipts').get('latest');
        read.onsuccess = () => { db.close(); resolve(read.result); };
        read.onerror = () => reject(read.error);
      };
    }), RECEIPT_DB) as { modelId: string; calls: unknown[] };

    expect(persisted.modelId).toBe(MODEL_ID);
    expect(persisted.calls).toHaveLength(2);
  });
});
