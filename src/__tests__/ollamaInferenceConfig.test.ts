import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OLLAMA_INFERENCE,
  resolveOllamaInferenceConfig,
} from '../services/ollamaInferenceConfig';

describe('resolveOllamaInferenceConfig', () => {
  it('uses one complete canonical default snapshot', () => {
    expect(resolveOllamaInferenceConfig({ temperature: 0.1 })).toEqual({
      ...DEFAULT_OLLAMA_INFERENCE,
      temperature: 0.1,
    });
  });

  it('preserves every configured inference field for provider and receipt reuse', () => {
    expect(resolveOllamaInferenceConfig({
      temperature: 0.2,
      ollamaTopP: 0.8,
      ollamaNumCtx: 8192,
      ollamaNumPredict: 1600,
      ollamaSeed: 42,
      ollamaKeepAlive: '5m',
      ollamaTimeoutSeconds: 300,
    })).toEqual({
      temperature: 0.2,
      topP: 0.8,
      think: false,
      numCtx: 8192,
      numPredict: 1600,
      seed: 42,
      keepAlive: '5m',
      timeoutSeconds: 300,
    });
  });
});
