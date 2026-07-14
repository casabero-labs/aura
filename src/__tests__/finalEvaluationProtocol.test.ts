import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FINAL_EVALUATION_PROTOCOL,
  FINAL_EVALUATION_PROTOCOL_V1,
  OE4_DATASET_FINGERPRINT_SHA256,
  OE4_DATASET_SCHEMA_SHA256,
  OE4_GROUND_TRUTH_SOURCE_SHA256,
} from '../services/benchmark/finalEvaluationProtocol';

const REPO_ROOT = join(__dirname, '..', '..');
const DATASET_CSV = join(REPO_ROOT, 'experiments/datasets/synthetic_ground_truth.csv');
const SCHEMA_JSON = join(REPO_ROOT, 'experiments/datasets/synthetic_ground_truth.schema.json');
const GT_SOURCE = join(REPO_ROOT, 'experiments/datasets/synthetic_ground_truth.json');
const DIAG_ORACLE = join(REPO_ROOT, 'src/services/benchmark/oracles/diagnostic-oracle.synthetic.v1.json');
const PROTOCOL_JSON = join(REPO_ROOT, 'experiments/final-evaluation/protocol.v2.json');
const PROTOCOL_V1_JSON = join(REPO_ROOT, 'experiments/final-evaluation/protocol.v1.json');

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
const readJson = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

describe('OE4 final evaluation protocol', () => {
  it('freezes the synthetic dataset, schema and ground truth by SHA-256', () => {
    expect(sha256(DATASET_CSV)).toBe(OE4_DATASET_FINGERPRINT_SHA256);
    expect(sha256(SCHEMA_JSON)).toBe(OE4_DATASET_SCHEMA_SHA256);
    expect(sha256(GT_SOURCE)).toBe(OE4_GROUND_TRUTH_SOURCE_SHA256);
    expect(FINAL_EVALUATION_PROTOCOL.dataset).toMatchObject({
      id: 'synthetic_ground_truth', rows: 15, columns: 9,
    });
  });

  it('confirms the physical dataset and schema shape', () => {
    const lines = readFileSync(DATASET_CSV, 'utf8').trimEnd().split(/\r?\n/);
    const schema = readJson<{ rows: number; columns: unknown[] }>(SCHEMA_JSON);
    expect(lines).toHaveLength(16);
    expect(lines[0].split(',')).toHaveLength(9);
    expect(schema.rows).toBe(15);
    expect(schema.columns).toHaveLength(9);
  });

  it('uses 15 unique engine-exposed findings as the primary oracle', () => {
    const oracle = readJson<{
      coverage: { totalSourceIssues: number; canonicalKeys: number; primaryF1Denominator: number };
      findings: Array<{ key: string; reachability: string; primaryEligible: boolean; visibleEvidenceModes: string[] }>;
    }>(DIAG_ORACLE);
    expect(oracle.coverage).toEqual({ totalSourceIssues: 15, canonicalKeys: 15, primaryF1Denominator: 15 });
    expect(oracle.findings).toHaveLength(15);
    expect(new Set(oracle.findings.map((finding) => finding.key)).size).toBe(15);
    expect(oracle.findings.every((finding) => finding.reachability === 'engine_exposed' && finding.primaryEligible)).toBe(true);
    expect(oracle.findings.every((finding) => !finding.visibleEvidenceModes.includes('prompt_libre'))).toBe(true);
    expect(oracle.findings.filter((finding) => finding.visibleEvidenceModes.includes('smart_sample'))).toHaveLength(10);
    expect(oracle.findings.filter((finding) => finding.visibleEvidenceModes.includes('recommended'))).toHaveLength(10);
  });

  it('freezes 3 models × 3 modes × 3 repetitions = 27 diagnoses plus 9 warm-ups', () => {
    expect(FINAL_EVALUATION_PROTOCOL.version).toBe('2.4.0');
    expect(FINAL_EVALUATION_PROTOCOL.inference.numPredict).toBe(4096);
    expect(FINAL_EVALUATION_PROTOCOL.repetitions).toBe(3);
    expect(FINAL_EVALUATION_PROTOCOL.matrix).toMatchObject({
      models: 3,
      inputModes: 3,
      repetitions: 3,
      units: 27,
      evaluatedLlmCalls: 27,
      warmupCalls: 9,
      totalRealCalls: 36,
      maxLlmCalls: 27,
    });
    expect(FINAL_EVALUATION_PROTOCOL.schedule.balancedModelOrders).toHaveLength(3);
    expect(FINAL_EVALUATION_PROTOCOL.schedule.expectedModelBlocks).toBe(9);
  });

  it('keeps the TypeScript protocol identical to the frozen JSON', () => {
    expect(readJson<Record<string, unknown>>(PROTOCOL_JSON)).toEqual(
      JSON.parse(JSON.stringify(FINAL_EVALUATION_PROTOCOL)),
    );
  });

  it('preserves V1 as historical evidence', () => {
    const historical = readJson<{ id: string; version: string }>(PROTOCOL_V1_JSON);
    expect(FINAL_EVALUATION_PROTOCOL_V1.id).toBe(historical.id);
    expect(FINAL_EVALUATION_PROTOCOL_V1.version).toBe(historical.version);
  });
});
