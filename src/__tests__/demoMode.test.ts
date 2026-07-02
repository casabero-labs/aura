/**
 * Demo/Prod Boundary Tests — Phase 8 L1
 *
 * Validates that the demoMode helper correctly distinguishes:
 *   - Normal/product mode (no flag → inactive)
 *   - Demo/evidence mode (explicit flag → active)
 *
 * Also validates that prohibited claims detection works as expected.
 */

import { describe, expect, it } from 'vitest';
import {
  detectDemoMode,
  isProhibitedClaim,
  PROHIBITED_CLAIMS,
  DEMO_MODE_NOTICE,
} from '../utils/demoMode';

describe('detectDemoMode — Phase 8 L1 boundary', () => {
  it('returns inactive when no query params present', () => {
    const result = detectDemoMode('');
    expect(result.active).toBe(false);
    expect(result.source).toBe('none');
    expect(result.visual).toBe('none');
  });

  it('returns inactive for unrelated query params', () => {
    const result = detectDemoMode('?foo=bar&baz=qux');
    expect(result.active).toBe(false);
    expect(result.source).toBe('none');
    expect(result.visual).toBe('none');
  });

  it('activates on ?phase7Visual=running', () => {
    const result = detectDemoMode('?phase7Visual=running');
    expect(result.active).toBe(true);
    expect(result.source).toBe('query_param_phase7');
    expect(result.visual).toBe('running');
  });

  it('activates on ?phase7Visual=error', () => {
    const result = detectDemoMode('?phase7Visual=error');
    expect(result.active).toBe(true);
    expect(result.source).toBe('query_param_phase7');
    expect(result.visual).toBe('error');
  });

  it('activates on ?demoMode=1 (Phase 8 generic)', () => {
    const result = detectDemoMode('?demoMode=1');
    expect(result.active).toBe(true);
    expect(result.source).toBe('query_param_demo');
    expect(result.visual).toBe('none');
  });

  it('activates on ?demoMode=true', () => {
    const result = detectDemoMode('?demoMode=true');
    expect(result.active).toBe(true);
    expect(result.source).toBe('query_param_demo');
  });

  it('does NOT activate on ?demoMode=0 (explicit off)', () => {
    const result = detectDemoMode('?demoMode=0');
    expect(result.active).toBe(false);
    expect(result.source).toBe('none');
  });

  it('does NOT activate on unknown phase7Visual values', () => {
    const result = detectDemoMode('?phase7Visual=unknown');
    expect(result.active).toBe(false);
  });

  it('prefers phase7Visual over demoMode when both present', () => {
    const result = detectDemoMode('?phase7Visual=running&demoMode=1');
    expect(result.active).toBe(true);
    expect(result.source).toBe('query_param_phase7');
    expect(result.visual).toBe('running');
  });

  it('reads from window.location.search by default', () => {
    const originalSearch = (globalThis as any).window?.location?.search;
    (globalThis as any).window = { location: { search: '?demoMode=1' } };
    try {
      const result = detectDemoMode();
      expect(result.active).toBe(true);
      expect(result.source).toBe('query_param_demo');
    } finally {
      if (originalSearch === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window.location.search = originalSearch;
      }
    }
  });
});

describe('isProhibitedClaim — Phase 8 L1 claims guard', () => {
  it('detects "production-ready" claim', () => {
    expect(isProhibitedClaim('AURA is production-ready now')).toBe(true);
  });

  it('detects "real datasets corrected" claim', () => {
    expect(isProhibitedClaim('AURA corrected real datasets')).toBe(true);
  });

  it('detects "Python internally" claim', () => {
    expect(isProhibitedClaim('AURA executes Python internally')).toBe(true);
  });

  it('detects "always available" Chrome AI claim', () => {
    expect(isProhibitedClaim('Chrome AI is always available')).toBe(true);
  });

  it('detects "always available" Gemini Nano claim', () => {
    expect(isProhibitedClaim('Gemini Nano is always available')).toBe(true);
  });

  it('detects "formal benchmark" claim', () => {
    expect(isProhibitedClaim('A formal benchmark exists')).toBe(true);
  });

  it('detects "external validation" claim', () => {
    expect(isProhibitedClaim('External independent validation exists')).toBe(true);
  });

  it('returns false for neutral text', () => {
    expect(isProhibitedClaim('Phase 8 L1 added demo mode helper')).toBe(false);
    expect(isProhibitedClaim('controlled fixture copy')).toBe(false);
  });

  it('exports a non-empty list of prohibited claims', () => {
    expect(PROHIBITED_CLAIMS.length).toBeGreaterThan(0);
  });

  it('exports a recognizable demo notice constant', () => {
    expect(DEMO_MODE_NOTICE).toContain('DEMO');
    expect(DEMO_MODE_NOTICE).toContain('fixture');
  });
});