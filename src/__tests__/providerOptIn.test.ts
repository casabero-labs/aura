/**
 * Provider Opt-in Tests — Phase 8 L4
 *
 * Validates that provider opt-in helper correctly identifies:
 *   - Inactive (default): no flag → no provider validation
 *   - Env var activation: AURA_PROVIDER_VALIDATION=chrome|ollama|gemini|all
 *   - Query param activation: ?providerValidation=chrome|ollama|gemini|all
 *   - No false activation with invalid values
 *   - Correct provider list parsing
 */

import { describe, expect, it } from 'vitest';
import {
  detectProviderOptIn,
  isProviderValidationClaimProhibited,
  PROVIDER_VALIDATION_CLAIMS_ALLOWED,
  PROVIDER_VALIDATION_CLAIMS_PROHIBITED,
  PROVIDER_NOTICE,
  PROVIDER_STATES,
} from '../utils/providerOptIn';

describe('detectProviderOptIn — Phase 8 L4 boundary', () => {
  it('returns inactive when no env and no query param', () => {
    const result = detectProviderOptIn(undefined, '');
    expect(result.active).toBe(false);
    expect(result.source).toBe('none');
    expect(result.providers).toHaveLength(0);
  });

  it('returns inactive when env var is empty string', () => {
    const result = detectProviderOptIn('', '');
    expect(result.active).toBe(false);
  });

  it('returns inactive when env var is whitespace only', () => {
    const result = detectProviderOptIn('   ', '');
    expect(result.active).toBe(false);
  });

  it('activates on env var AURA_PROVIDER_VALIDATION=chrome', () => {
    const result = detectProviderOptIn('chrome', '');
    expect(result.active).toBe(true);
    expect(result.source).toBe('env');
    expect(result.providers).toEqual(['chrome']);
  });

  it('activates on env var AURA_PROVIDER_VALIDATION=ollama', () => {
    const result = detectProviderOptIn('ollama', '');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['ollama']);
  });

  it('activates on env var AURA_PROVIDER_VALIDATION=gemini', () => {
    const result = detectProviderOptIn('gemini', '');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['gemini']);
  });

  it('activates on env var AURA_PROVIDER_VALIDATION=all', () => {
    const result = detectProviderOptIn('all', '');
    expect(result.active).toBe(true);
    expect(result.source).toBe('env');
    expect(result.providers).toEqual(['chrome', 'ollama', 'gemini', 'webllm']);
  });

  it('activates on env var with comma-separated providers', () => {
    const result = detectProviderOptIn('chrome,ollama', '');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['chrome', 'ollama']);
  });

  it('ignores invalid provider names in env var', () => {
    const result = detectProviderOptIn('chrome,invalid_provider,ollama', '');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['chrome', 'ollama']);
  });

  it('ignores env var if value is only invalid names', () => {
    const result = detectProviderOptIn('invalid_provider,not_a_provider', '');
    expect(result.active).toBe(false);
  });

  it('prefers env over query param when both present', () => {
    const result = detectProviderOptIn('chrome', '?providerValidation=ollama');
    expect(result.active).toBe(true);
    expect(result.source).toBe('env');
    expect(result.providers).toEqual(['chrome']);
  });

  it('activates on query param ?providerValidation=chrome', () => {
    const result = detectProviderOptIn(undefined, '?providerValidation=chrome');
    expect(result.active).toBe(true);
    expect(result.source).toBe('query_param');
    expect(result.providers).toEqual(['chrome']);
  });

  it('activates on query param ?providerValidation=ollama', () => {
    const result = detectProviderOptIn(undefined, '?providerValidation=ollama');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['ollama']);
  });

  it('activates on query param ?providerValidation=all', () => {
    const result = detectProviderOptIn(undefined, '?providerValidation=all');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['chrome', 'ollama', 'gemini', 'webllm']);
  });

  it('activates on query param with comma-separated providers', () => {
    const result = detectProviderOptIn(undefined, '?providerValidation=chrome,gemini');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['chrome', 'gemini']);
  });

  it('ignores invalid provider names in query param', () => {
    const result = detectProviderOptIn(undefined, '?providerValidation=chrome,notreal,ollama');
    expect(result.active).toBe(true);
    expect(result.providers).toEqual(['chrome', 'ollama']);
  });

  it('returns inactive when query param has only invalid values', () => {
    const result = detectProviderOptIn(undefined, '?providerValidation=notreal,notathing');
    expect(result.active).toBe(false);
  });

  it('is case-insensitive for env var', () => {
    const r1 = detectProviderOptIn('CHROME', '');
    const r2 = detectProviderOptIn('Chrome', '');
    const r3 = detectProviderOptIn('cHrOmE', '');
    expect(r1.providers).toEqual(['chrome']);
    expect(r2.providers).toEqual(['chrome']);
    expect(r3.providers).toEqual(['chrome']);
  });

  it('is case-insensitive for query param', () => {
    const r1 = detectProviderOptIn(undefined, '?providerValidation=CHROME');
    const r2 = detectProviderOptIn(undefined, '?providerValidation=Chrome');
    expect(r1.providers).toEqual(['chrome']);
    expect(r2.providers).toEqual(['chrome']);
  });

  it('reads window.location.search by default', () => {
    const originalSearch = (globalThis as any).window?.location?.search;
    (globalThis as any).window = { location: { search: '?providerValidation=ollama' } };
    try {
      const result = detectProviderOptIn();
      expect(result.active).toBe(true);
      expect(result.providers).toEqual(['ollama']);
    } finally {
      if (originalSearch === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window.location.search = originalSearch;
      }
    }
  });
});

describe('isProviderValidationClaimProhibited — Phase 8 L4 claims guard', () => {
  it('detects "production-ready because provider is available"', () => {
    expect(isProviderValidationClaimProhibited('AURA is production-ready because Chrome AI is available')).toBe(true);
  });

  it('detects "always available"', () => {
    expect(isProviderValidationClaimProhibited('Chrome AI or Gemini Nano is always available')).toBe(true);
  });

  it('detects "works on all environments"', () => {
    expect(isProviderValidationClaimProhibited('Provider availability means AURA works on all environments')).toBe(true);
  });

  it('detects "benchmark formal exists"', () => {
    expect(isProviderValidationClaimProhibited('Benchmark formal exists based on provider opt-in run')).toBe(true);
  });

  it('detects "corrected datasets"', () => {
    expect(isProviderValidationClaimProhibited('AURA corrected datasets using a real provider')).toBe(true);
  });

  it('returns false for neutral text', () => {
    expect(isProviderValidationClaimProhibited('Chrome AI availability was checked in opt-in mode')).toBe(false);
    expect(isProviderValidationClaimProhibited('Provider validation is preliminary_valid only')).toBe(false);
  });

  it('exports non-empty prohibited claims list', () => {
    expect(PROVIDER_VALIDATION_CLAIMS_PROHIBITED.length).toBeGreaterThan(0);
  });

  it('exports non-empty allowed claims list', () => {
    expect(PROVIDER_VALIDATION_CLAIMS_ALLOWED.length).toBeGreaterThan(0);
  });

  it('exports recognizable provider notice', () => {
    expect(PROVIDER_NOTICE).toContain('PROVIDER VALIDATION');
  });

  it('exports all provider states', () => {
    expect(PROVIDER_STATES).toContain('not_configured');
    expect(PROVIDER_STATES).toContain('unavailable');
    expect(PROVIDER_STATES).toContain('downloadable');
    expect(PROVIDER_STATES).toContain('available');
    expect(PROVIDER_STATES).toContain('attempted_failed');
    expect(PROVIDER_STATES).toContain('preliminary_valid');
  });
});