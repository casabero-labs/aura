import type { AIConfig } from '../types';
import type { InferenceSnapshotV1 } from '../contracts/llm/types';

export const DEFAULT_OLLAMA_INFERENCE: Readonly<InferenceSnapshotV1> = Object.freeze({
  temperature: 0.1,
  topP: 0.9,
  think: false,
  numCtx: 16384,
  numPredict: 2400,
  seed: null,
  keepAlive: '10m',
  timeoutSeconds: 600,
});

export const resolveOllamaInferenceConfig = (
  config: Pick<
    AIConfig,
    | 'temperature'
    | 'ollamaTopP'
    | 'ollamaNumCtx'
    | 'ollamaNumPredict'
    | 'ollamaSeed'
    | 'ollamaKeepAlive'
    | 'ollamaTimeoutSeconds'
  >,
): InferenceSnapshotV1 => ({
  temperature: config.temperature,
  topP: config.ollamaTopP ?? DEFAULT_OLLAMA_INFERENCE.topP,
  think: false,
  numCtx: config.ollamaNumCtx ?? DEFAULT_OLLAMA_INFERENCE.numCtx,
  numPredict: config.ollamaNumPredict ?? DEFAULT_OLLAMA_INFERENCE.numPredict,
  seed: config.ollamaSeed ?? DEFAULT_OLLAMA_INFERENCE.seed,
  keepAlive: config.ollamaKeepAlive ?? DEFAULT_OLLAMA_INFERENCE.keepAlive,
  timeoutSeconds: config.ollamaTimeoutSeconds ?? DEFAULT_OLLAMA_INFERENCE.timeoutSeconds,
});
