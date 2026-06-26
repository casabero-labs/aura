/**
 * AI Provider Factory — Capa 2: Estabilidad Cognitiva
 * 
 * Punto central de creación de proveedores de IA.
 * Soporta Chrome AI, Ollama local, Cloud (OpenAI-compatible, Gemini), y
 * WebLLM experimental (oculto por defecto).
 * 
 * Referencia TFM: §3.3.3 — Arquitectura de Capas de Estabilidad
 */

import { AIConfig, AIProvider, CloudProvider } from '../types';
import type { ChromePromptProvider } from './providers/chromeProvider';
import type { GeminiProvider } from './providers/geminiProvider';
import type { OpenAIProvider } from './providers/openaiProvider';
import { CLOUD_MODELS } from './modelRegistry';

export { AVAILABLE_MODELS, LOCAL_MODELS, CLOUD_MODELS, CHROME_MODELS, OLLAMA_MODELS } from './modelRegistry';
export { checkModelDownloaded, deleteDownloadedModel, getDownloadedModels, getLocalModelStatus, markPreloadVerified, clearPreloadVerification } from './modelManager';
export { getChromeAiDiagnostic } from './providers/chromeProvider';
export type { ChromeAiDiagnostic, ChromeAiApiSurface, ChromeAiStatus } from './providers/chromeProvider';

/** Check if WebLLM experimental mode is enabled via env flag */
const isWebLLMExperimentalEnabled = (): boolean => {
  try {
    return import.meta.env.VITE_ENABLE_WEBLLM_EXPERIMENTAL === 'true';
  } catch {
    return false;
  }
};

/**
 * Migra configuraciones legacy de 'local' (WebLLM) al nuevo sistema.
 * Prioridad: Chrome AI > Ollama > Cloud.
 * Solo ejecuta la migración una vez.
 */
const MIGRATION_KEY = 'aura_provider_migrated_v2';
let migrationNoticeShown = false;

const migrateLegacyConfig = (config: AIConfig): AIConfig => {
  if (config.providerType !== 'local') return config;

  const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
  if (alreadyMigrated === 'true') {
    // Ya migrado, convertir a chrome como fallback seguro
    return { ...config, providerType: 'chrome', model: 'gemini-nano' };
  }

  // Intentar detección automática
  // 1. Chrome AI disponible?
  // 2. Ollama detectado?
  // 3. Cloud si hay API key
  // 4. chrome como default

  if (config.apiKey) {
    // User already has API key set — prefer cloud
    localStorage.setItem(MIGRATION_KEY, 'true');
    const cloudModel = CLOUD_MODELS.find(m => m.recommended);
    return {
      ...config,
      providerType: 'cloud',
      model: cloudModel?.id || 'gemini-2.5-flash',
      cloudProvider: config.cloudProvider || 'google',
    };
  }

  // Default to chrome — user will see availability warning if not available
  localStorage.setItem(MIGRATION_KEY, 'true');
  return { ...config, providerType: 'chrome', model: 'gemini-nano' };
};

export const hasShownMigrationNotice = (): boolean => migrationNoticeShown;
export const markMigrationNoticeShown = (): void => { migrationNoticeShown = true; };

// ── Lazy Provider Wrappers ──

class LazyWebLLMProvider implements AIProvider {
  readonly name = 'WebLLM (Experimental)';
  readonly type = 'local' as const;

  private providerPromise?: Promise<AIProvider>;

  constructor(private model: string, private temperature: number, private aiConfig?: AIConfig) {}

  private async provider(): Promise<AIProvider> {
    if (!this.providerPromise) {
      this.providerPromise = import('./providers/webllmProvider').then(({ WebLLMProvider }) =>
        new WebLLMProvider(this.model, this.temperature, this.aiConfig)
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
  async generateTextWithProgress(...args: Parameters<NonNullable<AIProvider['generateTextWithProgress']>>) {
    return (await this.provider()).generateTextWithProgress?.(...args);
  }
  async isAvailable() {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) return false;
    return (await this.provider()).isAvailable();
  }
  async preloadModel(...args: Parameters<NonNullable<AIProvider['preloadModel']>>) {
    return (await this.provider()).preloadModel?.(...args);
  }
  async unloadModel() {
    if (this.providerPromise) {
      const providerInstance = await this.providerPromise;
      if (providerInstance.unloadModel) await providerInstance.unloadModel();
    }
  }
}

class LazyChromeProvider implements AIProvider {
  readonly name = 'Chrome AI / Gemini Nano';
  readonly type = 'chrome' as const;

  private providerPromise?: Promise<AIProvider>;

  constructor(private temperature: number) {}

  private async provider(): Promise<AIProvider> {
    if (!this.providerPromise) {
      this.providerPromise = import('./providers/chromeProvider').then(({ ChromePromptProvider }) =>
        new ChromePromptProvider()
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
  async generateTextWithProgress(...args: Parameters<NonNullable<AIProvider['generateTextWithProgress']>>) {
    return (await this.provider()).generateTextWithProgress?.(...args);
  }
  async isAvailable() {
    return (await this.provider()).isAvailable();
  }
}

class LazyOllamaProvider implements AIProvider {
  readonly name = 'Ollama';
  readonly type = 'ollama' as const;

  private providerPromise?: Promise<AIProvider>;

  constructor(
    private model: string,
    private temperature: number,
    private baseUrl: string,
    private aiConfig?: AIConfig,
  ) {}

  private async provider(): Promise<AIProvider> {
    if (!this.providerPromise) {
      this.providerPromise = import('./providers/ollamaProvider').then(({ OllamaProvider }) =>
        new OllamaProvider(this.model, this.temperature, this.baseUrl, this.aiConfig)
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
  async generateTextWithProgress(...args: Parameters<NonNullable<AIProvider['generateTextWithProgress']>>) {
    return (await this.provider()).generateTextWithProgress?.(...args);
  }
  async isAvailable() {
    return (await this.provider()).isAvailable();
  }
  async preloadModel(...args: Parameters<NonNullable<AIProvider['preloadModel']>>) {
    return (await this.provider()).preloadModel?.(...args);
  }
  async unloadModel() {
    if (this.providerPromise) {
      const p = await this.providerPromise;
      if (p.unloadModel) await p.unloadModel();
    }
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

// ── Factory ──

export const createAIProvider = (config: AIConfig): AIProvider => {
  // Migrate legacy 'local' providerType
  const migrated = migrateLegacyConfig(config);

  switch (migrated.providerType) {
    case 'chrome':
      return new LazyChromeProvider(migrated.temperature);

    case 'ollama': {
      const baseUrl = migrated.ollamaBaseUrl || 'http://localhost:11434';
      const model = migrated.model || migrated.ollamaModel || 'qwen2.5:3b';
      return new LazyOllamaProvider(model, migrated.temperature, baseUrl, migrated);
    }

    case 'cloud': {
      const modelEntry = CLOUD_MODELS.find(m => m.id === migrated.model);
      const baseURL = modelEntry?.baseURL || 'https://api.openai.com/v1';
      return new LazyCloudProvider(
        migrated.cloudProvider,
        migrated.apiKey,
        migrated.model,
        migrated.temperature,
        baseURL,
      );
    }

    case 'webllm_experimental': {
      if (!isWebLLMExperimentalEnabled()) {
        // Fallback to chrome if experimental flag not set
        return new LazyChromeProvider(migrated.temperature);
      }
      return new LazyWebLLMProvider(migrated.model, migrated.temperature, migrated);
    }

    case 'local':
    default:
      // 'local' should have been migrated, but just in case
      return new LazyWebLLMProvider(migrated.model, migrated.temperature, migrated);
  }
};

export const checkWebGPUSupport = async (): Promise<boolean> => {
  try {
    if (!(navigator as any).gpu) return false;
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
};
