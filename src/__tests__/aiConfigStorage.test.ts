import { describe, expect, it, vi } from 'vitest';
import type { AIConfig } from '../types';
import { loadAIConfig, persistAIConfig, sanitizeAIConfig } from '../services/aiConfigStorage';

const config: AIConfig = {
  providerType: 'cloud', cloudProvider: 'openrouter', model: 'test',
  temperature: 0.2, autoAnalyze: false, apiKey: 'secret-value',
};

describe('AI configuration storage', () => {
  it('never returns the API key in the persistable or syncable value', () => {
    expect(sanitizeAIConfig(config)).not.toHaveProperty('apiKey');
    const persistent = { setItem: vi.fn() };
    const session = { setItem: vi.fn(), removeItem: vi.fn() };
    const safe = persistAIConfig(config, persistent, session);
    expect(safe).not.toHaveProperty('apiKey');
    expect(persistent.setItem.mock.calls[0][1]).not.toContain('secret-value');
    expect(session.setItem).toHaveBeenCalledWith('aura_ai_api_key_session', 'secret-value');
  });

  it('loads only a session-scoped key and strips a legacy persisted key', () => {
    const loaded = loadAIConfig(config, {
      getItem: () => JSON.stringify({ ...config, apiKey: 'legacy-leak' }),
    }, { getItem: () => 'session-secret' });
    expect(loaded.apiKey).toBe('session-secret');
  });
});
