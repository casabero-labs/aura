import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FINAL_EVALUATION_OLLAMA_MODEL_IDS,
  FINAL_EVALUATION_OLLAMA_MODELS,
  OLLAMA_MODELS,
} from '../services/modelRegistry';
import { OE4_MODELS } from '../services/benchmark/finalEvaluationProtocol';
import {
  assertFrozenModelIdentifiers,
  parseOllamaClientVersion,
  runOllamaPreflight,
} from '../scripts/validate-ollama.mjs';

const EXPECTED_MODEL_IDS = [
  'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL',
] as const;

describe('OE4 final evaluation Ollama models — Task 3', () => {
  it('pins exactly the three frozen Unsloth model identifiers', () => {
    expect(FINAL_EVALUATION_OLLAMA_MODEL_IDS).toEqual(EXPECTED_MODEL_IDS);
    expect(FINAL_EVALUATION_OLLAMA_MODELS.map((model) => model.id)).toEqual(
      EXPECTED_MODEL_IDS,
    );
    expect(OE4_MODELS).toBe(FINAL_EVALUATION_OLLAMA_MODEL_IDS);
  });

  it('marks formal models explicitly with their frozen quantization', () => {
    expect(FINAL_EVALUATION_OLLAMA_MODELS).toHaveLength(3);
    for (const model of FINAL_EVALUATION_OLLAMA_MODELS) {
      expect(model.formalEvaluation).toBe(true);
      expect(model.quantization).toBe('UD-Q4_K_XL');
      expect(model.repository).toMatch(/^huggingface\.co\/unsloth\//);
      expect(model.recommended).toBe(true);
      expect(model.referenceSizeGB).toBeLessThan(6);
    }
  });

  it('uses only the three frozen models as Ollama recommendations', () => {
    expect(OLLAMA_MODELS.filter((model) => model.recommended).map((model) => model.id)).toEqual(
      EXPECTED_MODEL_IDS,
    );
  });

  it('keeps qwen2.5:3b as a general operational alternative', () => {
    expect(OLLAMA_MODELS).toContainEqual(
      expect.objectContaining({
        id: 'qwen2.5:3b',
        formalEvaluation: false,
      }),
    );
  });

  it('extracts the actual Ollama client version when the CLI reports a mismatch warning', () => {
    expect(
      parseOllamaClientVersion(
        'ollama version is 0.20.3\nWarning: client version is 0.31.1',
      ),
    ).toBe('0.31.1');
    expect(parseOllamaClientVersion('ollama version is 0.20.3')).toBe('0.20.3');
  });

  it('rejects a manifest whose identifiers drift from the frozen protocol', () => {
    expect(() =>
      assertFrozenModelIdentifiers(
        [...EXPECTED_MODEL_IDS],
        [...EXPECTED_MODEL_IDS].reverse(),
      ),
    ).toThrow(/identificadores.*protocolo/i);
  });

  it('validates all three formal models and persists their exact digests', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'aura-oe4-preflight-'));
    const outputPath = join(workDir, 'preflight.json');
    const digests = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const chatBodies: Array<{ model: string; think: boolean }> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/version')) {
        return new Response(JSON.stringify({ version: '0.20.3' }), { status: 200 });
      }
      if (url.endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({
            models: EXPECTED_MODEL_IDS.map((id, index) => ({
              name: id,
              model: id,
              digest: digests[index],
              size: 1_000_000,
              details: { quantization_level: 'UD-Q4_K_XL' },
            })),
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/api/chat')) {
        chatBodies.push(JSON.parse(String(init?.body ?? '{}')) as { model: string; think: boolean });
        return new Response(
          JSON.stringify({
            message: { content: 'AURA_OLLAMA_OK' },
            prompt_eval_count: 12,
            eval_count: 4,
            total_duration: 2_000_000,
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    try {
      const { receipt } = await runOllamaPreflight({
        args: [],
        clientVersion: '0.20.3',
        minimumFreeDiskGB: 0,
        outputPath,
      });
      const persisted = JSON.parse(await readFile(outputPath, 'utf8')) as {
        status: string;
        formal: boolean;
        models: Array<{ id: string; digest: string }>;
      };

      expect(receipt.status).toBe('passed');
      expect(persisted.formal).toBe(true);
      expect(persisted.models.map((model) => model.id)).toEqual(EXPECTED_MODEL_IDS);
      expect(persisted.models.map((model) => model.digest)).toEqual(digests);
      expect(chatBodies.map((body) => body.model)).toEqual(EXPECTED_MODEL_IDS);
      expect(chatBodies.every((body) => body.think === false)).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
