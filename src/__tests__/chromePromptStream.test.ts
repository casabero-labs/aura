import { describe, it, expect } from 'vitest';
import {
  ChromeStreamDegeneratedError,
  DEGENERATE_WHITESPACE_RUN,
  readPromptStream,
} from '../services/providers/chromeProvider';

const streamOf = <T,>(chunks: T[]) => new ReadableStream<T>({
  start(controller) {
    chunks.forEach((chunk) => controller.enqueue(chunk));
    controller.close();
  },
});

describe('readPromptStream', () => {
  it('reads string deltas (current Chrome) without TextDecoder', async () => {
    const deltas: string[] = [];
    const { text } = await readPromptStream(streamOf(['{"a"', ': 1', '}']), (delta) => deltas.push(delta));
    expect(text).toBe('{"a": 1}');
    expect(deltas).toEqual(['{"a"', ': 1', '}']);
  });

  it('reads cumulative chunks (Chrome 127-137) as deltas', async () => {
    const deltas: string[] = [];
    const { text } = await readPromptStream(streamOf(['Hola', 'Hola mundo', 'Hola mundo.']), (delta) => deltas.push(delta));
    expect(text).toBe('Hola mundo.');
    expect(deltas).toEqual(['Hola', ' mundo', '.']);
  });

  it('decodes byte chunks', async () => {
    const encoder = new TextEncoder();
    const { text } = await readPromptStream(streamOf([encoder.encode('niño '), encoder.encode('ok')]), () => undefined);
    expect(text).toBe('niño ok');
  });

  it('stops a whitespace loop from constrained decoding', async () => {
    const chunks = ['{"a": 1', ...Array.from({ length: DEGENERATE_WHITESPACE_RUN + 5 }, () => '\n')];
    await expect(readPromptStream(streamOf(chunks), () => undefined, { guardWhitespace: true }))
      .rejects.toBeInstanceOf(ChromeStreamDegeneratedError);
  });

  it('allows normal indentation', async () => {
    const json = JSON.stringify({ a: [1, 2, 3], b: 'texto' }, null, 2);
    const { text } = await readPromptStream(streamOf(json.split('')), () => undefined, { guardWhitespace: true });
    expect(text).toBe(json);
  });
});
