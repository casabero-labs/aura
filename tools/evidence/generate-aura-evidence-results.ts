import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../../src/services/auditEngine';
import { IssueSeverity } from '../../src/types';

const repoRoot = path.resolve(__dirname, '../..');
const datasetsDir = path.join(repoRoot, 'docs/evidence/datasets');
const outDir = path.join(repoRoot, 'docs/evidence/results');

fs.mkdirSync(outDir, { recursive: true });

const datasets = [
  { id: 'clientes', file: 'clientes_sucio.csv', purpose: 'valores nulos, placeholders y errores de higiene textual' },
  { id: 'inventario', file: 'inventario_sucio.csv', purpose: 'tipos mixtos, negativos y consistencia de inventario' },
  { id: 'operaciones', file: 'operaciones_sucio.csv', purpose: 'duplicados, formatos temporales y coherencia operacional' },
];

const rows = datasets.map((dataset) => {
  const csvContent = fs.readFileSync(path.join(datasetsDir, dataset.file), 'utf8');
  const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const fields = parsed.meta.fields || [];
  const delimiter = parsed.meta.delimiter || ',';
  const report = runAudit(parsed.data, fields, delimiter);
  const severity = {
    critical: report.issues.filter((issue) => issue.severity === IssueSeverity.CRITICAL).length,
    warning: report.issues.filter((issue) => issue.severity === IssueSeverity.WARNING).length,
    info: report.issues.filter((issue) => issue.severity === IssueSeverity.INFO).length,
  };
  const topIssues = report.issues.slice(0, 5).map((issue) => ({
    severity: issue.severity,
    ruleName: issue.ruleName,
    column: issue.column || '',
    count: issue.count,
    affectedPercentage: Number(issue.affectedPercentage.toFixed(2)),
  }));

  return {
    dataset: dataset.file,
    purpose: dataset.purpose,
    rows: report.rowCount,
    columns: report.colCount,
    score: report.score,
    duplicateRows: report.duplicateRows,
    issues: report.issues.length,
    severity,
    topIssues,
  };
});

const generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'aura_evidence_results.json'), JSON.stringify({ generatedAt, rows }, null, 2));

const md = [
  '# Evidencia actualizada AURA - segunda entrega',
  '',
  `Generado: ${generatedAt}`,
  '',
  '| Dataset | Proposito | Filas | Columnas | Score | Hallazgos | Criticos | Advertencias | Info | Duplicados |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map((row) => `| ${row.dataset} | ${row.purpose} | ${row.rows} | ${row.columns} | ${row.score}/100 | ${row.issues} | ${row.severity.critical} | ${row.severity.warning} | ${row.severity.info} | ${row.duplicateRows} |`),
  '',
  '## Hallazgos principales por dataset',
  '',
  ...rows.flatMap((row) => [
    `### ${row.dataset}`,
    '',
    '| Severidad | Regla | Columna | Conteo | Afectacion |',
    '|---|---|---|---:|---:|',
    ...row.topIssues.map((issue) => `| ${issue.severity} | ${issue.ruleName} | ${issue.column || '-'} | ${issue.count} | ${issue.affectedPercentage}% |`),
    '',
  ]),
].join('\n');

fs.writeFileSync(path.join(outDir, 'aura_evidence_results.md'), md);
console.log(`Resultados actualizados en ${outDir}`);
