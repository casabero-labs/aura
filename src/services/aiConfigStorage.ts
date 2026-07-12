import type { AIConfig } from '../types';

export const AI_CONFIG_STORAGE_KEY = 'aura_ai_config';
export const AI_CONFIG_SECRET_KEY = 'aura_ai_api_key_session';

export const sanitizeAIConfig = (config: AIConfig): AIConfig => {
  const { apiKey: _secret, ...safe } = config;
  return safe;
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
