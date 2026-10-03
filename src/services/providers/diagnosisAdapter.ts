import type { AIProvider } from '../../types';
import type { ProviderMetrics, ProviderProgressEvent } from '../../types';

export type DiagnosisAdapterProgressEvent =
  | { type: 'status'; text: string }
  | { type: 'chunk'; text: string }
  /** Per-issue diagnosis: a fragment request started (index is 0-based). */
  | { type: 'fragment'; text: string; issueId: string; index: number; total: number };

export interface DiagnosisAdapterConfig {
  provider: AIProvider;
}

export interface DiagnosisAdapterResult {
  text: string;
  metrics: ProviderMetrics;
}

export class AIProviderDiagnosisAdapter {
  private provider: AIProvider;

  constructor(config: DiagnosisAdapterConfig) {
    this.provider = config.provider;
  }

  async diagnose(prompt: string, responseSchema?: Record<string, unknown>, signal?: AbortSignal): Promise<DiagnosisAdapterResult> {
    const result = await this.provider.generateText(prompt, { responseSchema, signal });
    return {
      text: result.text,
      metrics: result.metrics,
    };
  }

  async diagnoseWithProgress(
    prompt: string,
    onProgress: (event: DiagnosisAdapterProgressEvent) => void,
    responseSchema?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<DiagnosisAdapterResult> {
    if (!this.provider.generateTextWithProgress) {
      return this.diagnose(prompt, responseSchema, signal);
    }
    const result = await this.provider.generateTextWithProgress(prompt, (event: ProviderProgressEvent) => {
      if (event.chunk) onProgress({ type: 'chunk', text: event.chunk });
      else onProgress({ type: 'status', text: event.message });
    }, { responseSchema, signal });
    return {
      text: result.text,
      metrics: result.metrics,
    };
  }
}
