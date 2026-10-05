import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(path.join(root, 'src/package.json'));
const { createServer, transformWithEsbuild } = await import(require.resolve('vite'));
const Papa = require('papaparse');
const baselineCommit = '5e951a7';
const baselineText = execFileSync('git', ['show', `${baselineCommit}:src/services/auditEngine.ts`], { cwd: root, encoding: 'utf8' })
  .replaceAll("'../types'", "'/types.ts'").replaceAll("'./columnProfiler'", "'/services/columnProfiler.ts'")
  .replaceAll("'./auditValue'", "'/services/auditValue.ts'").replaceAll("'./issuePresentation'", "'/services/issuePresentation.ts'");
const server = await createServer({ root: path.join(root, 'src'), configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom', plugins: [{
  name: 'recorded-audit-baseline',
  resolveId(id) { if (id === 'audit-baseline') return '\0audit-baseline'; },
  async load(id) { if (id === '\0audit-baseline') return (await transformWithEsbuild(baselineText, 'baseline.ts')).code; },
}] });
try {
  const { runAudit } = await server.ssrLoadModule('/services/auditEngine.ts');
  const { runAudit: beforeAudit } = await server.ssrLoadModule('audit-baseline');
  const { buildFinalDeterministicEvidence, renderFinalDeterministicEvidenceMarkdown } = await server.ssrLoadModule('/services/finalDeterministicEvidence.ts');
  const referenceDate = '2026-10-05T00:00:00.000Z';
  const rules = JSON.parse(fs.readFileSync(path.join(here, 'clientes.rules.json'), 'utf8'));
  const datasets = ['clientes_sucio', 'clientes_groundtruth'].map(name => ({
    name, rows: JSON.parse(fs.readFileSync(path.join(here, 'fixtures', `${name}.json`), 'utf8')),
  }));
  const iris = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/iris.json'), 'utf8'));
  datasets.push({ name: 'iris_uci', rows: iris.rows.map(row => Object.fromEntries(iris.fields.map((field, index) => [field, row[index]]))) });
  const paths = { titanic: 'experiments/datasets/titanic.csv', synthetic: 'experiments/datasets/synthetic_ground_truth.csv', phase8: 'experiments/final-evaluation/datasets/controlled_customers_phase8.csv' };
  const parsed = {};
  for (const [name, relativePath] of Object.entries(paths)) {
    const bytes = fs.readFileSync(path.join(root, relativePath));
    const csv = Papa.parse(bytes.toString('utf8'), { header: true, dynamicTyping: false, skipEmptyLines: true });
    parsed[name] = { relativePath, sha256: createHash('sha256').update(bytes).digest('hex'), csv };
    datasets.push({ name, rows: csv.data });
  }
  const summarize = report => ({ rows: report.rowCount, columns: report.colCount, score: report.score,
    critical: report.issues.filter(issue => issue.severity === 'critical').length,
    issues: report.issues.map(({ id, ruleId, column, count, severity, rowNumbers }) => ({ id, ruleId, column, count, severity, rowNumbers })),
    documentType: report.columnStats.documento?.inferredType,
  });
  const results = datasets.map(({ name, rows }) => {
    const fields = Object.keys(rows[0]).filter(field => field !== '__parsed_extra');
    const snapshot = JSON.stringify(rows);
    const result = { name, before: summarize(beforeAudit(rows, fields, ',', { referenceDate })), after: summarize(runAudit(rows, fields, ',', { referenceDate })) };
    if (name.startsWith('clientes_')) result.withDeclaredRules = summarize(runAudit(rows, fields, ',', { referenceDate, columns: rules }));
    if (snapshot !== JSON.stringify(rows)) throw new Error(`Source values changed: ${name}`);
    return { ...result, sourcePreserved: true };
  });
  const sourceHashes = Object.fromEntries(['src/services/auditEngine.ts', 'src/services/ruleChecks.ts', 'src/services/columnProfiler.ts', 'src/contracts/llm/columnRegistry.ts'].map(relativePath =>
    [relativePath, createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex')]));
  const checkoutCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify({ baselineCommit, checkoutCommit, sourceHashes, referenceDate, scoreIsAccuracy: false, results }, null, 2) + '\n');
  // Current benchmark artifacts use the same legacy typed input as their tests.
  const benchmarkInputs = Object.fromEntries(Object.entries(parsed).map(([name, entry]) => {
    const csv = Papa.parse(fs.readFileSync(path.join(root, entry.relativePath), 'utf8'), { header: true, dynamicTyping: true, skipEmptyLines: true });
    return [name, { relativePath: entry.relativePath, sha256: entry.sha256, report: runAudit(csv.data, csv.meta.fields, csv.meta.delimiter || ','), parseWarnings: csv.errors.map(({ type, code, row, message }) => ({ type, code, ...(typeof row === 'number' ? { row } : {}), message })) }];
  }));
  benchmarkInputs.phase8.oracle = JSON.parse(fs.readFileSync(path.join(root, 'experiments/final-evaluation/oracles/diagnostic-oracle.v1.json'), 'utf8'));
  const evidence = buildFinalDeterministicEvidence({ generatedAt: referenceDate, engineCommit: `${baselineCommit}+rules-working-tree`, datasets: benchmarkInputs });
  if (process.argv.includes('--refresh-benchmark')) {
    fs.writeFileSync(path.join(root, 'experiments/results/final_deterministic_evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    fs.writeFileSync(path.join(root, 'experiments/results/final_deterministic_evidence.md'), renderFinalDeterministicEvidenceMarkdown(evidence));
  }
  for (const result of results) console.log(`${result.name}: ${result.before.issues.length} → ${result.after.issues.length} hallazgos; score ${result.before.score} → ${result.after.score}${result.withDeclaredRules ? `; con reglas propias: ${result.withDeclaredRules.score}` : ''}`);
  console.log('Benchmark:', JSON.stringify(evidence.datasets.map(dataset => ({ id: dataset.id, binary: dataset.binaryRuleMetrics, extra: dataset.additionalDetections.length }))));
} finally { await server.close(); }
