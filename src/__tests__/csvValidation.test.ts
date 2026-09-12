import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { assertUsableCsv } from '../services/csvValidation';

const check = (csv: string) => assertUsableCsv(Papa.parse(csv, {
  header: true, dynamicTyping: false, skipEmptyLines: true,
}));

describe('UX-01 CSV admission', () => {
  it.each(['', '   \n', 'id,name\n', 'id,name\n,\n', 'id,name\n1\n', 'id,name\n1,Ana,extra\n', 'id,name\n1,"unfinished\n', 'id,id\n1,2\n'])('rejects unusable data: %j', csv => {
    expect(() => check(csv)).toThrow('No se pudo auditar');
  });
  it.each(['id\n001\n', 'id;name\n001;Ana\n', 'id,name\n001,"Ana, María"\n'])('accepts a usable table: %j', csv => {
    expect(() => check(csv)).not.toThrow();
  });
});
