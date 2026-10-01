import type { AIConfig } from '../types';

/**
 * Proveedores cloud: implementación futura.
 *
 * Los adaptadores (Gemini, OpenAI-compatible) se conservan en
 * `services/providers`, pero la interfaz no los ofrece y ninguna
 * configuración restaurada (localStorage, sincronización remota o legado)
 * puede activarlos. Esta versión ejecuta el diagnóstico solo en local.
 */
export const CLOUD_PROVIDERS_ENABLED: boolean = false;

export const LOCAL_FALLBACK_PROVIDER = { providerType: 'chrome', model: 'gemini-nano' } as const;

export const enforceProviderAvailability = (config: AIConfig): AIConfig => {
  if (CLOUD_PROVIDERS_ENABLED || config.providerType !== 'cloud') return config;
  return { ...config, ...LOCAL_FALLBACK_PROVIDER, cloudProvider: undefined };
};
