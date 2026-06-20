import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../services/auditEngine';

const DATASETS = [
  'synthetic_ground_truth.csv',
  'titanic.csv',
  'adult_income.csv',
];

const DATASET_DIR = path.resolve(__dirname, '../experiments/datasets');

function parseLikeBrowser(fileName: string) {
  const csvData = fs.readFileSync(path.join(DATASET_DIR, fileName), 'utf-8');
  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',
    dynamicTyping: true,
  });

  return {
    data: parsed.data as Record<string, any>[],
    fields: parsed.meta.fields as string[],
    delimiter: parsed.meta.delimiter || ',',
    errors: parsed.errors,
  };
}

describe('Dataset upload flow fixtures', () => {
  it.each(DATASETS)('parses and audits %s without blocking deterministic results', (fileName) => {
    const startedAt = performance.now();
    const { data, fields, delimiter, errors } = parseLikeBrowser(fileName);
    const report = runAudit(data, fields, delimiter);
    const elapsedMs = performance.now() - startedAt;

    expect(errors.filter((error) => error.type === 'Delimiter')).toHaveLength(0);
    expect(data.length).toBeGreaterThan(0);
    expect(fields.length).toBeGreaterThan(0);
    expect(report.rowCount).toBe(data.length);
    expect(report.colCount).toBe(fields.length);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
