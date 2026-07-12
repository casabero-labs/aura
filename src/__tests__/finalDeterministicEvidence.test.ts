import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../services/auditEngine';
import {
  buildFinalDeterministicEvidence,
  renderFinalDeterministicEvidenceMarkdown,
  type FinalDeterministicEvidenceInput,
  type Phase8DiagnosticOracle,
} from '../services/finalDeterministicEvidence';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SYNTHETIC_PATH = path.join(REPO_ROOT, 'experiments/datasets/synthetic_ground_truth.csv');
const TITANIC_PATH = path.join(REPO_ROOT, 'experiments/datasets/titanic.csv');
const PHASE8_PATH = path.join(REPO_ROOT, 'experiments/final-evaluation/datasets/controlled_customers_phase8.csv');
const PHASE8_ORACLE_PATH = path.join(REPO_ROOT, 'experiments/final-evaluation/oracles/diagnostic-oracle.v1.json');
const ARTIFACT_JSON_PATH = path.join(REPO_ROOT, 'experiments/results/final_deterministic_evidence.json');
const ARTIFACT_MD_PATH = path.join(REPO_ROOT, 'experiments/results/final_deterministic_evidence.md');

function sha256(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function auditCsv(filePath: string) {
  const parsed = Papa.parse<Record<string, unknown>>(fs.readFileSync(filePath, 'utf-8'), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return {
    report: runAudit(parsed.data, parsed.meta.fields ?? [], parsed.meta.delimiter || ','),
    parseWarnings: parsed.errors.map((error) => ({
      type: error.type,
      code: error.code,
      ...(typeof error.row === 'number' ? { row: error.row } : {}),
      message: error.message,
    })),
  };
}

function buildInput(generatedAt: string, engineCommit: string): FinalDeterministicEvidenceInput {
  const phase8Oracle = JSON.parse(
    fs.readFileSync(PHASE8_ORACLE_PATH, 'utf-8'),
  ) as Phase8DiagnosticOracle;

  return {
    generatedAt,
    engineCommit,
    datasets: {
      synthetic: {
        relativePath: 'experiments/datasets/synthetic_ground_truth.csv',
        sha256: sha256(SYNTHETIC_PATH),
        ...auditCsv(SYNTHETIC_PATH),
      },
      titanic: {
        relativePath: 'experiments/datasets/titanic.csv',
        sha256: sha256(TITANIC_PATH),
        ...auditCsv(TITANIC_PATH),
      },
      phase8: {
        relativePath: 'experiments/final-evaluation/datasets/controlled_customers_phase8.csv',
        sha256: sha256(PHASE8_PATH),
        ...auditCsv(PHASE8_PATH),
        oracle: phase8Oracle,
      },
    },
  };
}

describe('final deterministic evidence', () => {
  it('keeps binary rule metrics separate from occurrence counts', () => {
    const evidence = buildFinalDeterministicEvidence(
      buildInput('2026-07-10T00:00:00.000Z', 'abcdef1'),
    );
    const byId = new Map(evidence.datasets.map((dataset) => [dataset.id, dataset]));

    const synthetic = byId.get('synthetic_ground_truth');
    expect(synthetic?.binaryRuleMetrics).toMatchObject({
      evaluatedRules: 12,
      tp: 12,
      fp: 0,
      fn: 0,
      precisionKind: 'scoped_with_explicit_negatives',
    });
    expect(synthetic?.binaryRuleMetrics.precision).toBe(1);
    expect(synthetic?.binaryRuleMetrics.recall).toBe(1);
    expect(synthetic?.binaryRuleMetrics.f1).toBe(1);
    expect(synthetic?.occurrenceCounts.knownFalsePositiveOccurrences).toBe(0);

    const titanic = byId.get('titanic');
    expect(titanic?.binaryRuleMetrics).toMatchObject({
      evaluatedRules: 3,
      tp: 3,
      fp: 0,
      fn: 0,
      precision: 1,
      recall: 1,
      f1: 1,
      precisionKind: 'conditional_no_negative_labels',
    });
    expect(titanic?.occurrenceCounts.expectedPositiveOccurrences).toBe(927);
    expect(titanic?.additionalDetections).toHaveLength(7);

    const phase8 = byId.get('controlled_customers_phase8');
    expect(phase8?.binaryRuleMetrics).toMatchObject({
      evaluatedRules: 29,
      tp: 16,
      fp: 0,
      fn: 13,
      precision: 1,
      precisionKind: 'conditional_no_negative_labels',
    });
    expect(phase8?.binaryRuleMetrics.recall).toBeCloseTo(16 / 29, 12);
    expect(phase8?.binaryRuleMetrics.f1).toBeCloseTo(32 / 45, 12);
    expect(phase8?.occurrenceCounts.expectedPositiveOccurrences).toBe(51);
    expect(phase8?.additionalDetections).toHaveLength(13);
    expect(phase8?.parseWarnings.map((warning) => ({ code: warning.code, row: warning.row }))).toEqual([
      { code: 'TooManyFields', row: 12 },
      { code: 'TooManyFields', row: 18 },
      { code: 'TooManyFields', row: 40 },
    ]);
  });

  it('records exact hashes and an explicit non-overlap limitation', () => {
    const evidence = buildFinalDeterministicEvidence(
      buildInput('2026-07-10T00:00:00.000Z', 'abcdef1'),
    );

    expect(evidence.methodology.primaryUnit).toBe('binary_rule_activation');
    expect(evidence.methodology.occurrenceUnit).toBe('issue_occurrences_not_unique_rows');
    expect(evidence.methodology.unannotatedDetections).toBe('reported_unscored');
    expect(evidence.supersedes).toEqual(['experiments/results/deterministic_validation.json']);
    expect(evidence.limitations).toContain(
      'Los conteos de ocurrencias pueden solaparse entre reglas y no representan filas únicas.',
    );
    expect(evidence.datasets.map((dataset) => dataset.sha256)).toEqual([
      sha256(SYNTHETIC_PATH),
      sha256(TITANIC_PATH),
      sha256(PHASE8_PATH),
    ]);
  });

  it('matches the frozen JSON and Markdown artifacts exactly', () => {
    const frozen = JSON.parse(
      fs.readFileSync(ARTIFACT_JSON_PATH, 'utf-8'),
    ) as ReturnType<typeof buildFinalDeterministicEvidence>;
    const regenerated = buildFinalDeterministicEvidence(
      buildInput(frozen.generatedAt, frozen.engineCommit),
    );

    expect(regenerated).toEqual(frozen);
    expect(renderFinalDeterministicEvidenceMarkdown(regenerated)).toBe(
      fs.readFileSync(ARTIFACT_MD_PATH, 'utf-8'),
    );
  });
});
