import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  FINAL_EVALUATION_PROTOCOL,
  FINAL_EVALUATION_PROTOCOL_V1,
  OE4_DATASET_FINGERPRINT_SHA256,
  OE4_GROUND_TRUTH_SOURCE_SHA256,
} from '../services/benchmark/finalEvaluationProtocol';

const REPO_ROOT = join(__dirname, '..', '..');
const EXPE = join(REPO_ROOT, 'experiments/final-evaluation');
const DATASET_CSV = join(EXPE, 'datasets/controlled_customers_phase8.csv');
const SCHEMA_JSON = join(EXPE, 'datasets/controlled_customers_phase8.schema.json');
const GT_SOURCE = join(EXPE, 'oracles/controlled_customers_phase8_ground_truth.source.json');
const DIAG_ORACLE = join(EXPE, 'oracles/diagnostic-oracle.v1.json');
const REM_ORACLE = join(EXPE, 'oracles/remediation-oracle.v1.json');
const PROTOCOL_JSON = join(EXPE, 'protocol.v2.json');
const PROTOCOL_V1_JSON = join(EXPE, 'protocol.v1.json');
const MANIFEST_JSON = join(EXPE, 'model-manifest.v1.json');

function sha256(p: string): string {
  const buf = readFileSync(p);
  return createHash('sha256').update(buf).digest('hex');
}

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf-8')) as T;
}

interface GtIssue {
  id: string;
  classification: string;
}

interface DiagFinding {
  key: string;
  canonicalRuleId: string;
  columnId: string | null;
  scope: string;
  classification: string;
  reachability: string;
  primaryEligible: boolean;
  visibleEvidenceModes: string[];
  severity: string;
  sourceIssueIds: string[];
}

interface DiagOracle {
  findings: DiagFinding[];
  coverage: {
    totalSourceIssues: number;
    canonicalKeys: number;
    byReachability: Record<string, number>;
    byClassification: Record<string, number>;
    primaryF1Denominator: number;
  };
  source: {
    declaredSummary: { deterministic_expected: number; cognitive_expected: number; human_review_expected: number; total_issues: number };
    recalculatedSummary: { deterministic_expected: number; cognitive_expected: number; human_review_expected: number; total_issues: number };
    sourceMetadataMismatch: boolean;
  };
}

interface RemLink {
  diagnosticKey: string;
  reachability: string;
  classification: string;
  actionType: string;
  expectedActions: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  reviewOnlyActions: string[];
}

interface RemOracle {
  links: RemLink[];
  coverage: { diagnosticOracleFindings: number; remediationLinks: number; linksCoverAllDiagnosticKeys: boolean };
}

interface ModelEntry {
  id: string;
  quantization: string;
  referenceSizeGB: number;
}

interface ModelManifest {
  digestPolicy: string;
  models: ModelEntry[];
}

describe('OE4 final evaluation protocol — Task 1', () => {
  describe('frozen file hashes', () => {
    it('dataset CSV SHA-256 matches the canonical fingerprint', () => {
      expect(sha256(DATASET_CSV)).toBe(OE4_DATASET_FINGERPRINT_SHA256);
      expect(OE4_DATASET_FINGERPRINT_SHA256).toBe(
        '7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf',
      );
    });

    it('schema JSON SHA-256 is recorded and stable', () => {
      const expected = 'b1eba3a767a6e9a84398aa10220c73efa2b3db8b31151235f9b63141727a2a98';
      const dataset = FINAL_EVALUATION_PROTOCOL.dataset as unknown as { schemaSha256: string };
      expect(sha256(SCHEMA_JSON)).toBe(expected);
      expect(dataset.schemaSha256).toBe(expected);
    });

    it('ground truth source copy is byte-identical to the archive', () => {
      const expected = '38c846856860519d248b42e53afe3cacacff714f115af6cec4b3d050fe79040d';
      expect(OE4_GROUND_TRUTH_SOURCE_SHA256).toBe(expected);
      expect(sha256(GT_SOURCE)).toBe(expected);
    });
  });

  describe('dataset shape', () => {
    it('dataset has exactly 50 rows and 15 columns', () => {
      const csv = readFileSync(DATASET_CSV, 'utf-8').trimEnd();
      const lines = csv.split(/\r?\n/);
      expect(lines.length).toBe(51); // 1 header + 50 rows
      expect(lines[0].split(',').length).toBe(15);
    });

    it('schema declares 15 columns', () => {
      const schema = readJson<{ columns: unknown[] }>(SCHEMA_JSON);
      expect(schema.columns.length).toBe(15);
    });
  });

  describe('ground truth summary mismatch', () => {
    it('detects 50/3/2 declared vs 51/2/2 recalculated and records the flag', () => {
      const gt = readJson<{ issues: GtIssue[]; summary: { deterministic_expected: number; cognitive_expected: number; human_review_expected: number } }>(GT_SOURCE);
      const diag = readJson<DiagOracle>(DIAG_ORACLE);

      // declared
      expect(gt.summary.deterministic_expected).toBe(50);
      expect(gt.summary.cognitive_expected).toBe(3);
      expect(gt.summary.human_review_expected).toBe(2);

      // recalculated from array
      const det = gt.issues.filter((i) => i.classification === 'deterministic_expected').length;
      const cog = gt.issues.filter((i) => i.classification === 'cognitive_expected').length;
      const hum = gt.issues.filter((i) => i.classification === 'human_review_expected').length;
      expect(det).toBe(51);
      expect(cog).toBe(2);
      expect(hum).toBe(2);
      expect(det + cog + hum).toBe(55);

      // oracle records both
      expect(diag.source.declaredSummary.deterministic_expected).toBe(50);
      expect(diag.source.declaredSummary.cognitive_expected).toBe(3);
      expect(diag.source.recalculatedSummary.deterministic_expected).toBe(51);
      expect(diag.source.recalculatedSummary.cognitive_expected).toBe(2);
      expect(diag.source.sourceMetadataMismatch).toBe(true);
    });
  });

  describe('diagnostic oracle coverage', () => {
    it('covers all 55 GT issues with mapping or explicit exclusion (none excluded)', () => {
      const gt = readJson<{ issues: GtIssue[] }>(GT_SOURCE);
      const diag = readJson<DiagOracle>(DIAG_ORACLE);

      const gtIds = new Set(gt.issues.map((i) => i.id));
      const covered = new Set<string>();
      for (const f of diag.findings) {
        for (const sid of f.sourceIssueIds) {
          expect(covered.has(sid)).toBe(false);
          covered.add(sid);
        }
      }
      expect(covered.size).toBe(55);
      for (const id of gtIds) expect(covered.has(id)).toBe(true);
    });

    it('canonical keys are unique', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const keys = diag.findings.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('primaryEligible is true only for engine_exposed', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      for (const f of diag.findings) {
        if (f.primaryEligible) expect(f.reachability).toBe('engine_exposed');
      }
      const primary = diag.findings.filter((f) => f.primaryEligible);
      const exp = diag.findings.filter((f) => f.reachability === 'engine_exposed');
      expect(primary.length).toBe(exp.length);
    });

    it('uses the same 16 engine-exposed keys for primary F1 in all three modes', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const protocol = FINAL_EVALUATION_PROTOCOL as unknown as {
        inputModes: string[];
        primaryF1DenominatorByMode: Record<string, number>;
      };
      expect(protocol.inputModes).toEqual(['prompt_libre', 'smart_sample', 'recommended']);
      expect(diag.coverage.primaryF1Denominator).toBe(16);
      expect(protocol.primaryF1DenominatorByMode).toEqual({
        prompt_libre: 16,
        smart_sample: 16,
        recommended: 16,
      });
    });

    it('out_of_engine_scope findings are not in the primary denominator', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const oos = diag.findings.filter((f) => f.reachability === 'out_of_engine_scope');
      for (const f of oos) {
        expect(f.primaryEligible).toBe(false);
      }
    });

    it('models evidence visibility independently from the primary F1 denominator', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const exposed = diag.findings.filter((f) => f.reachability === 'engine_exposed');
      const unavailable = diag.findings.filter((f) => f.reachability !== 'engine_exposed');

      expect(diag.findings.every((f) => !f.visibleEvidenceModes.includes('prompt_libre'))).toBe(true);
      expect(exposed.every((f) => f.visibleEvidenceModes.includes('smart_sample'))).toBe(true);
      expect(exposed.every((f) => f.visibleEvidenceModes.includes('recommended'))).toBe(true);
      expect(unavailable.every((f) => f.visibleEvidenceModes.length === 0)).toBe(true);

      for (const f of diag.findings) {
        expect(f.visibleEvidenceModes.every((mode) => ['smart_sample', 'recommended'].includes(mode))).toBe(true);
        expect(f.severity).toMatch(/^(info|warning|critical)$/);
        expect(f.scope).toMatch(/^(column|dataset)$/);
        expect(f.classification).toMatch(/^(deterministic_expected|cognitive_expected|human_review_expected)$/);
        expect(f.reachability).toMatch(/^(engine_exposed|engine_supported_not_exposed|out_of_engine_scope)$/);
      }
    });

    it('treats customer_id uniqueness as out of engine scope, not exact duplicate rows', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const uniqueId = diag.findings.find((f) => f.sourceIssueIds.includes('GT-039'));
      expect(uniqueId).toMatchObject({
        key: 'rule:unique-id|customer_id|column',
        canonicalRuleId: 'rule:unique-id',
        columnId: 'customer_id',
        scope: 'column',
        reachability: 'out_of_engine_scope',
        primaryEligible: false,
        visibleEvidenceModes: [],
      });
    });

    it('coverage counters match the array contents', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const byReach: Record<string, number> = {};
      const byClass: Record<string, number> = {};
      for (const f of diag.findings) {
        byReach[f.reachability] = (byReach[f.reachability] ?? 0) + 1;
        byClass[f.classification] = (byClass[f.classification] ?? 0) + 1;
      }
      expect(byReach).toEqual(diag.coverage.byReachability);
      expect(byClass).toEqual(diag.coverage.byClassification);
      expect(diag.coverage.canonicalKeys).toBe(diag.findings.length);
      expect(diag.coverage.totalSourceIssues).toBe(55);
    });
  });

  describe('remediation oracle coverage', () => {
    it('every diagnostic key has a remediation link', () => {
      const diag = readJson<DiagOracle>(DIAG_ORACLE);
      const rem = readJson<RemOracle>(REM_ORACLE);
      const diagKeys = new Set(diag.findings.map((f) => f.key));
      const remKeys = new Set(rem.links.map((l) => l.diagnosticKey));
      for (const k of diagKeys) expect(remKeys.has(k)).toBe(true);
      for (const k of remKeys) expect(diagKeys.has(k)).toBe(true);
      expect(rem.coverage.linksCoverAllDiagnosticKeys).toBe(true);
      expect(rem.links.length).toBe(diag.findings.length);
    });

    it('uses only executable RemediationActionTypeV2 values', () => {
      const rem = readJson<RemOracle>(REM_ORACLE);
      const executableActions = new Set([
        'trim_whitespace',
        'drop_exact_duplicates',
        'normalize_placeholders',
        'normalize_casing',
        'convert_disguised_numbers',
        'requires_human_review',
      ]);
      for (const l of rem.links) {
        expect(l.expectedActions.length).toBeGreaterThan(0);
        expect(l.allowedActions.length).toBeGreaterThan(0);
        expect(l.forbiddenActions.length).toBeGreaterThan(0);
        expect(executableActions.has(l.actionType)).toBe(true);
        expect(l.expectedActions.every((action) => executableActions.has(action))).toBe(true);
        expect(l.allowedActions.every((action) => executableActions.has(action))).toBe(true);
        expect(l.reviewOnlyActions.every((action) => executableActions.has(action))).toBe(true);
      }
    });

    it('forces non-exposed and unsupported remediation through human review', () => {
      const rem = readJson<RemOracle>(REM_ORACLE);
      for (const link of rem.links.filter((l) => l.reachability !== 'engine_exposed')) {
        expect(link.actionType).toBe('requires_human_review');
        expect(link.expectedActions).toEqual(['requires_human_review']);
        expect(link.allowedActions).toEqual(['requires_human_review']);
        expect(link.reviewOnlyActions).toEqual(['requires_human_review']);
      }
    });

    it('maps the customer_id uniqueness finding to human review only', () => {
      const rem = readJson<RemOracle>(REM_ORACLE);
      const uniqueId = rem.links.find((link) => link.diagnosticKey === 'rule:unique-id|customer_id|column');
      expect(uniqueId).toMatchObject({
        reachability: 'out_of_engine_scope',
        actionType: 'requires_human_review',
        expectedActions: ['requires_human_review'],
        allowedActions: ['requires_human_review'],
        reviewOnlyActions: ['requires_human_review'],
      });
    });
  });

  describe('protocol JSON ≡ TypeScript constant', () => {
    it('matrix is 3×3×5 = 45 units and at most 45 evaluated LLM calls', () => {
      const protocol = readJson<{ matrix: { models: number; inputModes: number; repetitions: number; units: number; stagesPerUnit: number; maxLlmCalls: number } }>(PROTOCOL_JSON);
      const m = protocol.matrix as { models: number; inputModes: number; repetitions: number; units: number; stagesPerUnit: number; maxLlmCalls: number };
      expect(m.models).toBe(3);
      expect(m.inputModes).toBe(3);
      expect(m.repetitions).toBe(5);
      expect(m.units).toBe(45);
      expect(m.stagesPerUnit).toBe(1);
      expect(m.maxLlmCalls).toBe(45);

      expect(FINAL_EVALUATION_PROTOCOL.models.length).toBe(3);
      expect(FINAL_EVALUATION_PROTOCOL.inputModes.length).toBe(3);
      expect(FINAL_EVALUATION_PROTOCOL.repetitions).toBe(5);
      expect(FINAL_EVALUATION_PROTOCOL.matrix.units).toBe(45);
      expect(FINAL_EVALUATION_PROTOCOL.matrix.maxLlmCalls).toBe(45);
      expect(FINAL_EVALUATION_PROTOCOL.matrix.totalRealCalls).toBe(60);
    });

    it('preserves V1 as historical evidence while V2 is the active protocol', () => {
      const historical = readJson<{ id: string; version: string; matrix: { maxLlmCalls: number } }>(PROTOCOL_V1_JSON);
      expect(FINAL_EVALUATION_PROTOCOL.id).toBe('aura.oe4.final-evaluation.v2');
      expect(FINAL_EVALUATION_PROTOCOL_V1.id).toBe(historical.id);
      expect(FINAL_EVALUATION_PROTOCOL_V1.version).toBe(historical.version);
      expect(FINAL_EVALUATION_PROTOCOL_V1.matrix.maxLlmCalls).toBe(historical.matrix.maxLlmCalls);
    });

    it('TypeScript protocol is semantically identical to the frozen JSON', () => {
      const protocol = readJson<Record<string, unknown>>(PROTOCOL_JSON);
      expect(protocol).toEqual(JSON.parse(JSON.stringify(FINAL_EVALUATION_PROTOCOL)));
    });

    it('freezes an explicit balanced model order and 15 excluded warmups', () => {
      const protocol = readJson<{
        models: string[];
        schedule: {
          balancedModelOrders: string[][];
          warmupPerModelBlock: number;
          expectedModelBlocks: number;
          expectedWarmupCalls: number;
          warmupExcluded: boolean;
        };
      }>(PROTOCOL_JSON);
      const schedule = protocol.schedule;

      expect(schedule.balancedModelOrders).toHaveLength(5);
      expect(schedule.balancedModelOrders.every((order) => new Set(order).size === 3)).toBe(true);
      expect(schedule.balancedModelOrders.every((order) => protocol.models.every((model) => order.includes(model)))).toBe(true);

      for (const model of protocol.models) {
        const positionCounts = [0, 1, 2].map(
          (position) => schedule.balancedModelOrders.filter((order) => order[position] === model).length,
        );
        expect(Math.max(...positionCounts) - Math.min(...positionCounts)).toBeLessThanOrEqual(1);
      }

      expect(schedule.warmupPerModelBlock).toBe(1);
      expect(schedule.expectedModelBlocks).toBe(15);
      expect(schedule.expectedWarmupCalls).toBe(15);
      expect(schedule.warmupExcluded).toBe(true);
    });
  });

  describe('model manifest', () => {
    it('pins the three eligible Unsloth IDs while capturing installed digests dynamically', () => {
      const manifest = readJson<ModelManifest>(MANIFEST_JSON);
      expect(manifest.digestPolicy).toBe('capture_from_ollama_api_tags_at_campaign_creation');
      expect(manifest.models.length).toBe(3);
      const ids = manifest.models.map((m) => m.id);
      expect(ids).toEqual([
        'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
        'hf.co/unsloth/gemma-4-E4B-it-qat-GGUF:UD-Q4_K_XL',
        'hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL',
      ]);
      for (let i = 0; i < manifest.models.length; i++) {
        expect(manifest.models[i].quantization).toBe('UD-Q4_K_XL');
        expect(manifest.models[i]).not.toHaveProperty('expectedGgufSha256');
        expect(manifest.models[i]).not.toHaveProperty('localOllamaDigest');
      }
    });

    it('manifest model IDs match the protocol model list exactly', () => {
      const manifest = readJson<ModelManifest>(MANIFEST_JSON);
      const protocol = readJson<{ models: string[] }>(PROTOCOL_JSON);
      expect(manifest.models.map((m) => m.id)).toEqual(protocol.models);
    });
  });
});
