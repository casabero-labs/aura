/**
 * AI Provider Factory — Capa 2: Estabilidad Cognitiva
 * 
 * Punto central de creación de proveedores de IA.
 * Soporta local (WebLLM/WebGPU), cloud (OpenAI-compatible, Gemini), y Chrome AI.
 * 
 * Referencia TFM: §3.3.3 — Arquitectura de Capas de Estabilidad
 */

import { AIConfig, AIProvider, CloudProvider } from '../types';
import type { ChromePromptProvider } from './providers/chromeProvider';
import type { GeminiProvider } from './providers/geminiProvider';
import type { OpenAIProvider } from './providers/openaiProvider';
import { CLOUD_MODELS } from './modelRegistry';

export { AVAILABLE_MODELS, LOCAL_MODELS, CLOUD_MODELS, CHROME_MODELS } from './modelRegistry';
export { checkModelDownloaded, deleteDownloadedModel, getDownloadedModels } from './modelManager';

class LazyWebLLMProvider implements AIProvider {
  readonly name = 'WebLLM';
  readonly type = 'local' as const;

  private providerPromise?: Promise<AIProvider>;

  constructor(private model: string, private temperature: number) {}

  private async provider(): Promise<AIProvider> {
    if (!this.providerPromise) {
      this.providerPromise = import('./providers/webllmProvider').then(({ WebLLMProvider }) =>
        new WebLLMProvider(this.model, this.temperature)
      );
    }
    return this.providerPromise;
  }

  async analyzeStream(...args: Parameters<AIProvider['analyzeStream']>) {
    return (await this.provider()).analyzeStream(...args);
  }

  async generateExecutiveReport(...args: Parameters<AIProvider['generateExecutiveReport']>) {
    return (await this.provider()).generateExecutiveReport(...args);
  }

  async generateExecutiveReportStream(...args: Parameters<AIProvider['generateExecutiveReportStream']>) {
    return (await this.provider()).generateExecutiveReportStream(...args);
  }

  async generateText(...args: Parameters<AIProvider['generateText']>) {
    return (await this.provider()).generateText(...args);
  }

  async isAvailable() {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
    return (await this.provider()).isAvailable();
  }

  async preloadModel(...args: Parameters<NonNullable<AIProvider['preloadModel']>>) {
    return (await this.provider()).preloadModel?.(...args);
  }
}

class LazyChromeProvider implements AIProvider {
  readonly name = 'Chrome AI';
  readonly type = 'chrome' as const;

  private providerPromise?: Promise<AIProvider>;

  constructor(private temperature: number) {}

  private async provider(): Promise<AIProvider> {
    if (!this.providerPromise) {
      this.providerPromise = import('./providers/chromeProvider').then(({ ChromePromptProvider }) =>
        new ChromePromptProvider(this.temperature)
      );
    }
    return this.providerPromise;
  }

  async analyzeStream(...args: Parameters<AIProvider['analyzeStream']>) {
    return (await this.provider()).analyzeStream(...args);
  }

  async generateExecutiveReport(...args: Parameters<AIProvider['generateExecutiveReport']>) {
    return (await this.provider()).generateExecutiveReport(...args);
  }

  async generateExecutiveReportStream(...args: Parameters<AIProvider['generateExecutiveReportStream']>) {
    return (await this.provider()).generateExecutiveReportStream(...args);
  }

  async generateText(...args: Parameters<AIProvider['generateText']>) {
    return (await this.provider()).generateText(...args);
  }

  async isAvailable() {
    return (await this.provider()).isAvailable();
  }
}

class LazyCloudProvider implements AIProvider {
  readonly name = 'Cloud';
  readonly type = 'cloud' as const;

  private providerPromise?: Promise<AIProvider>;

  constructor(
    private cloudProvider: string | undefined,
    private apiKey: string | undefined,
    private model: string,
    private temperature: number,
    private baseURL: string,
  ) {}

  private async provider(): Promise<AIProvider> {
    if (!this.providerPromise) {
      if (this.cloudProvider === 'google') {
        this.providerPromise = import('./providers/geminiProvider').then(({ GeminiProvider }) =>
          new GeminiProvider(this.apiKey, this.model, this.temperature)
        );
      } else {
        this.providerPromise = import('./providers/openaiProvider').then(({ OpenAIProvider }) =>
          new OpenAIProvider({
            baseURL: this.baseURL,
            apiKey: this.apiKey,
            model: this.model,
            temperature: this.temperature,
          })
        );
      }
    }
    return this.providerPromise;
  }

  async analyzeStream(...args: Parameters<AIProvider['analyzeStream']>) {
    return (await this.provider()).analyzeStream(...args);
  }

  async generateExecutiveReport(...args: Parameters<AIProvider['generateExecutiveReport']>) {
    return (await this.provider()).generateExecutiveReport(...args);
  }

  async generateExecutiveReportStream(...args: Parameters<AIProvider['generateExecutiveReportStream']>) {
    return (await this.provider()).generateExecutiveReportStream(...args);
  }

  async generateText(...args: Parameters<AIProvider['generateText']>) {
    return (await this.provider()).generateText(...args);
  }

  async isAvailable() {
    return (await this.provider()).isAvailable();
  }
}

export const createAIProvider = (config: AIConfig): AIProvider => {
  switch (config.providerType) {
    case 'chrome':
      return new LazyChromeProvider(config.temperature);

    case 'cloud': {
      const modelEntry = CLOUD_MODELS.find(m => m.id === config.model);
      const baseURL = modelEntry?.baseURL || 'https://api.openai.com/v1';
      return new LazyCloudProvider(
        config.cloudProvider,
        config.apiKey,
        config.model,
        config.temperature,
        baseURL,
      );
    }

    case 'local':
    default:
      return new LazyWebLLMProvider(config.model, config.temperature);
  }
};

export const checkWebGPUSupport = async (): Promise<boolean> => {
  try {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
};
