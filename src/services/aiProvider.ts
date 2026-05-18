/**
 * AI Provider Factory — Capa 2: Estabilidad Cognitiva
 * 
 * Punto central de creación de proveedores de IA.
 * Permite intercambiar entre Gemini (cloud) y WebLLM (local)
 * sin modificar la lógica de la aplicación.
 * 
 * Referencia TFM: §3.3.3 — Arquitectura de Capas de Estabilidad
 * OE2: Benchmarking multi-modelo
 * OE3: Arquitectura local-first
 */

import { AIConfig, AIProvider } from '../types';
import { GeminiProvider } from './providers/geminiProvider';
import { OpenAIProvider } from './providers/openaiProvider';
import { ChromePromptProvider } from './providers/chromeProvider';

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

/**
 * Crea el proveedor de IA según la configuración del usuario.
 */
export const createAIProvider = (config: AIConfig): AIProvider => {
  switch (config.providerType) {
    case 'chrome':
      return new ChromePromptProvider(config.temperature);
    
    case 'local':
      return new LazyWebLLMProvider(config.model, config.temperature);
    
    case 'cloud':
    default: {
      // Google usa su SDK nativo; el resto son OpenAI-compatibles
      if (config.cloudProvider === 'google') {
        return new GeminiProvider(config.apiKey, config.model, config.temperature);
      }
      
      // Buscar baseURL en el registro de modelos
      const modelEntry = AVAILABLE_MODELS.cloud.find(m => m.id === config.model);
      const baseURL = modelEntry?.baseURL || 'https://api.openai.com/v1';
      
      return new OpenAIProvider({
        baseURL,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
      });
    }
  }
};

/**
 * Verifica el soporte de WebGPU en el navegador actual.
 * Necesario para determinar si la inferencia local (Capa 0) es viable.
 */
export const checkWebGPUSupport = async (): Promise<boolean> => {
  try {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
};

/**
 * Lista de modelos disponibles por proveedor.
 * Usada en SettingsPanel para poblar el selector.
 */
export const AVAILABLE_MODELS = {
  cloud: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Gemini', cloudProvider: 'google' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Gemini', cloudProvider: 'google' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Gemini', cloudProvider: 'google' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', cloudProvider: 'groq', baseURL: 'https://api.groq.com/openai/v1' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'Groq', cloudProvider: 'groq', baseURL: 'https://api.groq.com/openai/v1' },
    { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', cloudProvider: 'deepseek', baseURL: 'https://api.deepseek.com/v1' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'DeepSeek', cloudProvider: 'deepseek', baseURL: 'https://api.deepseek.com/v1' },
    { id: 'openrouter/auto', name: 'OpenRouter Auto', provider: 'OpenRouter', cloudProvider: 'openrouter', baseURL: 'https://openrouter.ai/api/v1' },
    { id: 'minimax-m2.7', name: 'MiniMax M2.7', provider: 'MiniMax', cloudProvider: 'minimax', baseURL: 'https://api.minimax.io/v1' },
  ],
  local: [
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.8 },
    { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (4-bit)', provider: 'WebLLM', sizeGB: 0.7 },
    { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.7 },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.9 },
    { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.4 },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini (4-bit)', provider: 'WebLLM', sizeGB: 2.1 },
    { id: 'Gemma-2-2B-it-q4f16_1-MLC', name: 'Gemma 2 2B (4-bit)', provider: 'WebLLM', sizeGB: 1.2 },
  ],
  chrome: [
    { id: 'gemini-nano', name: 'Gemini Nano (Chrome Built-in)', provider: 'Chrome AI' },
  ]
};
