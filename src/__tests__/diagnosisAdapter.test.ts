import { describe, expect, it } from 'vitest';
import type { AIProvider, ProviderMetrics, ProviderProgressEvent } from '../types';
import { AIProviderDiagnosisAdapter } from '../services/providers/diagnosisAdapter';

const metrics: ProviderMetrics = {
  provider: 'Context-aware provider',
  model: 'qwen-test',
  latencyMs: 10,
  firstTokenMs: 2,
  tokensGenerated: 4,
  isLocal: true,
  timestamp: '2026-07-13T00:00:00.000Z',
};

describe('AIProviderDiagnosisAdapter', () => {
  it('preserves the provider instance context for progress-enabled class methods', async () => {
    const provider = {
      name: 'Context-aware provider',
      type: 'ollama',
      contextMarker: 'bound-provider',
      async generateTextWithProgress(
        this: { contextMarker: string },
        _prompt: string,
        onProgress: (event: ProviderProgressEvent) => void,
      ) {
        if (this.contextMarker !== 'bound-provider') {
          throw new Error('provider context was lost');
        }
        onProgress({ stage: 'generating', message: 'Generando respuesta' });
        return { text: '{"ok":true}', metrics };
      },
      async generateText() {
        return { text: '{"fallback":true}', metrics };
      },
    } as unknown as AIProvider;
    const adapter = new AIProviderDiagnosisAdapter({ provider });
    const progress: string[] = [];

    const result = await adapter.diagnoseWithProgress('prompt', (event) => {
      progress.push(event.text);
    });

    expect(result.text).toBe('{"ok":true}');
    expect(progress).toEqual(['Generando respuesta']);
  });
});
