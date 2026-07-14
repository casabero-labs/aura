import { describe, expect, it } from 'vitest';
import { resolveBuildSha } from '../buildIdentity';

describe('resolveBuildSha', () => {
  it('uses the explicit AURA build SHA first', () => {
    expect(resolveBuildSha({
      VITE_AURA_BUILD_SHA: 'ABCDEF1234567',
      SOURCE_COMMIT: '1'.repeat(40),
    }, '2'.repeat(40))).toBe('abcdef1234567');
  });

  it('uses the Coolify source commit when the repository metadata is absent', () => {
    expect(resolveBuildSha({ SOURCE_COMMIT: 'A'.repeat(40) })).toBe('a'.repeat(40));
  });

  it('falls back to the Git checkout SHA for local and CI builds', () => {
    expect(resolveBuildSha({}, 'b'.repeat(40))).toBe('b'.repeat(40));
  });

  it('never accepts a non-verifiable revision', () => {
    expect(resolveBuildSha({ SOURCE_COMMIT: 'latest' }, 'unknown')).toBe('unknown');
  });
});
