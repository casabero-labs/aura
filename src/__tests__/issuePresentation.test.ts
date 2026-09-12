import { describe, expect, it } from 'vitest';
import { formatAffectedShare, formatPipelineStage, isNumericSentinel } from '../services/issuePresentation';

describe('UX-04 issue presentation', () => {
  it('never rounds a single record to 0%', () => {
    expect(formatAffectedShare(1, 6001)).toBe('1 de 6.001 (<0,1%)');
  });

  it('keeps a readable absolute count for larger shares', () => {
    expect(formatAffectedShare(177, 891)).toBe('177 de 891 (19,9%)');
  });

  it('treats 999 as a possible sentinel, not a universal null', () => {
    expect(isNumericSentinel('999')).toBe(true);
    expect(isNumericSentinel('n/a')).toBe(false);
  });

  it('names pipeline stages in Spanish', () => {
    expect(formatPipelineStage('diagnostic_report')).toBe('Informe diagnóstico');
  });
});
