/**
 * Model registry — Centralized, extensible model definitions.
 * Not hardcoded in the provider factory.
 * 
 * Local models use WebLLM/MLC format (experimental).
 * Cloud models use OpenAI-compatible or native SDK endpoints.
 * Ollama models run locally via Ollama server.
 */

export interface LocalModelDef {
  id: string;
  name: string;
  provider: 'WebLLM';
  sizeGB: number;
  family: string;
  recommended?: boolean;
}

export interface CloudModelDef {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  family?: string;
  recommended?: boolean;
}

export interface ChromeModelDef {
  id: string;
  name: string;
  provider: 'Chrome AI';
}

export interface OllamaModelDef {
  id: string;
  name: string;
  family: string;
  recommended?: boolean;
  formalEvaluation: boolean;
  quantization?: 'UD-Q4_K_XL';
  repository?: string;
}

/**
 * WebLLM local models (EXPERIMENTAL — moved out of production).
 * Only available when VITE_ENABLE_WEBLLM_EXPERIMENTAL=true.
 * Source: https://github.com/mlc-ai/web-llm
 */
export const LOCAL_MODELS: LocalModelDef[] = [
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 7B (4-bit)', provider: 'WebLLM', sizeGB: 4.0, family: 'Qwen', recommended: true },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.7, family: 'Qwen' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.9, family: 'Qwen' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.4, family: 'Qwen' },
  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', name: 'Llama 3.1 8B (4-bit)', provider: 'WebLLM', sizeGB: 4.4, family: 'Llama', recommended: true },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (4-bit)', provider: 'WebLLM', sizeGB: 1.8, family: 'Llama' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (4-bit)', provider: 'WebLLM', sizeGB: 0.7, family: 'Llama' },
  { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', name: 'Mistral 7B v0.3 (4-bit)', provider: 'WebLLM', sizeGB: 4.0, family: 'Mistral', recommended: true },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini (4-bit)', provider: 'WebLLM', sizeGB: 2.1, family: 'Phi' },
  { id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC', name: 'Phi-3 Mini 4K (4-bit)', provider: 'WebLLM', sizeGB: 2.1, family: 'Phi' },
  { id: 'Gemma-2-2B-it-q4f16_1-MLC', name: 'Gemma 2 2B (4-bit)', provider: 'WebLLM', sizeGB: 1.2, family: 'Gemma' },
  { id: 'Gemma-2-9B-it-q4f16_1-MLC', name: 'Gemma 2 9B (4-bit)', provider: 'WebLLM', sizeGB: 5.2, family: 'Gemma' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', name: 'SmolLM2 1.7B (4-bit)', provider: 'WebLLM', sizeGB: 0.9, family: 'SmolLM' },
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M (4-bit)', provider: 'WebLLM', sizeGB: 0.2, family: 'SmolLM' },
  { id: 'SmolLM2-135M-Instruct-q4f16_1-MLC', name: 'SmolLM2 135M (4-bit)', provider: 'WebLLM', sizeGB: 0.1, family: 'SmolLM' },
  { id: 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC', name: 'DeepSeek R1 Distill 1.5B (4-bit)', provider: 'WebLLM', sizeGB: 0.9, family: 'DeepSeek' },
  { id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC', name: 'DeepSeek R1 Distill 7B (4-bit)', provider: 'WebLLM', sizeGB: 4.0, family: 'DeepSeek' },
  { id: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC', name: 'DeepSeek R1 Distill 8B (4-bit)', provider: 'WebLLM', sizeGB: 4.4, family: 'DeepSeek' },
];

/**
 * Cloud models via OpenAI-compatible API or native SDK.
 */
export const CLOUD_MODELS: CloudModelDef[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', baseURL: '', family: 'Gemini', recommended: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', baseURL: '', family: 'Gemini', recommended: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', baseURL: '', family: 'Gemini' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', baseURL: '', family: 'Gemini' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', family: 'DeepSeek' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', family: 'DeepSeek' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', baseURL: 'https://api.groq.com/openai/v1', family: 'Llama', recommended: true },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'Groq', baseURL: 'https://api.groq.com/openai/v1', family: 'Llama' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'Groq', baseURL: 'https://api.groq.com/openai/v1', family: 'Mistral' },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', provider: 'MiniMax', baseURL: 'https://api.minimax.io/v1', family: 'MiniMax' },
  { id: 'openrouter/auto', name: 'OpenRouter Auto', provider: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', family: 'OpenRouter' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', provider: 'Nvidia', baseURL: 'https://integrate.api.nvidia.com/v1', family: 'Llama' },
];

/**
 * Chrome built-in models (Gemini Nano via Prompt API).
 */
export const CHROME_MODELS: ChromeModelDef[] = [
  { id: 'gemini-nano', name: 'Gemini Nano (Chrome Built-in)', provider: 'Chrome AI' },
];

export const FINAL_EVALUATION_OLLAMA_MODEL_IDS = [
  'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL',
] as const;

export const DEFAULT_OLLAMA_MODEL_ID = FINAL_EVALUATION_OLLAMA_MODEL_IDS[0];

/** Exact frozen models for the OE4 final campaign. */
export const FINAL_EVALUATION_OLLAMA_MODELS: readonly OllamaModelDef[] = [
  {
    id: FINAL_EVALUATION_OLLAMA_MODEL_IDS[0],
    name: 'Qwen 3 8B · OE4 (UD-Q4_K_XL)',
    family: 'Qwen3',
    recommended: true,
    formalEvaluation: true,
    quantization: 'UD-Q4_K_XL',
    repository: 'huggingface.co/unsloth/Qwen3-8B-GGUF',
  },
  {
    id: FINAL_EVALUATION_OLLAMA_MODEL_IDS[1],
    name: 'Gemma 3 4B IT QAT · OE4 (UD-Q4_K_XL)',
    family: 'Gemma 3',
    recommended: true,
    formalEvaluation: true,
    quantization: 'UD-Q4_K_XL',
    repository: 'huggingface.co/unsloth/gemma-3-4b-it-qat-GGUF',
  },
  {
    id: FINAL_EVALUATION_OLLAMA_MODEL_IDS[2],
    name: 'DeepSeek R1 0528 Qwen3 8B · OE4 (UD-Q4_K_XL)',
    family: 'DeepSeek R1',
    recommended: true,
    formalEvaluation: true,
    quantization: 'UD-Q4_K_XL',
    repository: 'huggingface.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF',
  },
] as const;

/**
 * Ollama local models. Formal OE4 models are explicit; the previous lightweight
 * choices remain available for ordinary operation and smoke testing.
 */
export const OLLAMA_MODELS: OllamaModelDef[] = [
  ...FINAL_EVALUATION_OLLAMA_MODELS,
  { id: 'qwen2.5:3b', name: 'Qwen 2.5 3B', family: 'Qwen', formalEvaluation: false },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', family: 'Llama', formalEvaluation: false },
  { id: 'mistral:7b', name: 'Mistral 7B', family: 'Mistral', formalEvaluation: false },
  { id: 'gemma2:2b', name: 'Gemma 2 2B', family: 'Gemma', formalEvaluation: false },
  { id: 'phi3:mini', name: 'Phi-3 Mini', family: 'Phi', formalEvaluation: false },
];

/**
 * Legacy compatibility — maps to the old AVAILABLE_MODELS shape.
 */
export const AVAILABLE_MODELS = {
  local: LOCAL_MODELS.map(m => ({ id: m.id, name: m.name, provider: m.provider, sizeGB: m.sizeGB })),
  chrome: CHROME_MODELS,
  cloud: CLOUD_MODELS.map(m => ({ id: m.id, name: m.name, provider: m.provider, baseURL: m.baseURL })),
  ollama: OLLAMA_MODELS.map(m => ({ id: m.id, name: m.name, family: m.family })),
};

/**
 * Get model families for filtering/grouping.
 */
export const getLocalFamilies = (): string[] => [...new Set(LOCAL_MODELS.map(m => m.family))];
export const getCloudFamilies = (): string[] => [...new Set(CLOUD_MODELS.map(m => m.family || m.provider))];
