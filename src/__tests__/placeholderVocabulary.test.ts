/**
 * Placeholder Vocabulary Tests — Phase 4 Loop 1R.
 */

import { describe, it, expect } from 'vitest';
import {
  PLACEHOLDER_VOCABULARY_V2,
  PLACEHOLDER_VOCABULARY_VERSION,
  PLACEHOLDER_COUNT,
} from '../contracts/llm/placeholderVocabulary';

describe('PLACEHOLDER_VOCABULARY_V2', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(PLACEHOLDER_VOCABULARY_V2)).toBe(true);
  });

  it('is readonly array', () => {
    expect(Array.isArray(PLACEHOLDER_VOCABULARY_V2)).toBe(true);
  });

  it('has stable order across multiple imports', () => {
    const first = [...PLACEHOLDER_VOCABULARY_V2];
    const second = [...PLACEHOLDER_VOCABULARY_V2];
    expect(first).toEqual(second);
  });

  it('has no exact duplicate values', () => {
    const seen = new Set<string>();
    for (const p of PLACEHOLDER_VOCABULARY_V2) {
      expect(seen.has(p)).toBe(false);
      seen.add(p);
    }
  });

  it('version is 1.0.0', () => {
    expect(PLACEHOLDER_VOCABULARY_VERSION).toBe('1.0.0');
  });

  it('length is calculated via .length', () => {
    expect(PLACEHOLDER_COUNT).toBe(PLACEHOLDER_VOCABULARY_V2.length);
  });

  it('no mutation affects the original content', () => {
    const originalLength = PLACEHOLDER_VOCABULARY_V2.length;
    const originalFirst = PLACEHOLDER_VOCABULARY_V2[0];
    const copy = [...PLACEHOLDER_VOCABULARY_V2];
    copy.push('mutated');
    copy[0] = 'changed';
    expect(PLACEHOLDER_VOCABULARY_V2.length).toBe(originalLength);
    expect(PLACEHOLDER_VOCABULARY_V2[0]).toBe(originalFirst);
  });

  it('contains expected placeholder values', () => {
    const vocab = PLACEHOLDER_VOCABULARY_V2;
    expect(vocab).toContain('');
    expect(vocab).toContain('n/a');
    expect(vocab).toContain('N/A');
    expect(vocab).toContain('null');
    expect(vocab).toContain('NULL');
    expect(vocab).toContain('none');
    expect(vocab).toContain('None');
    expect(vocab).toContain('?');
    expect(vocab).toContain('-');
    expect(vocab).toContain('--');
    expect(vocab).toContain('NaN');
  });
});
