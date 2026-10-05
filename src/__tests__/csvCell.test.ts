import { describe, expect, it } from 'vitest';
import { csvCell } from '../utils/csvCell';

describe('csvCell', () => {
  it('entrecomilla y escapa comillas dobles', () => {
    expect(csvCell('a "b" c')).toBe('"a ""b"" c"');
    expect(csvCell('x,y')).toBe('"x,y"');
  });

  it('serializa null/undefined como celda vacía y conserva números', () => {
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell('001')).toBe('"001"');
    expect(csvCell('120.00')).toBe('"120.00"');
  });

  it.each([
    ['=HYPERLINK("http://x","y")', '"\'=HYPERLINK(""http://x"",""y"")"'],
    ['+1+1', '"\'+1+1"'],
    ['-2+3', '"\'-2+3"'],
    ['@SUM(A1:A2)', '"\'@SUM(A1:A2)"'],
    ['\t=1', '"\'\t=1"'],
    ['\r=1', '"\'\r=1"'],
  ])('neutraliza fórmula al inicio: %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('no altera disparadores que no están en la primera posición', () => {
    expect(csvCell('a=b')).toBe('"a=b"');
    expect(csvCell('café @ 10')).toBe('"café @ 10"');
  });
});
