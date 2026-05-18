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
import { WebLLMProvider } from './providers/webllmProvider';

/**
 * Crea el proveedor de IA según la configuración del usuario.
 */
export const createAIProvider = (config: AIConfig): AIProvider => {
  switch (config.providerType) {
    case 'local':
      return new WebLLMProvider(config.model, config.temperature);
    
    case 'cloud':
    default:
      return new GeminiProvider(config.apiKey, config.model, config.temperature);
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
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Gemini' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Gemini' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Gemini' },
  ],
  local: [
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.8 },
    { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (4-bit)', provider: 'WebLLM', sizeGB: 0.7 },
    { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.7 },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.9 },
    { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.4 },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini (4-bit)', provider: 'WebLLM', sizeGB: 2.1 },
    { id: 'Gemma-2-2B-it-q4f16_1-MLC', name: 'Gemma 2 2B (4-bit)', provider: 'WebLLM', sizeGB: 1.2 },
  ]
};
