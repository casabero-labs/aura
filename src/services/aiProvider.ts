/**
 * AI Provider Factory — Capa 2: Estabilidad Cognitiva
 * 
 * Punto central de creación de proveedores de IA.
 * Local-first con WebLLM (WebGPU) como único proveedor activo.
 * 
 * Referencia TFM: §3.3.3 — Arquitectura de Capas de Estabilidad
 * OE3: Arquitectura local-first
 */

import { AIConfig, AIProvider } from '../types';

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

export const createAIProvider = (config: AIConfig): AIProvider => {
  return new LazyWebLLMProvider(config.model, config.temperature);
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
};
