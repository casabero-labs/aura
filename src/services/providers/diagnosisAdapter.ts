import type { AIProvider } from '../../types';
import type { ProviderMetrics, ProviderProgressEvent } from '../../types';

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

  async diagnose(prompt: string): Promise<DiagnosisAdapterResult> {
    const result = await this.provider.generateText(prompt);
    return {
      text: result.text,
      metrics: result.metrics,
    };
  }

  async diagnoseWithProgress(
    prompt: string,
    onProgress: (event: { type: 'chunk'; text: string }) => void
  ): Promise<DiagnosisAdapterResult> {
    const withProgress = this.provider.generateTextWithProgress;
    if (!withProgress) {
      return this.diagnose(prompt);
    }
    const result = await withProgress(prompt, (event: ProviderProgressEvent) => {
      if (event.stage === 'generating' || event.stage === 'completed') {
        onProgress({ type: 'chunk', text: event.message });
      }
    });
    return {
      text: result.text,
      metrics: result.metrics,
    };
  }
}
