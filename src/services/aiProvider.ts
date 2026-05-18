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
      const modelEntry = AVAILABLE_MODELS.cloud.find(m => m.id === config.model);
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

export const AVAILABLE_MODELS = {
  local: [
    { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.7 },
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.8 },
    { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (4-bit)', provider: 'WebLLM', sizeGB: 0.7 },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.9 },
    { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.4 },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini (4-bit)', provider: 'WebLLM', sizeGB: 2.1 },
    { id: 'Gemma-2-2B-it-q4f16_1-MLC', name: 'Gemma 2 2B (4-bit)', provider: 'WebLLM', sizeGB: 1.2 },
  ],
  chrome: [
    { id: 'gemini-nano', name: 'Gemini Nano (Chrome Built-in)', provider: 'Chrome AI' },
  ],
  cloud: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', baseURL: '' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', baseURL: '' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', baseURL: '' },
    { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', baseURL: 'https://api.groq.com/openai/v1' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'Groq', baseURL: 'https://api.groq.com/openai/v1' },
    { id: 'minimax-m2.7', name: 'MiniMax M2.7', provider: 'MiniMax', baseURL: 'https://api.minimax.io/v1' },
    { id: 'openrouter/auto', name: 'OpenRouter Auto', provider: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', provider: 'Nvidia', baseURL: 'https://integrate.api.nvidia.com/v1' },
  ],
};
