import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  evaluateDiagnosticOracle,
  evaluateFindings,
  type DiagnosticOracleV1,
} from '../services/benchmark/diagnosticOracleEvaluator';

const oracle: DiagnosticOracleV1 = {
  coverage: { totalSourceIssues: 4 },
  findings: [
    {
      key: 'rule:null-values|email|column',
      canonicalRuleId: 'rule:null-values',
      columnId: 'email',
      scope: 'column',
      reachability: 'engine_exposed',
      primaryEligible: true,
      visibleEvidenceModes: ['smart_sample', 'recommended'],
      sourceIssueIds: ['GT-1'],
    },
    {
      key: 'rule:email-format|email|column',
      canonicalRuleId: 'rule:email-format',
      columnId: 'email',
      scope: 'column',
      reachability: 'engine_exposed',
      primaryEligible: true,
      visibleEvidenceModes: ['smart_sample', 'recommended'],
      sourceIssueIds: ['GT-2'],
    },
    {
      key: 'rule:future-dates|birth_date|column',
      canonicalRuleId: 'rule:future-dates',
      columnId: 'birth_date',
      scope: 'column',
      reachability: 'engine_supported_not_exposed',
      primaryEligible: false,
      visibleEvidenceModes: [],
      sourceIssueIds: ['GT-3'],
    },
    {
      key: 'rule:human-review|status|column',
      canonicalRuleId: 'rule:human-review',
      columnId: 'status',
      scope: 'column',
      reachability: 'out_of_engine_scope',
      primaryEligible: false,
      visibleEvidenceModes: [],
      sourceIssueIds: ['GT-4'],
    },
  ],
};

describe('evaluateFindings', () => {
  it('calculates TP, FP, FN, precision, recall and F1 from explicit sets', () => {
    const result = evaluateFindings(
      ['rule:null-values|email|column', 'rule:email-format|email|column'],
      ['rule:null-values|email|column', 'rule:ghost|name|column'],
    );

    expect(result).toEqual({
      tp: 1,
      fp: 1,
      fn: 1,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    });
  });

  it('uses deterministic zero-denominator rules and ignores duplicates', () => {
    expect(evaluateFindings([], [])).toEqual({
      tp: 0, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1,
    });
    expect(evaluateFindings(['a'], ['a', 'a'])).toEqual({
      tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1,
    });
    expect(evaluateFindings(['a'], [])).toEqual({
      tp: 0, fp: 0, fn: 1, precision: 0, recall: 0, f1: 0,
    });
  });
});

describe('evaluateDiagnosticOracle', () => {
  it('separates primary quality, extended discovery and hallucinations', () => {
    const result = evaluateDiagnosticOracle({
      oracle,
      inputMode: 'recommended',
      knownColumns: ['email', 'birth_date', 'status'],
      contractCompliant: false,
      contractErrors: ['missing limitations'],
      unsupportedClaims: ['Claims 99% completeness without evidence'],
      predictions: [
        {
          ruleId: 'rule:null-values',
          columnId: 'email',
          scope: 'column',
          issueId: 'issue:email-null',
          evidenceRefs: ['evidence:email-null'],
          badSampleRefs: ['evidence:email-null'],
        },
        {
          ruleId: 'rule:future-dates',
          columnId: 'birth_date',
          scope: 'column',
          issueId: 'issue:future-date',
        },
        {
          ruleId: 'rule:ghost',
          columnId: 'name',
          scope: 'column',
          issueId: null,
        },
      ],
    });

    expect(result.primary).toEqual({
      tp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5, f1: 0.5,
    });
    expect(result.extendedDiscoveryKeys).toEqual(['rule:future-dates|birth_date|column']);
    expect(result.engineCoverage).toBe(0.75);
    expect(result.evidenceFidelity).toBe(0.5);
    expect(result.contract).toEqual({ compliant: false, errors: ['missing limitations'] });
    expect(result.hallucinations).toMatchObject({
      inventedColumns: ['name'],
      inventedRuleIds: ['rule:ghost'],
      unknownFindingKeys: ['rule:ghost|name|column'],
      unsupportedClaims: ['Claims 99% completeness without evidence'],
    });
    expect(result.anchoring.score).toBeGreaterThan(0);
    expect(result.anchoring.score).toBeLessThan(1);
  });

  it('reports evidence fidelity as not applicable for prompt_libre', () => {
    const result = evaluateDiagnosticOracle({
      oracle,
      inputMode: 'prompt_libre',
      knownColumns: ['email', 'birth_date', 'status'],
      contractCompliant: true,
      predictions: [],
    });

    expect(result.evidenceFidelity).toBeNull();
    expect(result.primary.recall).toBe(0);
    expect(result.anchoring.score).toBe(0);
    expect(result.hallucinations.total).toBe(0);
  });

  it('consumes the frozen oracle without changing its 16-key denominator', () => {
    const repoRoot = join(__dirname, '..', '..');
    const frozenOracle = JSON.parse(readFileSync(
      join(repoRoot, 'experiments/final-evaluation/oracles/diagnostic-oracle.v1.json'),
      'utf-8',
    )) as DiagnosticOracleV1;
    const schema = JSON.parse(readFileSync(
      join(repoRoot, 'experiments/final-evaluation/datasets/controlled_customers_phase8.schema.json'),
      'utf-8',
    )) as { columns: Array<{ name: string }> };

    const result = evaluateDiagnosticOracle({
      oracle: frozenOracle,
      inputMode: 'recommended',
      knownColumns: schema.columns.map((column) => column.name),
      contractCompliant: true,
      predictions: [],
    });

    expect(result.primary.fn).toBe(16);
    expect(result.engineCoverage).toBe(41 / 55);
    expect(result.evidenceFidelity).toBe(0);
  });

  it('keeps the deployable oracle byte-identical to the canonical experiment oracle', () => {
    const repoRoot = join(__dirname, '..', '..');
    const canonical = readFileSync(
      join(repoRoot, 'experiments/final-evaluation/oracles/diagnostic-oracle.v1.json'),
      'utf-8',
    );
    const deployable = readFileSync(
      join(repoRoot, 'src/services/benchmark/oracles/diagnostic-oracle.v1.json'),
      'utf-8',
    );

    expect(deployable).toBe(canonical);
  });
});
