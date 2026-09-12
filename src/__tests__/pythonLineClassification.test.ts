import { describe, expect, it } from 'vitest';
import { classifyPythonLine } from '../services/pythonLineClassification';

describe('UX-05 python line classification', () => {
  it('does not treat a Spanish comment as a destructive delete', () => {
    expect(classifyPythonLine('# Ejecutar sobre una copia del DataFrame original: df_clean = df.copy()')).toBeNull();
  });

  it('counts drop_duplicates as a transformation, not silence', () => {
    expect(classifyPythonLine('    df_clean = df_clean.drop_duplicates(keep="first").copy()')).toBe('transformacion');
  });

  it('still flags an actual Python del of a column', () => {
    expect(classifyPythonLine('    del df_clean["id"]')).toBe('destructiva');
  });
});
