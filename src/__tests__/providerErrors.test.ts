import { describe, it, expect } from 'vitest';
import { normalizeAiProviderError } from '../services/providers/errors';
import { AIConfig } from '../types';

const baseConfig: AIConfig = {
  model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  temperature: 0.1,
  autoAnalyze: false,
  providerType: 'local',
};

describe('normalizeAiProviderError', () => {
  describe('Cache/Network errors', () => {
    it('normalizes Cache.add() network error', () => {
      const error = new Error("Failed to execute 'add' on 'Cache': Cache.add() encountered a network error");
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.title).toBe('Error de red al cachear modelo');
      expect(result.category).toBe('cache_network');
      expect(result.evidenceStatus).toBe('attempted_failed');
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.message).toContain('conexión');
    });

    it('handles Cache.add() with different wording', () => {
      const error = new Error('Cache.add() failed due to network error');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.category).toBe('cache_network');
    });
  });

  describe('WebGPU errors', () => {
    it('normalizes WebGPU not supported error', () => {
      const error = new Error('WebGPU is not supported in this browser');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.title).toBe('WebGPU no disponible');
      expect(result.category).toBe('webgpu_unsupported');
      expect(result.recommendedActions.some(a => a.includes('Chrome'))).toBe(true);
    });

    it('normalizes navigator.gpu error', () => {
      const error = new Error('navigator.gpu is undefined');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.category).toBe('webgpu_unsupported');
    });

    it('normalizes GPU adapter error', () => {
      const error = new Error('GPU adapter not found');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.category).toBe('webgpu_unsupported');
    });
  });

  describe('API key errors', () => {
    it('normalizes API key error', () => {
      const error = new Error('Invalid API key provided');
      const result = normalizeAiProviderError(error, { ...baseConfig, providerType: 'cloud' });

      expect(result.title).toBe('Error de autenticación');
      expect(result.category).toBe('api_key');
      expect(result.recommendedActions.some(a => a.includes('API key'))).toBe(true);
    });

    it('normalizes 401 error', () => {
      const error = new Error('Request failed with status 401 Unauthorized');
      const result = normalizeAiProviderError(error, { ...baseConfig, providerType: 'cloud' });

      expect(result.category).toBe('api_key');
    });

    it('normalizes 403 error', () => {
      const error = new Error('403 Forbidden');
      const result = normalizeAiProviderError(error, { ...baseConfig, providerType: 'cloud' });

      expect(result.category).toBe('api_key');
    });
  });

  describe('Storage/Quota errors', () => {
    it('normalizes QuotaExceeded error', () => {
      const error = new Error('QuotaExceededError: Quota exceeded');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.title).toBe('Almacenamiento insuficiente');
      expect(result.category).toBe('quota_storage');
      expect(result.recommendedActions.some(a => a.includes('espacio'))).toBe(true);
    });

    it('normalizes disk space error', () => {
      const error = new Error('Not enough disk space');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.category).toBe('quota_storage');
    });
  });

  describe('Model download errors', () => {
    it('normalizes Failed to fetch error', () => {
      const error = new Error('Failed to fetch model from CDN');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.title).toBe('Error al descargar modelo');
      expect(result.category).toBe('model_download');
    });
  });

  describe('Generic errors', () => {
    it('normalizes unknown error', () => {
      const error = new Error('Something went wrong');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.title).toBe('Error del proveedor de IA');
      expect(result.category).toBe('generic');
      expect(result.evidenceStatus).toBe('attempted_failed');
    });

    it('handles non-Error objects', () => {
      const error = 'string error';
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result.category).toBe('generic');
      expect(result.technicalMessage).toBe('string error');
    });

    it('handles null/undefined errors', () => {
      const result = normalizeAiProviderError(null, baseConfig);

      expect(result.category).toBe('generic');
    });
  });

  describe('Output structure', () => {
    it('always returns required fields', () => {
      const error = new Error('test');
      const result = normalizeAiProviderError(error, baseConfig);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('cause');
      expect(result).toHaveProperty('recommendedActions');
      expect(result).toHaveProperty('technicalMessage');
      expect(result).toHaveProperty('evidenceStatus');
      expect(result).toHaveProperty('category');
      expect(result.evidenceStatus).toBe('attempted_failed');
      expect(Array.isArray(result.recommendedActions)).toBe(true);
    });
  });
});
