import type { AIConfig } from '../types';
import { FINAL_EVALUATION_OLLAMA_MODEL_IDS } from './modelRegistry';

export const AI_CONFIG_STORAGE_KEY = 'aura_ai_config';
export const AI_CONFIG_SECRET_KEY = 'aura_ai_api_key_session';

const LEGACY_FORMAL_MODEL_MIGRATIONS: Readonly<Record<string, string>> = {
  'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL': FINAL_EVALUATION_OLLAMA_MODEL_IDS[0],
  'hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL': FINAL_EVALUATION_OLLAMA_MODEL_IDS[1],
  'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL': FINAL_EVALUATION_OLLAMA_MODEL_IDS[2],
};

export const migrateFormalModelId = (model: string | undefined): string | undefined => (
  model ? (LEGACY_FORMAL_MODEL_MIGRATIONS[model] ?? model) : model
);

export const sanitizeAIConfig = (config: AIConfig): AIConfig => {
  const { apiKey: _secret, ...safe } = config;
  return {
    ...safe,
    model: migrateFormalModelId(safe.model) ?? safe.model,
    ollamaModel: migrateFormalModelId(safe.ollamaModel),
  };
};

export const loadAIConfig = (
  fallback: AIConfig,
  persistent: Pick<Storage, 'getItem'> = localStorage,
  session: Pick<Storage, 'getItem'> = sessionStorage,
): AIConfig => {
  let safe: Partial<AIConfig> = {};
  try {
    const stored = persistent.getItem(AI_CONFIG_STORAGE_KEY);
    if (stored) safe = sanitizeAIConfig(JSON.parse(stored) as AIConfig);
  } catch {
    safe = {};
  }
  return {
    ...fallback,
    ...safe,
    apiKey: session.getItem(AI_CONFIG_SECRET_KEY) || '',
  };
};

export const persistAIConfig = (
  config: AIConfig,
  persistent: Pick<Storage, 'setItem'> = localStorage,
  session: Pick<Storage, 'setItem' | 'removeItem'> = sessionStorage,
): AIConfig => {
  const safe = sanitizeAIConfig(config);
  persistent.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(safe));
  if (config.apiKey) session.setItem(AI_CONFIG_SECRET_KEY, config.apiKey);
  else session.removeItem(AI_CONFIG_SECRET_KEY);
  return safe;
};
