import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { runAudit } from '../../src/services/auditEngine';
import {
  buildFinalDeterministicEvidence,
  renderFinalDeterministicEvidenceMarkdown,
  type Phase8DiagnosticOracle,
} from '../../src/services/finalDeterministicEvidence';

const repoRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(repoRoot, 'experiments/results');
const syntheticPath = path.join(repoRoot, 'experiments/datasets/synthetic_ground_truth.csv');
const titanicPath = path.join(repoRoot, 'experiments/datasets/titanic.csv');
const phase8Path = path.join(
  repoRoot,
  'experiments/final-evaluation/datasets/controlled_customers_phase8.csv',
);
const phase8OraclePath = path.join(
  repoRoot,
  'experiments/final-evaluation/oracles/diagnostic-oracle.v1.json',
);

const sha256 = (filePath: string): string =>
  createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const auditCsv = (filePath: string) => {
  const parsed = Papa.parse<Record<string, unknown>>(fs.readFileSync(filePath, 'utf-8'), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const fatalErrors = parsed.errors.filter((error) => error.type !== 'FieldMismatch');
  if (fatalErrors.length > 0) {
    throw new Error(`CSV inválido ${filePath}: ${fatalErrors.map((error) => error.message).join('; ')}`);
  }
  return {
    report: runAudit(parsed.data, parsed.meta.fields ?? [], parsed.meta.delimiter || ','),
    parseWarnings: parsed.errors.map((error) => ({
      type: error.type,
      code: error.code,
      ...(typeof error.row === 'number' ? { row: error.row } : {}),
      message: error.message,
    })),
  };
};

const engineCommit = process.env.AURA_EVIDENCE_COMMIT
  || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf-8' }).trim();
const generatedAt = process.env.AURA_EVIDENCE_GENERATED_AT || new Date().toISOString();
const phase8Oracle = JSON.parse(
  fs.readFileSync(phase8OraclePath, 'utf-8'),
) as Phase8DiagnosticOracle;

const evidence = buildFinalDeterministicEvidence({
  generatedAt,
  engineCommit,
  datasets: {
    synthetic: {
      relativePath: 'experiments/datasets/synthetic_ground_truth.csv',
      sha256: sha256(syntheticPath),
      ...auditCsv(syntheticPath),
    },
    titanic: {
      relativePath: 'experiments/datasets/titanic.csv',
      sha256: sha256(titanicPath),
      ...auditCsv(titanicPath),
    },
    phase8: {
      relativePath: 'experiments/final-evaluation/datasets/controlled_customers_phase8.csv',
      sha256: sha256(phase8Path),
      ...auditCsv(phase8Path),
      oracle: phase8Oracle,
    },
  },
});

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, 'final_deterministic_evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf-8',
);
fs.writeFileSync(
  path.join(outputDir, 'final_deterministic_evidence.md'),
  renderFinalDeterministicEvidenceMarkdown(evidence),
  'utf-8',
);

for (const dataset of evidence.datasets) {
  const metrics = dataset.binaryRuleMetrics;
  console.log(
    `${dataset.id}: TP=${metrics.tp} FP=${metrics.fp} FN=${metrics.fn} `
      + `P=${metrics.precision.toFixed(4)} R=${metrics.recall.toFixed(4)} F1=${metrics.f1.toFixed(4)}`,
  );
}
console.log(`Artefactos generados en ${outputDir}`);
